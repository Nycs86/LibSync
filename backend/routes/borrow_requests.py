import hmac
import logging
import uuid
import qrcode
import io
import base64

from flask import Blueprint, jsonify, request
from database import get_db_connection
from email_service import send_borrow_status_email
from .auth import require_role
logger = logging.getLogger(__name__)

borrow_requests_bp = Blueprint("borrow_requests", __name__)


def _send_status_email_safely(**kwargs):
    """Send notification after commit without misreporting a committed action."""
    try:
        send_borrow_status_email(**kwargs)
    except Exception:
        logger.exception("Borrowing notification email failed after database commit")


def _tokens_match(provided_token, stored_token):
    """Compare QR tokens without short-circuiting on the first differing byte."""
    if not isinstance(provided_token, str) or not isinstance(stored_token, str):
        return False
    return hmac.compare_digest(provided_token, stored_token)


def _current_qr_for_batch(batch):
    """Return the currently valid QR token and its type for a batch."""
    if (
        batch.get("status") == "approved"
        and batch.get("borrow_qr_token")
        and batch.get("borrow_qr_used_at") is None
    ):
        return batch["borrow_qr_token"], "borrow"

    if (
        batch.get("status") in ("approved", "partially_returned")
        and batch.get("borrow_qr_used_at") is not None
        and batch.get("return_qr_token")
        and batch.get("return_qr_used_at") is None
    ):
        return batch["return_qr_token"], "return"

    return None, None


# =========================================================
# CREATE BORROW REQUEST / BATCH
# =========================================================
@borrow_requests_bp.route("/api/borrow-requests", methods=["POST"])
@require_role("student")
def create_borrow_request():
    data = request.get_json(silent=True) or {}
    user_id = request.authenticated_user_id
    requested_user_id = data.get("user_id")

    if requested_user_id is not None:
        try:
            if int(requested_user_id) != int(user_id):
                return jsonify({
                    "status": "error",
                    "message": "You can only create borrow requests for your own account."
                }), 403
        except (TypeError, ValueError):
            return jsonify({
                "status": "error",
                "message": "Invalid user_id."
            }), 400

    try:
        loan_days = int(data.get("loan_days", 1))
    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "message": "Return period must be between 1 and 5 days."
        }), 400

    if not 1 <= loan_days <= 5:
        return jsonify({
            "status": "error",
            "message": "Return period must be between 1 and 5 days."
        }), 400

    raw_book_ids = data.get("book_ids")
    if not raw_book_ids:
        single_book_id = data.get("book_id")
        if single_book_id is not None:
            raw_book_ids = [single_book_id]

    if not isinstance(raw_book_ids, list) or not raw_book_ids:
        return jsonify({
            "status": "error",
            "message": "book_ids must be a non-empty list."
        }), 400

    book_ids = []
    for value in raw_book_ids:
        try:
            book_id = int(value)
        except (TypeError, ValueError):
            return jsonify({
                "status": "error",
                "message": "Every book_id must be a valid integer."
            }), 400
        if book_id <= 0:
            return jsonify({
                "status": "error",
                "message": "Every book_id must be a positive integer."
            }), 400
        book_ids.append(book_id)

    # One request per distinct book in a batch.
    book_ids = list(dict.fromkeys(book_ids))

    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT id, name, email, role
            FROM users
            WHERE id = %s
            LIMIT 1
        """, (user_id,))
        student = cursor.fetchone()

        if not student or student["role"] != "student":
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "Only students can create borrow requests."
            }), 403

        placeholders = ",".join(["%s"] * len(book_ids))
        cursor.execute(
            f"""
            SELECT id, title, available_quantity
            FROM books
            WHERE id IN ({placeholders})
            ORDER BY id ASC
            """,
            tuple(book_ids)
        )
        books = cursor.fetchall()

        if len(books) != len(book_ids):
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "One or more selected books do not exist."
            }), 404

        unavailable = [
            book["title"] for book in books
            if int(book["available_quantity"]) <= 0
        ]
        if unavailable:
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "Some selected books are currently unavailable.",
                "books": unavailable
            }), 409

        # Pending requests do not reserve stock. Final availability is checked
        # under a row lock at the librarian approval step.
        cursor.execute(
            f"""
            SELECT b.title
            FROM borrow_requests br
            INNER JOIN books b ON b.id = br.book_id
            WHERE br.user_id = %s
              AND br.book_id IN ({placeholders})
              AND br.status = 'pending'
            """,
            tuple([user_id] + book_ids)
        )
        existing = cursor.fetchall()

        if existing:
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "You already have pending requests for some selected books.",
                "books": [item["title"] for item in existing]
            }), 409

        cursor.execute("""
            INSERT INTO borrow_batches (user_id, status, loan_days, due_date)
            VALUES (%s, 'pending', %s, NULL)
        """, (user_id, loan_days))
        batch_id = cursor.lastrowid

        request_ids = []
        for book_id in book_ids:
            cursor.execute("""
                INSERT INTO borrow_requests (batch_id, user_id, book_id, status)
                VALUES (%s, %s, %s, 'pending')
            """, (batch_id, user_id, book_id))
            request_ids.append(cursor.lastrowid)

        conn.commit()

        _send_status_email_safely(
            student_email=student["email"],
            student_name=student["name"],
            status="pending",
            book_titles=[book["title"] for book in books],
        )

        return jsonify({
            "status": "success",
            "message": "Borrow batch submitted successfully.",
            "batch_id": batch_id,
            "request_ids": request_ids,
            "total_books": len(book_ids),
            "loan_days": loan_days,
            "due_date": None,
            "qr_available": False,
            "qr_type": None,
            "qr_payload": None
        }), 201

    except Exception:
        conn.rollback()
        logger.exception("Create borrow batch failed")
        return jsonify({
            "status": "error",
            "message": "Unable to submit borrow request right now. Please try again."
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# GET ALL BORROW REQUESTS
# =========================================================
@borrow_requests_bp.route("/api/borrow-requests", methods=["GET"])
@require_role("admin", "librarian")
def get_borrow_requests():
    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                br.id,
                br.batch_id,
                br.user_id,
                u.name AS user_name,
                u.email AS user_email,
                br.book_id,
                b.title AS book_title,
                br.requested_at,
                br.status,
                br.approved_by,
                br.approved_at,
                br.returned_at,
                bb.status AS batch_status,
                bb.borrow_qr_token,
                bb.return_qr_token,
                bb.borrow_qr_used_at,
                bb.return_qr_used_at,
                bb.loan_days,
                bb.due_date
            FROM borrow_requests br
            INNER JOIN users u ON br.user_id = u.id
            INNER JOIN books b ON br.book_id = b.id
            LEFT JOIN borrow_batches bb ON br.batch_id = bb.id
            ORDER BY br.requested_at DESC
        """)
        requests_list = cursor.fetchall()

        for item in requests_list:
            token, qr_type = _current_qr_for_batch({
                "status": item.get("batch_status"),
                "borrow_qr_token": item.get("borrow_qr_token"),
                "return_qr_token": item.get("return_qr_token"),
                "borrow_qr_used_at": item.get("borrow_qr_used_at"),
                "return_qr_used_at": item.get("return_qr_used_at"),
            })
            # Keep these old response keys so current frontend code keeps working.
            item["qr_token"] = token
            item["qr_type"] = qr_type
            item["qr_available"] = token is not None

        return jsonify({
            "status": "success",
            "requests": requests_list
        }), 200

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# BORROW RECORDS
# =========================================================
@borrow_requests_bp.route("/api/borrow-records", methods=["GET"])
@require_role("admin", "librarian")
def get_borrow_records():
    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                br.id AS request_id,
                br.batch_id,
                br.user_id,
                u.name AS student_name,
                u.email AS student_email,
                br.book_id,
                b.title AS book_title,
                br.requested_at,
                COALESCE(bb.borrow_qr_used_at, br.approved_at, br.requested_at) AS borrow_date,
                br.approved_at,
                br.returned_at,
                bb.due_date,
                br.status AS request_status,
                CASE
                    WHEN br.returned_at IS NOT NULL THEN 'returned'
                    WHEN bb.borrow_qr_used_at IS NOT NULL
                         AND bb.due_date IS NOT NULL
                         AND bb.due_date < CURDATE() THEN 'overdue'
                    WHEN bb.borrow_qr_used_at IS NOT NULL THEN 'borrowed'
                    WHEN br.status = 'approved' THEN 'approved'
                    ELSE LOWER(br.status)
                END AS status
            FROM borrow_requests br
            INNER JOIN users u ON u.id = br.user_id
            INNER JOIN books b ON b.id = br.book_id
            LEFT JOIN borrow_batches bb ON bb.id = br.batch_id
            WHERE br.status = 'approved'
            ORDER BY COALESCE(bb.borrow_qr_used_at, br.approved_at, br.requested_at) DESC, br.id DESC
        """)
        records = cursor.fetchall()

        return jsonify({
            "status": "success",
            "records": records
        }), 200

    except Exception as error:
        print("Load borrowing records error:", error)
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve borrowing records."
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# LIBRARIAN APPROVES / DECLINES ONE REQUEST
# =========================================================
@borrow_requests_bp.route(
    "/api/borrow-requests/<int:request_id>/decision",
    methods=["PUT"]
)
@require_role("librarian")
def decide_borrow_request(request_id):
    data = request.get_json(silent=True) or {}
    librarian_id = request.authenticated_user_id
    decision = data.get("decision")

    if decision not in ("approved", "declined"):
        return jsonify({
            "status": "error",
            "message": "Decision must be approved or declined."
        }), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:
        # Discover the batch, then lock the batch first. All decisions in one
        # batch are serialized so the final decision cannot race another one.
        cursor.execute(
            "SELECT batch_id FROM borrow_requests WHERE id = %s LIMIT 1",
            (request_id,)
        )
        request_ref = cursor.fetchone()
        if not request_ref:
            conn.rollback()
            return jsonify({"status": "error", "message": "Borrow request not found."}), 404

        batch_id = request_ref["batch_id"]
        if batch_id is None:
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "This request is not connected to a borrow batch."
            }), 409

        cursor.execute("""
            SELECT id, status, borrow_qr_token
            FROM borrow_batches
            WHERE id = %s
            FOR UPDATE
        """, (batch_id,))
        batch = cursor.fetchone()
        if not batch:
            conn.rollback()
            return jsonify({"status": "error", "message": "Borrow batch not found."}), 404

        cursor.execute("""
            SELECT id, batch_id, user_id, book_id, status
            FROM borrow_requests
            WHERE id = %s AND batch_id = %s
            FOR UPDATE
        """, (request_id, batch_id))
        borrow_request = cursor.fetchone()

        if not borrow_request:
            conn.rollback()
            return jsonify({"status": "error", "message": "Borrow request not found."}), 404

        cursor.execute("""
            SELECT name AS student_name, email AS student_email
            FROM users
            WHERE id = %s
            LIMIT 1
        """, (borrow_request["user_id"],))
        student = cursor.fetchone()
        if not student:
            conn.rollback()
            return jsonify({"status": "error", "message": "Student account not found."}), 404

        if borrow_request["status"] != "pending":
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "This request has already been processed."
            }), 409

        if batch["status"] != "pending":
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "This batch is no longer accepting decisions."
            }), 409

        if decision == "approved":
            # Lock the book row and perform a guarded decrement. This prevents
            # two different batches from approving the same final copy.
            cursor.execute("""
                SELECT id, title, quantity, available_quantity
                FROM books
                WHERE id = %s
                FOR UPDATE
            """, (borrow_request["book_id"],))
            book = cursor.fetchone()

            if not book:
                conn.rollback()
                return jsonify({"status": "error", "message": "Book not found."}), 404

            borrow_request["title"] = book["title"]

            if int(book["available_quantity"]) <= 0:
                conn.rollback()
                return jsonify({
                    "status": "error",
                    "message": "Book is no longer available. You may decline this request instead.",
                    "book_id": book["id"],
                    "available_quantity": 0
                }), 409

            cursor.execute("""
                UPDATE books
                SET
                    available_quantity = available_quantity - 1,
                    status = CASE
                        WHEN available_quantity - 1 <= 0 THEN 'unavailable'
                        ELSE 'available'
                    END
                WHERE id = %s
                  AND available_quantity > 0
            """, (borrow_request["book_id"],))

            if cursor.rowcount != 1:
                conn.rollback()
                return jsonify({
                    "status": "error",
                    "message": "Book availability changed. Refresh and try again."
                }), 409

        if decision == "declined":
            cursor.execute("SELECT title FROM books WHERE id = %s", (borrow_request["book_id"],))
            book_title = cursor.fetchone()
            borrow_request["title"] = book_title["title"] if book_title else "Unknown book"

        cursor.execute("""
            UPDATE borrow_requests
            SET status = %s,
                approved_by = %s,
                approved_at = NOW()
            WHERE id = %s
              AND status = 'pending'
        """, (decision, librarian_id, request_id))

        if cursor.rowcount != 1:
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "This request was already processed by another action."
            }), 409

        cursor.execute("""
            SELECT
                COUNT(*) AS total_requests,
                COALESCE(SUM(status = 'pending'), 0) AS pending_count,
                COALESCE(SUM(status = 'approved'), 0) AS approved_count,
                COALESCE(SUM(status = 'declined'), 0) AS declined_count
            FROM borrow_requests
            WHERE batch_id = %s
        """, (batch_id,))
        summary = cursor.fetchone()

        borrow_qr_token = None
        batch_status = "pending"
        pending_count = int(summary["pending_count"] or 0)
        approved_count = int(summary["approved_count"] or 0)
        declined_count = int(summary["declined_count"] or 0)

        # A QR is created only once all requests in the batch have a decision.
        if pending_count == 0:
            if approved_count > 0:
                borrow_qr_token = batch.get("borrow_qr_token") or str(uuid.uuid4())
                cursor.execute("""
                    UPDATE borrow_batches
                    SET
                        status = 'approved',
                        borrow_qr_token = %s,
                        approved_by = %s,
                        approved_at = NOW(),
                        due_date = NULL
                    WHERE id = %s
                """, (borrow_qr_token, librarian_id, batch_id))
                batch_status = "approved"
            else:
                cursor.execute("""
                    UPDATE borrow_batches
                    SET
                        status = 'declined',
                        approved_by = %s,
                        approved_at = NOW(),
                        borrow_qr_token = NULL,
                        return_qr_token = NULL,
                        due_date = NULL
                    WHERE id = %s
                """, (librarian_id, batch_id))
                batch_status = "declined"

        conn.commit()

        _send_status_email_safely(
            student_email=student["student_email"],
            student_name=student["student_name"],
            status=decision,
            book_titles=[borrow_request["title"]],
        )

        return jsonify({
            "status": "success",
            "message": "Borrow request approved." if decision == "approved" else "Borrow request declined.",
            "request_id": request_id,
            "batch_id": batch_id,
            "decision": decision,
            "batch_status": batch_status,
            "pending_requests": pending_count,
            "approved_requests": approved_count,
            "declined_requests": declined_count,
            "qr_available": borrow_qr_token is not None,
            "qr_type": "borrow" if borrow_qr_token else None,
            "qr_token": borrow_qr_token,
            "borrow_qr_token": borrow_qr_token
        }), 200

    except Exception:
        conn.rollback()
        logger.exception("Borrow request decision failed")
        return jsonify({
            "status": "error",
            "message": "Unable to process this borrowing decision right now."
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# GET BORROW BATCHES FOR A SPECIFIC STUDENT
# =========================================================
@borrow_requests_bp.route(
    "/api/student/borrow-batches/<int:user_id>",
    methods=["GET"]
)
@require_role("student")
def get_student_borrow_batches(user_id):
    authenticated_user_id = request.authenticated_user_id

    if authenticated_user_id != user_id:
        return jsonify({
            "status": "error",
            "message": "You are not allowed to view this student's borrow batches."
        }), 403

    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                id,
                user_id,
                borrow_qr_token,
                return_qr_token,
                borrow_qr_used_at,
                return_qr_used_at,
                status,
                requested_at,
                approved_by,
                approved_at,
                loan_days,
                due_date
            FROM borrow_batches
            WHERE user_id = %s
            ORDER BY requested_at DESC
        """, (user_id,))
        batches = cursor.fetchall()

        for batch in batches:
            cursor.execute("""
                SELECT
                    br.id AS request_id,
                    br.book_id,
                    b.title,
                    b.author,
                    CASE
                        WHEN br.returned_at IS NOT NULL THEN 'returned'
                        ELSE br.status
                    END AS status,
                    br.returned_at
                FROM borrow_requests br
                INNER JOIN books b ON br.book_id = b.id
                WHERE br.batch_id = %s
                ORDER BY br.id ASC
            """, (batch["id"],))
            batch["books"] = cursor.fetchall()

            token, qr_type = _current_qr_for_batch(batch)
            batch["qr_available"] = token is not None
            batch["qr_type"] = qr_type
            # Backward-compatible key.
            batch["qr_token"] = token

        return jsonify({
            "status": "success",
            "batches": batches
        }), 200

    except Exception:
        logger.exception("Unable to retrieve student borrow batches")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve borrowing batches right now."
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# GET BORROW REQUESTS FOR A SPECIFIC STUDENT
# =========================================================
@borrow_requests_bp.route(
    "/api/student/borrow-requests/<int:user_id>",
    methods=["GET"]
)
@require_role("student")
def get_student_borrow_requests(user_id):
    if request.authenticated_user_id != user_id:
        return jsonify({
            "status": "error",
            "message": "You are not allowed to view another student's borrow requests."
        }), 403

    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT id, name FROM users WHERE id = %s",
            (user_id,)
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({
                "status": "error",
                "message": "User not found."
            }), 404

        cursor.execute("""
            SELECT
                br.id,
                br.batch_id,
                br.user_id,
                br.book_id,
                b.title AS book_title,
                CASE
                    WHEN br.returned_at IS NOT NULL THEN 'returned'
                    ELSE br.status
                END AS status,
                br.requested_at,
                br.approved_by,
                br.approved_at,
                br.returned_at,
                bb.status AS batch_status,
                bb.loan_days,
                bb.due_date,
                bb.borrow_qr_token,
                bb.return_qr_token,
                bb.borrow_qr_used_at,
                bb.return_qr_used_at
            FROM borrow_requests br
            INNER JOIN books b ON br.book_id = b.id
            LEFT JOIN borrow_batches bb ON bb.id = br.batch_id
            WHERE br.user_id = %s
            ORDER BY br.requested_at DESC
        """, (user_id,))
        requests_list = cursor.fetchall()

        for item in requests_list:
            token, qr_type = _current_qr_for_batch({
                "status": item.get("batch_status"),
                "borrow_qr_token": item.get("borrow_qr_token"),
                "return_qr_token": item.get("return_qr_token"),
                "borrow_qr_used_at": item.get("borrow_qr_used_at"),
                "return_qr_used_at": item.get("return_qr_used_at"),
            })
            item["qr_available"] = token is not None
            item["qr_type"] = qr_type
            item["qr_token"] = token

        return jsonify({
            "status": "success",
            "user_id": user_id,
            "requests": requests_list
        }), 200

    except Exception:
        logger.exception("Unable to retrieve student borrow requests")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve borrow requests right now."
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# GENERATE CURRENT VALID QR CODE FOR STUDENT
# =========================================================
@borrow_requests_bp.route(
    "/api/borrow-batches/<int:batch_id>/qr",
    methods=["GET"]
)
@require_role("student")
def generate_batch_qr(batch_id):
    student_id = request.authenticated_user_id

    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                bb.id,
                bb.user_id,
                bb.borrow_qr_token,
                bb.return_qr_token,
                bb.borrow_qr_used_at,
                bb.return_qr_used_at,
                bb.status,
                bb.requested_at,
                bb.approved_at,
                bb.loan_days,
                bb.due_date,
                u.name AS student_name,
                u.email AS student_email
            FROM borrow_batches bb
            INNER JOIN users u ON bb.user_id = u.id
            WHERE bb.id = %s
        """, (batch_id,))
        batch = cursor.fetchone()

        if not batch:
            return jsonify({
                "status": "error",
                "message": "Borrow batch not found."
            }), 404

        if batch["user_id"] != student_id:
            return jsonify({
                "status": "error",
                "message": "You are not allowed to access this QR code."
            }), 403

        if batch["status"] == "declined":
            return jsonify({
                "status": "error",
                "message": "This borrow batch was declined."
            }), 400

        cursor.execute("""
            SELECT
                COUNT(*) AS total_count,
                COALESCE(SUM(status = 'pending'), 0) AS pending_count,
                COALESCE(SUM(status = 'approved'), 0) AS approved_count,
                COALESCE(SUM(status = 'approved' AND returned_at IS NULL), 0) AS outstanding_count
            FROM borrow_requests
            WHERE batch_id = %s
        """, (batch_id,))
        counts = cursor.fetchone() or {}

        qr_token, qr_type = _current_qr_for_batch(batch)

        if not qr_token:
            return jsonify({
                "status": "error",
                "message": "QR code is not available for this batch yet."
            }), 400

        total_count = int(counts.get("total_count") or 0)
        pending_count = int(counts.get("pending_count") or 0)
        approved_count = int(counts.get("approved_count") or 0)
        outstanding_count = int(counts.get("outstanding_count") or 0)

        if total_count <= 0 or pending_count > 0:
            return jsonify({
                "status": "error",
                "message": "This batch is not ready for QR processing. Please wait until all requests are decided."
            }), 409

        if qr_type == "borrow" and approved_count <= 0:
            return jsonify({
                "status": "error",
                "message": "There are no approved books available for borrowing."
            }), 409

        if qr_type == "return" and outstanding_count <= 0:
            return jsonify({
                "status": "error",
                "message": "There are no outstanding books to return."
            }), 409

        cursor.execute("""
            SELECT
                br.id AS request_id,
                br.book_id,
                b.title,
                b.author,
                CASE
                    WHEN br.returned_at IS NOT NULL THEN 'returned'
                    ELSE br.status
                END AS status
            FROM borrow_requests br
            INNER JOIN books b ON br.book_id = b.id
            WHERE br.batch_id = %s
            ORDER BY br.id ASC
        """, (batch_id,))
        books = cursor.fetchall()

        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(qr_token)
        qr.make(fit=True)

        qr_image = qr.make_image()
        image_bytes = io.BytesIO()
        qr_image.save(image_bytes, format="PNG")
        image_bytes.seek(0)
        qr_base64 = base64.b64encode(image_bytes.getvalue()).decode("utf-8")

        return jsonify({
            "status": "success",
            "batch": {
                "id": batch["id"],
                "student_id": batch["user_id"],
                "student_name": batch["student_name"],
                "student_email": batch["student_email"],
                "status": batch["status"],
                "requested_at": batch["requested_at"],
                "approved_at": batch["approved_at"],
                "loan_days": batch["loan_days"],
                "due_date": batch["due_date"]
            },
            "books": books,
            "qr_type": qr_type,
            "qr_token": qr_token,
            "qr_code": f"data:image/png;base64,{qr_base64}"
        }), 200

    except Exception:
        logger.exception("Unable to generate student batch QR")
        return jsonify({
            "status": "error",
            "message": "Unable to generate the QR code right now."
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# LOOK UP A BATCH USING EITHER BORROW OR RETURN QR
# =========================================================
@borrow_requests_bp.route(
    "/api/borrow-batches/lookup",
    methods=["POST"]
)
@require_role("librarian")
def lookup_borrow_batch_by_qr():
    data = request.get_json(silent=True) or {}
    qr_token = data.get("qr_token")

    if not isinstance(qr_token, str) or not qr_token.strip():
        return jsonify({
            "status": "error",
            "message": "A valid QR token is required."
        }), 400

    qr_token = qr_token.strip()

    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                bb.id,
                bb.user_id,
                bb.status,
                bb.borrow_qr_token,
                bb.return_qr_token,
                bb.borrow_qr_used_at,
                bb.return_qr_used_at,
                bb.requested_at,
                bb.approved_by,
                bb.approved_at,
                bb.loan_days,
                bb.due_date,
                u.name AS student_name,
                u.email AS student_email
            FROM borrow_batches bb
            INNER JOIN users u ON u.id = bb.user_id
            WHERE bb.borrow_qr_token = %s
               OR bb.return_qr_token = %s
            LIMIT 1
        """, (qr_token, qr_token))
        batch = cursor.fetchone()

        if not batch:
            return jsonify({
                "status": "error",
                "message": "Invalid QR code. Borrowing batch not found."
            }), 404

        is_borrow_qr = _tokens_match(qr_token, batch.get("borrow_qr_token"))
        is_return_qr = _tokens_match(qr_token, batch.get("return_qr_token"))

        if is_borrow_qr == is_return_qr:
            # Both false means no exact token match; both true means the same
            # token was incorrectly stored as both QR types in one batch.
            logger.warning("Ambiguous or mismatched QR token state for batch_id=%s", batch["id"])
            return jsonify({
                "status": "error",
                "message": "This QR code is invalid or its state is inconsistent."
            }), 409

        if is_borrow_qr:
            qr_type = "borrow"
            qr_used = batch.get("borrow_qr_used_at") is not None
        else:
            qr_type = "return"
            qr_used = batch.get("return_qr_used_at") is not None

        cursor.execute("""
            SELECT
                br.id AS request_id,
                br.batch_id,
                br.user_id,
                br.book_id,
                b.title AS book_title,
                b.author,
                CASE
                    WHEN br.returned_at IS NOT NULL THEN 'returned'
                    ELSE br.status
                END AS status,
                br.requested_at,
                br.approved_by,
                br.approved_at,
                br.returned_at
            FROM borrow_requests br
            INNER JOIN books b ON b.id = br.book_id
            WHERE br.batch_id = %s
            ORDER BY br.id ASC
        """, (batch["id"],))
        batch_requests = cursor.fetchall()

        batch["requests"] = batch_requests
        batch["total_books"] = len(batch_requests)
        batch["qr_type"] = qr_type
        batch["qr_used"] = qr_used
        # Backward-compatible key used by scanner UI.
        batch["qr_token"] = qr_token

        return jsonify({
            "status": "success",
            "message": "Borrowing batch found.",
            "qr_type": qr_type,
            "qr_used": qr_used,
            "batch": batch
        }), 200

    except Exception:
        logger.exception("QR batch lookup failed")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve the borrowing batch."
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# RELEASE APPROVED BOOKS USING BORROW QR
# =========================================================
@borrow_requests_bp.route(
    "/api/borrow-batches/<int:batch_id>/release",
    methods=["PUT"]
)
@require_role("librarian")
def release_borrow_batch(batch_id):
    data = request.get_json(silent=True) or {}
    scanned_token = data.get("qr_token")

    if not isinstance(scanned_token, str) or not scanned_token.strip():
        return jsonify({
            "status": "error",
            "message": "Scan the Borrow QR code before releasing the books."
        }), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed."}), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT id, user_id, status, borrow_qr_token, borrow_qr_used_at,
                   return_qr_token, loan_days, due_date
            FROM borrow_batches
            WHERE id = %s
            FOR UPDATE
        """, (batch_id,))
        batch = cursor.fetchone()

        if not batch:
            conn.rollback()
            return jsonify({"status": "error", "message": "Borrowing batch not found."}), 404

        if batch["status"] != "approved":
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "Only approved borrowing batches can be released."
            }), 409

        if not batch["borrow_qr_token"]:
            conn.rollback()
            return jsonify({"status": "error", "message": "Borrow QR is not available."}), 400

        if batch["borrow_qr_used_at"] is not None:
            conn.rollback()
            return jsonify({"status": "error", "message": "Borrow QR has already been used."}), 409

        if not _tokens_match(scanned_token.strip(), batch["borrow_qr_token"]):
            conn.rollback()
            return jsonify({"status": "error", "message": "Invalid Borrow QR token."}), 400

        cursor.execute("""
            SELECT
                COALESCE(SUM(status = 'approved'), 0) AS approved_count,
                COALESCE(SUM(status = 'pending'), 0) AS pending_count
            FROM borrow_requests
            WHERE batch_id = %s
        """, (batch_id,))
        batch_counts = cursor.fetchone() or {}
        approved_count = int(batch_counts.get("approved_count") or 0)
        pending_count = int(batch_counts.get("pending_count") or 0)

        if approved_count <= 0 or pending_count > 0:
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "This batch is not ready for release. All requests must be decided and at least one book must be approved."
            }), 409

        return_qr_token = batch["return_qr_token"] or str(uuid.uuid4())
        cursor.execute("""
            UPDATE borrow_batches
            SET
                borrow_qr_used_at = NOW(),
                return_qr_token = %s,
                due_date = DATE_ADD(CURDATE(), INTERVAL loan_days DAY)
            WHERE id = %s
              AND borrow_qr_used_at IS NULL
        """, (return_qr_token, batch_id))

        if cursor.rowcount != 1:
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "This Borrow QR has already been processed."
            }), 409

        conn.commit()

        return jsonify({
            "status": "success",
            "message": "Books released successfully.",
            "batch_id": batch_id,
            "borrow_qr_used": True,
            "return_qr_available": True,
            "return_qr_token": return_qr_token
        }), 200

    except Exception:
        conn.rollback()
        logger.exception("Release borrowing batch failed")
        return jsonify({
            "status": "error",
            "message": "Unable to release this borrowing batch right now."
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# RETURN BOOKS USING RETURN QR / BATCH
# =========================================================
@borrow_requests_bp.route(
    "/api/borrow-batches/<int:batch_id>/return",
    methods=["PUT"]
)
@require_role("librarian")
def return_borrow_batch_by_qr(batch_id):
    data = request.get_json(silent=True) or {}
    raw_book_ids = data.get("book_ids")
    scanned_token = data.get("qr_token")

    if not isinstance(scanned_token, str) or not scanned_token.strip():
        return jsonify({
            "status": "error",
            "message": "Scan the Return QR code before processing returns."
        }), 400

    requested_book_ids = None
    if raw_book_ids is not None:
        if not isinstance(raw_book_ids, list) or not raw_book_ids:
            return jsonify({
                "status": "error",
                "message": "book_ids must be a non-empty list when supplied."
            }), 400

        requested_book_ids = []
        for value in raw_book_ids:
            try:
                book_id = int(value)
            except (TypeError, ValueError):
                return jsonify({
                    "status": "error",
                    "message": "Every book_id must be a valid integer."
                }), 400
            if book_id <= 0:
                return jsonify({
                    "status": "error",
                    "message": "Every book_id must be a positive integer."
                }), 400
            requested_book_ids.append(book_id)
        requested_book_ids = list(dict.fromkeys(requested_book_ids))

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed."}), 500

    cursor = conn.cursor(dictionary=True)

    try:
        # Lock the batch first; this serializes simultaneous returns for it.
        cursor.execute("""
            SELECT
                bb.id, bb.user_id, bb.status, bb.due_date,
                bb.borrow_qr_used_at, bb.return_qr_token,
                bb.return_qr_used_at,
                u.name AS student_name,
                u.email AS student_email
            FROM borrow_batches bb
            INNER JOIN users u ON u.id = bb.user_id
            WHERE bb.id = %s
            FOR UPDATE
        """, (batch_id,))
        batch = cursor.fetchone()

        if not batch:
            conn.rollback()
            return jsonify({"status": "error", "message": "Borrowing batch not found."}), 404

        if batch["status"] not in ("approved", "partially_returned"):
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "Only approved, released borrowing batches can be returned."
            }), 409

        if batch["borrow_qr_used_at"] is None:
            conn.rollback()
            return jsonify({"status": "error", "message": "Books have not been released yet."}), 409

        if not batch["return_qr_token"]:
            conn.rollback()
            return jsonify({"status": "error", "message": "Return QR is not available."}), 400

        if batch["return_qr_used_at"] is not None:
            conn.rollback()
            return jsonify({"status": "error", "message": "All books in this batch have already been returned."}), 409

        if not _tokens_match(scanned_token.strip(), batch["return_qr_token"]):
            conn.rollback()
            return jsonify({"status": "error", "message": "Invalid Return QR token."}), 400

        sql = """
            SELECT id AS request_id, book_id
            FROM borrow_requests
            WHERE batch_id = %s
              AND status = 'approved'
              AND returned_at IS NULL
        """
        params = [batch_id]
        if requested_book_ids is not None:
            placeholders = ",".join(["%s"] * len(requested_book_ids))
            sql += f" AND book_id IN ({placeholders})"
            params.extend(requested_book_ids)
        sql += " ORDER BY id ASC FOR UPDATE"
        cursor.execute(sql, tuple(params))
        returnable = cursor.fetchall()

        if not returnable:
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "No approved, unreturned books were found for this batch."
            }), 409

        found_ids = {int(item["book_id"]) for item in returnable}
        if len(found_ids) != len(returnable):
            conn.rollback()
            logger.error(
                "Duplicate book entries found in return batch: batch_id=%s request_ids=%s",
                batch_id,
                [item["request_id"] for item in returnable],
            )
            return jsonify({
                "status": "error",
                "message": "This batch contains duplicate book entries. No inventory was changed. Please ask the administrator to review the batch."
            }), 409

        if requested_book_ids is not None and not set(requested_book_ids).issubset(found_ids):
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "One or more selected books are not outstanding in this batch."
            }), 409

        # Lock all affected book rows in ascending ID order to reduce deadlock
        # risk when two different batches return overlapping books.
        book_ids = sorted(found_ids)
        placeholders = ",".join(["%s"] * len(book_ids))
        cursor.execute(
            f"""
            SELECT id, title, quantity, available_quantity
            FROM books
            WHERE id IN ({placeholders})
            ORDER BY id ASC
            FOR UPDATE
            """,
            tuple(book_ids)
        )
        locked_books = {int(row["id"]): row for row in cursor.fetchall()}

        if len(locked_books) != len(book_ids):
            conn.rollback()
            return jsonify({
                "status": "error",
                "message": "One or more books in this batch no longer exist."
            }), 409

        returned_books = []
        for item in returnable:
            book_id = int(item["book_id"])
            book = locked_books[book_id]
            available = int(book["available_quantity"])
            quantity = int(book["quantity"])

            # Do not silently cap an inconsistent inventory count. Roll back
            # the entire return so a book is never marked returned without
            # restoring exactly one available copy.
            if available >= quantity:
                conn.rollback()
                logger.error(
                    "Inventory invariant failed on return: book_id=%s available=%s quantity=%s",
                    book_id, available, quantity
                )
                return jsonify({
                    "status": "error",
                    "message": "Inventory count is inconsistent for one of the selected books. No return was processed. Contact the administrator."
                }), 409

            cursor.execute("""
                UPDATE books
                SET
                    available_quantity = available_quantity + 1,
                    status = 'available'
                WHERE id = %s
                  AND available_quantity < quantity
            """, (book_id,))

            if cursor.rowcount != 1:
                conn.rollback()
                return jsonify({
                    "status": "error",
                    "message": "Inventory changed while processing the return. Please refresh and try again."
                }), 409

            cursor.execute("""
                UPDATE borrow_requests
                SET returned_at = NOW()
                WHERE id = %s
                  AND returned_at IS NULL
                  AND status = 'approved'
            """, (item["request_id"],))

            if cursor.rowcount != 1:
                conn.rollback()
                return jsonify({
                    "status": "error",
                    "message": "This book return was already processed."
                }), 409

            # Keep the in-memory locked value in sync in case the same book
            # appears more than once in legacy/corrupt batch data.
            book["available_quantity"] = available + 1
            returned_books.append({
                "book_id": book_id,
                "title": book["title"]
            })

        cursor.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN status = 'approved' AND returned_at IS NULL THEN 1 ELSE 0 END), 0) AS active_count,
                COALESCE(SUM(CASE WHEN status = 'approved' AND returned_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS returned_count
            FROM borrow_requests
            WHERE batch_id = %s
        """, (batch_id,))
        counts = cursor.fetchone() or {}
        active_count = int(counts.get("active_count") or 0)
        returned_count = int(counts.get("returned_count") or 0)

        if active_count == 0 and returned_count > 0:
            new_status = "returned"
            cursor.execute("""
                UPDATE borrow_batches
                SET status = %s,
                    return_qr_used_at = NOW()
                WHERE id = %s
            """, (new_status, batch_id))
        else:
            new_status = "partially_returned"
            cursor.execute("""
                UPDATE borrow_batches
                SET status = %s
                WHERE id = %s
            """, (new_status, batch_id))

        conn.commit()

        _send_status_email_safely(
            student_email=batch["student_email"],
            student_name=batch["student_name"],
            status=new_status,
            book_titles=[item["title"] for item in returned_books],
            due_date=batch["due_date"],
        )

        return jsonify({
            "status": "success",
            "message": "Books returned successfully.",
            "batch_id": batch_id,
            "batch_status": new_status,
            "returned_books": returned_books,
            "remaining_books": active_count,
            "due_date": batch["due_date"],
            "return_qr_completed": new_status == "returned"
        }), 200

    except Exception:
        conn.rollback()
        logger.exception("Return borrowing batch failed")
        return jsonify({
            "status": "error",
            "message": "Unable to process book returns right now. Please try again."
        }), 500

    finally:
        cursor.close()
        conn.close()

