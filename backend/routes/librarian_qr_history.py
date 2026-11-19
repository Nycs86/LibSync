"""Persistent QR scan audit and manual release recovery for LibSync."""
import logging
from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request
from database import get_db_connection
from .auth import require_role
from email_service import send_borrow_status_email

bp = Blueprint('librarian_qr_history', __name__)
log = logging.getLogger(__name__)


def utc(value):
    return value.isoformat(timespec='seconds') + 'Z' if isinstance(value, datetime) else value


@bp.route('/api/librarian/qr-history', methods=['GET'])
@require_role('librarian')
def history():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database unavailable'}), 500
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute('''
            SELECT e.id, e.batch_id, e.qr_type, e.scanned_at,
                   l.name AS librarian_name, u.name AS student_name,
                   u.email AS student_email, bb.status AS batch_status,
                   bb.borrow_qr_used_at AS released_at, bb.due_date,
                   r.disposition, r.resolved_at, r.actual_handover_at, r.note,
                   GROUP_CONCAT(DISTINCT CASE WHEN br.status = 'approved' THEN b.title END
                     ORDER BY b.title SEPARATOR ', ') AS book_titles
            FROM librarian_qr_scan_events e
            JOIN borrow_batches bb ON bb.id = e.batch_id
            JOIN users u ON u.id = bb.user_id
            JOIN users l ON l.id = e.librarian_id
            LEFT JOIN librarian_release_resolutions r ON r.batch_id = bb.id
            LEFT JOIN borrow_requests br ON br.batch_id = bb.id
            LEFT JOIN books b ON b.id = br.book_id
            GROUP BY e.id, e.batch_id, e.qr_type, e.scanned_at,
                     l.name, u.name, u.email, bb.status, bb.borrow_qr_used_at,
                     bb.due_date, r.disposition, r.resolved_at, r.actual_handover_at, r.note
            ORDER BY e.scanned_at DESC, e.id DESC LIMIT 300
        ''')
        events = cur.fetchall()
        for e in events:
            for k in ('scanned_at', 'released_at', 'due_date', 'resolved_at', 'actual_handover_at'):
                e[k] = utc(e[k])
        cur.execute('''
            SELECT bb.id AS batch_id, u.name AS student_name, u.email AS student_email,
                   MIN(e.scanned_at) AS first_scanned_at, MAX(e.scanned_at) AS last_scanned_at,
                   COUNT(DISTINCT e.id) AS scan_count,
                   GROUP_CONCAT(DISTINCT CASE WHEN br.status = 'approved' THEN b.title END
                     ORDER BY b.title SEPARATOR ', ') AS book_titles
            FROM borrow_batches bb
            JOIN librarian_qr_scan_events e ON e.batch_id = bb.id AND e.qr_type = 'borrow'
            JOIN users u ON u.id = bb.user_id
            LEFT JOIN librarian_release_resolutions r ON r.batch_id = bb.id
            LEFT JOIN borrow_requests br ON br.batch_id = bb.id
            LEFT JOIN books b ON b.id = br.book_id
            WHERE bb.status = 'approved' AND bb.borrow_qr_used_at IS NULL
              AND r.batch_id IS NULL
            GROUP BY bb.id, u.name, u.email
            ORDER BY last_scanned_at DESC
        ''')
        pending = cur.fetchall()
        for item in pending:
            for k in ('first_scanned_at', 'last_scanned_at'):
                item[k] = utc(item[k])

        # A successful Return QR scan is permanently recorded before the
        # librarian confirms the return. If the librarian leaves the scanner
        # page and the displayed QR later expires/disappears, this queue lets
        # the librarian recover the outstanding return without the old token.
        cur.execute('''
            SELECT bb.id AS batch_id,
                   u.name AS student_name,
                   u.email AS student_email,
                   MIN(e.scanned_at) AS first_scanned_at,
                   MAX(e.scanned_at) AS last_scanned_at,
                   COUNT(DISTINCT e.id) AS scan_count,
                   COUNT(DISTINCT br.id) AS outstanding_count,
                   GROUP_CONCAT(DISTINCT b.title ORDER BY b.title SEPARATOR ', ')
                     AS outstanding_book_titles
            FROM borrow_batches bb
            INNER JOIN librarian_qr_scan_events e
                ON e.batch_id = bb.id AND e.qr_type = 'return'
            INNER JOIN users u ON u.id = bb.user_id
            LEFT JOIN borrow_requests br
                ON br.batch_id = bb.id
               AND br.status = 'approved'
               AND br.returned_at IS NULL
            LEFT JOIN books b ON b.id = br.book_id
            WHERE bb.status IN ('approved', 'partially_returned')
              AND bb.borrow_qr_used_at IS NOT NULL
              AND bb.return_qr_used_at IS NULL
            GROUP BY bb.id, u.name, u.email
            HAVING COUNT(DISTINCT br.id) > 0
            ORDER BY last_scanned_at DESC
        ''')
        pending_returns = cur.fetchall()
        pending_return_by_batch = {int(item['batch_id']): item for item in pending_returns}
        for item in pending_returns:
            item['outstanding_books'] = []
            for k in ('first_scanned_at', 'last_scanned_at'):
                item[k] = utc(item[k])

        # Return request-level identifiers so the librarian can recover a
        # partial batch safely instead of being forced to confirm every book.
        pending_batch_ids = list(pending_return_by_batch)
        if pending_batch_ids:
            placeholders = ','.join(['%s'] * len(pending_batch_ids))
            cur.execute(
                f'''SELECT br.batch_id, br.id AS request_id, br.book_id,
                           b.title AS book_title
                    FROM borrow_requests br
                    INNER JOIN books b ON b.id = br.book_id
                    WHERE br.batch_id IN ({placeholders})
                      AND br.status = 'approved'
                      AND br.returned_at IS NULL
                    ORDER BY br.batch_id ASC, br.id ASC''',
                tuple(pending_batch_ids),
            )
            for book in cur.fetchall():
                item = pending_return_by_batch.get(int(book['batch_id']))
                if item is not None:
                    item['outstanding_books'].append({
                        'request_id': int(book['request_id']),
                        'book_id': int(book['book_id']),
                        'title': book['book_title'],
                    })

        return jsonify({
            'status': 'success',
            'events': events,
            'pending': pending,
            'pending_returns': pending_returns,
        })
    except Exception:
        log.exception('QR history load failed')
        return jsonify({'message': 'Could not load QR history. Apply SQL migration first.'}), 500
    finally:
        cur.close()
        conn.close()


@bp.route('/api/librarian/pending-releases/<int:batch_id>/resolve', methods=['POST'])
@require_role('librarian')
def resolve(batch_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'message': 'JSON object required.'}), 400
    action = data.get('action')
    if action not in ('handed_over', 'not_handed_over'):
        return jsonify({'message': 'Invalid resolution action.'}), 400
    note = str(data.get('note') or '').strip()
    if len(note) > 500:
        return jsonify({'message': 'Note must be 500 characters or less.'}), 400
    handover = None
    if action == 'handed_over':
        # The simplified Save Resolution workflow records release at confirmation.
        # Retain support for explicit historical handover timestamps from older clients.
        raw = data.get('actual_handover_at')
        if raw:
            if not note:
                return jsonify({'message': 'Provide an audit note for a historical handover.'}), 400
            try:
                parsed = datetime.fromisoformat(str(raw).replace('Z', '+00:00'))
                if parsed.tzinfo is None:
                    return jsonify({'message': 'Handover time must include a timezone.'}), 400
                handover = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            except (TypeError, ValueError):
                return jsonify({'message': 'Valid actual handover date/time required.'}), 400
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if handover > now or handover < now - timedelta(days=7):
                return jsonify({'message': 'Handover time must be within the past 7 days.'}), 400
        else:
            handover = datetime.now(timezone.utc).replace(tzinfo=None)
            note = note or 'Librarian confirmed physical handover using Save Resolution; release time recorded at confirmation.'
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database unavailable.'}), 500
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute('SELECT id, status, borrow_qr_used_at FROM borrow_batches WHERE id=%s FOR UPDATE', (batch_id,))
        batch = cur.fetchone()
        if not batch:
            conn.rollback()
            return jsonify({'message': 'Batch not found.'}), 404
        cur.execute('SELECT batch_id FROM librarian_release_resolutions WHERE batch_id=%s', (batch_id,))
        resolved = cur.fetchone()
        cur.execute("SELECT id FROM librarian_qr_scan_events WHERE batch_id=%s AND qr_type='borrow' LIMIT 1", (batch_id,))
        scanned = cur.fetchone()
        if not scanned or resolved or batch['borrow_qr_used_at'] is not None or batch['status'] != 'approved':
            conn.rollback()
            return jsonify({'message': 'This batch is not an unresolved pending release.'}), 409
        if action == 'handed_over':
            cur.execute("SELECT SUM(status='approved') AS approved, SUM(status='pending') AS pending FROM borrow_requests WHERE batch_id=%s", (batch_id,))
            counts = cur.fetchone()
            if not counts or not counts['approved'] or counts['pending']:
                conn.rollback()
                return jsonify({'message': 'All requests must be decided, with at least one approved.'}), 409
            cur.execute('''UPDATE borrow_batches SET borrow_qr_used_at=%s,
                           loan_days=1, due_date=DATE_ADD(%s, INTERVAL 24 HOUR)
                           WHERE id=%s AND borrow_qr_used_at IS NULL''', (handover, handover, batch_id))
            if cur.rowcount != 1:
                conn.rollback()
                return jsonify({'message': 'Batch was already released.'}), 409
        cur.execute('''INSERT INTO librarian_release_resolutions
                       (batch_id, disposition, resolved_by, actual_handover_at, note)
                       VALUES (%s,%s,%s,%s,%s)''',
                    (batch_id, action, request.authenticated_user_id, handover, note or None))
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Books released successfully. Resolution recorded in the audit log.', 'batch_id': batch_id})
    except Exception:
        conn.rollback()
        log.exception('Pending release recovery failed')
        return jsonify({'message': 'Could not resolve pending release.'}), 500
    finally:
        cur.close()
        conn.close()

@bp.route('/api/librarian/pending-returns/<int:batch_id>/resolve', methods=['POST'])
@require_role('librarian')
def resolve_pending_return(batch_id):
    '''Confirm selected outstanding books for a previously scanned Return QR.

    This recovery path is deliberately restricted to batches with a recorded
    successful Return QR scan and selected outstanding request IDs. It is used when the librarian leaves the scan
    result page before confirming and the student can no longer show the old
    QR token. The librarian must explicitly confirm physical receipt.
    '''
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or data.get('action') != 'returned':
        return jsonify({'message': 'A confirmed return action is required.'}), 400

    raw_request_ids = data.get('request_ids')
    if not isinstance(raw_request_ids, list) or not raw_request_ids:
        return jsonify({'message': 'Select at least one book to confirm as returned.'}), 400

    request_ids = []
    for value in raw_request_ids:
        try:
            request_id = int(value)
        except (TypeError, ValueError):
            return jsonify({'message': 'Every selected request ID must be a valid integer.'}), 400
        if request_id <= 0:
            return jsonify({'message': 'Every selected request ID must be positive.'}), 400
        request_ids.append(request_id)
    if len(set(request_ids)) != len(request_ids):
        return jsonify({'message': 'Duplicate book selections are not allowed.'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database unavailable.'}), 500

    cur = conn.cursor(dictionary=True)
    student_email = None
    student_name = None
    due_date = None
    returned_books = []

    try:
        # Lock the batch first, matching the normal QR return transaction.
        cur.execute('''
            SELECT bb.id, bb.user_id, bb.status, bb.borrow_qr_used_at,
                   bb.return_qr_used_at, bb.due_date,
                   u.name AS student_name, u.email AS student_email
            FROM borrow_batches bb
            INNER JOIN users u ON u.id = bb.user_id
            WHERE bb.id = %s
            FOR UPDATE
        ''', (batch_id,))
        batch = cur.fetchone()
        if not batch:
            conn.rollback()
            return jsonify({'message': 'Borrowing batch not found.'}), 404

        if (batch['status'] not in ('approved', 'partially_returned')
                or batch['borrow_qr_used_at'] is None
                or batch['return_qr_used_at'] is not None):
            conn.rollback()
            return jsonify({'message': 'This batch is not awaiting a return confirmation.'}), 409

        # Do not allow a manual inventory adjustment for an arbitrary batch.
        # The persisted Return QR scan is the evidence that this batch entered
        # the librarian's return-verification workflow.
        cur.execute('''
            SELECT id
            FROM librarian_qr_scan_events
            WHERE batch_id = %s AND qr_type = 'return'
            ORDER BY scanned_at DESC, id DESC
            LIMIT 1
        ''', (batch_id,))
        scan_event = cur.fetchone()
        if not scan_event:
            conn.rollback()
            return jsonify({'message': 'No successful Return QR scan was found for this batch.'}), 409

        placeholders = ','.join(['%s'] * len(request_ids))
        cur.execute(
            f'''SELECT id AS request_id, book_id
                FROM borrow_requests
                WHERE batch_id = %s
                  AND status = 'approved'
                  AND returned_at IS NULL
                  AND id IN ({placeholders})
                ORDER BY id ASC
                FOR UPDATE''',
            tuple([batch_id] + request_ids),
        )
        returnable = cur.fetchall()
        if not returnable:
            conn.rollback()
            return jsonify({'message': 'There are no selected outstanding books to confirm.'}), 409
        if len(returnable) != len(request_ids):
            conn.rollback()
            return jsonify({'message': 'One or more selected books are no longer outstanding in this batch. Refresh QR History and try again.'}), 409

        book_ids = [int(row['book_id']) for row in returnable]
        if len(set(book_ids)) != len(book_ids):
            conn.rollback()
            log.error('Duplicate book entries in pending return recovery: batch_id=%s', batch_id)
            return jsonify({
                'message': 'This batch contains duplicate book entries. No inventory was changed. Please ask the administrator to review the batch.'
            }), 409

        placeholders = ','.join(['%s'] * len(book_ids))
        cur.execute(
            f'''SELECT id, title, quantity, available_quantity
                FROM books
                WHERE id IN ({placeholders})
                ORDER BY id ASC
                FOR UPDATE''',
            tuple(sorted(book_ids)),
        )
        locked_books = {int(row['id']): row for row in cur.fetchall()}
        if len(locked_books) != len(book_ids):
            conn.rollback()
            return jsonify({'message': 'One or more books in this batch no longer exist.'}), 409

        # Validate all inventory rows before changing any of them.
        for book_id in book_ids:
            book = locked_books[book_id]
            if int(book['available_quantity']) >= int(book['quantity']):
                conn.rollback()
                log.error(
                    'Inventory invariant failed during pending return recovery: batch_id=%s book_id=%s',
                    batch_id, book_id,
                )
                return jsonify({
                    'message': 'Inventory count is inconsistent for one of the books. No return was processed. Contact the administrator.'
                }), 409

        for item in returnable:
            book_id = int(item['book_id'])
            book = locked_books[book_id]
            cur.execute('''
                UPDATE books
                SET available_quantity = available_quantity + 1,
                    status = 'available'
                WHERE id = %s AND available_quantity < quantity
            ''', (book_id,))
            if cur.rowcount != 1:
                conn.rollback()
                return jsonify({
                    'message': 'Inventory changed while processing the return. Refresh QR History and try again.'
                }), 409

            cur.execute('''
                UPDATE borrow_requests
                SET returned_at = UTC_TIMESTAMP()
                WHERE id = %s
                  AND status = 'approved'
                  AND returned_at IS NULL
            ''', (item['request_id'],))
            if cur.rowcount != 1:
                conn.rollback()
                return jsonify({'message': 'One of these books was already returned. No recovery was saved.'}), 409

            returned_books.append({'book_id': book_id, 'title': book['title']})

        cur.execute('''
            SELECT COUNT(*) AS outstanding_count
            FROM borrow_requests
            WHERE batch_id = %s
              AND status = 'approved'
              AND returned_at IS NULL
        ''', (batch_id,))
        remaining = int((cur.fetchone() or {}).get('outstanding_count') or 0)

        if remaining == 0:
            cur.execute('''
                UPDATE borrow_batches
                SET status = 'returned',
                    return_qr_used_at = UTC_TIMESTAMP()
                WHERE id = %s AND return_qr_used_at IS NULL
            ''', (batch_id,))
            if cur.rowcount != 1:
                conn.rollback()
                return jsonify({'message': 'This batch return was already completed.'}), 409
            new_status = 'returned'
        else:
            # Defensive fallback; this endpoint processes all outstanding rows,
            # so this branch should only be reached if future partial-recovery
            # behavior is introduced.
            cur.execute('UPDATE borrow_batches SET status = %s WHERE id = %s',
                        ('partially_returned', batch_id))
            new_status = 'partially_returned'

        student_email = batch['student_email']
        student_name = batch['student_name']
        due_date = batch['due_date']
        conn.commit()

        try:
            send_borrow_status_email(
                student_email=student_email,
                student_name=student_name,
                status=new_status,
                book_titles=[item['title'] for item in returned_books],
                due_date=due_date,
            )
        except Exception:
            log.exception('Return recovery notification email failed after commit')

        return jsonify({
            'status': 'success',
            'message': 'Return confirmed successfully from QR History. Inventory has been restored.',
            'batch_id': batch_id,
            'batch_status': new_status,
            'returned_books': returned_books,
            'remaining_books': remaining,
        }), 200

    except Exception:
        conn.rollback()
        log.exception('Pending return recovery failed for batch_id=%s', batch_id)
        return jsonify({'message': 'Could not confirm this pending return.'}), 500
    finally:
        cur.close()
        conn.close()
