"""Persistent QR scan audit and manual release recovery for LibSync."""
import logging
from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request
from database import get_db_connection
from .auth import require_role

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
        return jsonify({'status': 'success', 'events': events, 'pending': pending})
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
