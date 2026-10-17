from flask import Blueprint, jsonify, request
from database import get_db_connection
from email_service import send_borrow_status_email
from .auth import require_role
import qrcode
import io
import base64
import uuid

borrow_requests_bp = Blueprint("borrow_requests", __name__)


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
def create_borrow_request():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    book_ids = data.get("book_ids")

    try:
        loan_days = int(data.get("loan_days", 1))
    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "message": "Return period must be between 1 and 5 days."
        }), 400

    if loan_days < 1 or loan_days > 5:
        return jsonify({
            "status": "error",
            "message": "Return period must be between 1 and 5 days."
        }), 400

    # Backward compatibility for clients sending one book_id.
    if not book_ids:
        single_book_id = data.get("book_id")
        if single_book_id:
            book_ids = [single_book_id]

    if not user_id or not book_ids:
        return jsonify({
            "status": "error",
            "message": "user_id and book_ids are required."
        }), 400

    if not isinstance(book_ids, list):
        return jsonify({
            "status": "error",
            "message": "book_ids must be a list."
        }), 400

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
        """, (user_id,))
        student = cursor.fetchone()

        if not student:
            return jsonify({
                "status": "error",
                "message": "Student not found."
            }), 404

        if student["role"] != "student":
            return jsonify({
                "status": "error",
                "message": "Only students can create borrow requests."
            }), 403

        placeholders = ",".join(["%s"] * len(book_ids))

        cursor.execute(
            f"""
            SELECT id, title, available_quantity, status
            FROM books
            WHERE id IN ({placeholders})
            """,
            tuple(book_ids)
        )
        books = cursor.fetchall()

        if len(books) != len(book_ids):
            return jsonify({
                "status": "error",
                "message": "One or more selected books do not exist."
            }), 404

        unavailable_books = [
            book["title"]
            for book in books
            if book["available_quantity"] <= 0
        ]

        if unavailable_books:
            return jsonify({
                "status": "error",
                "message": "Some selected books are unavailable.",
                "books": unavailable_books
            }), 400

        cursor.execute(
            f"""
            SELECT br.book_id, b.title
            FROM borrow_requests br
            INNER JOIN books b ON br.book_id = b.id
            WHERE br.user_id = %s
              AND br.book_id IN ({placeholders})
              AND br.status = 'pending'
            """,
            tuple([user_id] + book_ids)
        )
        existing_requests = cursor.fetchall()

        if existing_requests:
            return jsonify({
                "status": "error",
                "message": "You already have pending requests for some selected books.",
                "books": [item["title"] for item in existing_requests]
            }), 400

        # No QR is created while a batch is pending.
        cursor.execute("""
            INSERT INTO borrow_batches (
                user_id,
                status,
                loan_days,
                due_date
            )
            VALUES (%s, 'pending', %s, NULL)
        """, (user_id, loan_days))
        batch_id = cursor.lastrowid

        request_ids = []
        for book_id in book_ids:
            cursor.execute("""
                INSERT INTO borrow_requests (
                    batch_id,
                    user_id,
                    book_id,
                    status
                )
                VALUES (%s, %s, %s, 'pending')
            """, (batch_id, user_id, book_id))
            request_ids.append(cursor.lastrowid)

        conn.commit()

        send_borrow_status_email(
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

    except Exception as error:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        cursor.close()
        conn.close()


# =========================================================
# GET ALL BORROW REQUESTS
# =========================================================
@borrow_requests_bp.route("/api/borrow-requests", methods=["GET"])
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
@require_role("librarian")
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
    data = request.get_json() or {}
    librarian_id = request.authenticated_user_id
    decision = data.get("decision")

    if not decision:
        return jsonify({
            "status": "error",
            "message": "decision is required."
        }), 400

    if decision not in ["approved", "declined"]:
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
        cursor.execute("""
            SELECT
                br.id,
                br.batch_id,
                br.user_id,
                br.book_id,
                br.status,
                b.title,
                b.available_quantity,
                u.name AS student_name,
                u.email AS student_email
            FROM borrow_requests br
            INNER JOIN books b ON br.book_id = b.id
            INNER JOIN users u ON br.user_id = u.id
            WHERE br.id = %s
        """, (request_id,))
        borrow_request = cursor.fetchone()

        if not borrow_request:
            return jsonify({
                "status": "error",
                "message": "Borrow request not found."
            }), 404

        if not borrow_request["batch_id"]:
            return jsonify({
                "status": "error",
                "message": "This request is not connected to a borrow batch."
            }), 400

        if borrow_request["status"] != "pending":
            return jsonify({
                "status": "error",
                "message": "This request has already been processed."
            }), 400

        batch_id = borrow_request["batch_id"]

        if decision == "approved":
            if borrow_request["available_quantity"] <= 0:
                return jsonify({
                    "status": "error",
                    "message": "Book is no longer available."
                }), 400

            cursor.execute("""
                UPDATE borrow_requests
                SET
                    status = 'approved',
                    approved_by = %s,
                    approved_at = NOW()
                WHERE id = %s
            """, (librarian_id, request_id))

            # Reserve one copy when approved.
            cursor.execute("""
                UPDATE books
                SET
                    available_quantity = available_quantity - 1,
                    status = CASE
                        WHEN available_quantity - 1 <= 0 THEN 'unavailable'
                        ELSE 'available'
                    END
                WHERE id = %s
            """, (borrow_request["book_id"],))

        else:
            cursor.execute("""
                UPDATE borrow_requests
                SET
                    status = 'declined',
                    approved_by = %s,
                    approved_at = NOW()
                WHERE id = %s
            """, (librarian_id, request_id))

        cursor.execute("""
            SELECT
                COUNT(*) AS total_requests,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) AS declined_count
            FROM borrow_requests
            WHERE batch_id = %s
        """, (batch_id,))
        summary = cursor.fetchone()

        borrow_qr_token = None
        batch_status = "pending"

        # Only create Borrow QR after every request in this batch is processed.
        if int(summary["pending_count"] or 0) == 0:
            if int(summary["approved_count"] or 0) > 0:
                cursor.execute("""
                    SELECT borrow_qr_token
                    FROM borrow_batches
                    WHERE id = %s
                """, (batch_id,))
                batch = cursor.fetchone()

                if batch and batch["borrow_qr_token"]:
                    borrow_qr_token = batch["borrow_qr_token"]
                else:
                    borrow_qr_token = str(uuid.uuid4())

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
                        return_qr_token = NULL
                    WHERE id = %s
                """, (librarian_id, batch_id))
                batch_status = "declined"

        conn.commit()

        send_borrow_status_email(
            student_email=borrow_request["student_email"],
            student_name=borrow_request["student_name"],
            status=decision,
            book_titles=[borrow_request["title"]],
        )

        return jsonify({
            "status": "success",
            "message": (
                "Borrow request approved."
                if decision == "approved"
                else "Borrow request declined."
            ),
            "request_id": request_id,
            "batch_id": batch_id,
            "decision": decision,
            "batch_status": batch_status,
            "pending_requests": summary["pending_count"],
            "approved_requests": summary["approved_count"],
            "declined_requests": summary["declined_count"],
            "qr_available": borrow_qr_token is not None,
            "qr_type": "borrow" if borrow_qr_token else None,
            # Backward-compatible key used by current frontend.
            "qr_token": borrow_qr_token,
            "borrow_qr_token": borrow_qr_token
        }), 200

    except Exception as error:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": str(error)
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

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
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
def get_student_borrow_requests(user_id):
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

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
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

        qr_token, qr_type = _current_qr_for_batch(batch)

        if not qr_token:
            return jsonify({
                "status": "error",
                "message": "QR code is not available for this batch yet."
            }), 400

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

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
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

        if qr_token == batch.get("borrow_qr_token"):
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

    except Exception as error:
        print("QR batch lookup error:", error)
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
                status,
                borrow_qr_token,
                return_qr_token,
                borrow_qr_used_at,
                return_qr_used_at,
                loan_days,
                due_date
            FROM borrow_batches
            WHERE id = %s
            FOR UPDATE
        """, (batch_id,))
        batch = cursor.fetchone()

        if not batch:
            return jsonify({
                "status": "error",
                "message": "Borrowing batch not found."
            }), 404

        if batch["status"] != "approved":
            return jsonify({
                "status": "error",
                "message": "Only approved borrowing batches can be released."
            }), 400

        if not batch["borrow_qr_token"]:
            return jsonify({
                "status": "error",
                "message": "Borrow QR is not available."
            }), 400

        if batch["borrow_qr_used_at"] is not None:
            return jsonify({
                "status": "error",
                "message": "Borrow QR has already been used."
            }), 400

        if scanned_token is not None and scanned_token != batch["borrow_qr_token"]:
            return jsonify({
                "status": "error",
                "message": "Invalid Borrow QR token."
            }), 400

        return_qr_token = batch["return_qr_token"] or str(uuid.uuid4())

        cursor.execute("""
            UPDATE borrow_batches
            SET
                borrow_qr_used_at = NOW(),
                return_qr_token = %s,
                due_date = DATE_ADD(CURDATE(), INTERVAL loan_days DAY)
            WHERE id = %s
        """, (return_qr_token, batch_id))

        conn.commit()

        return jsonify({
            "status": "success",
            "message": "Books released successfully.",
            "batch_id": batch_id,
            "borrow_qr_used": True,
            "return_qr_available": True,
            "return_qr_token": return_qr_token
        }), 200

    except Exception as error:
        conn.rollback()
        print("Release borrowing batch error:", error)
        return jsonify({
            "status": "error",
            "message": str(error)
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
    requested_book_ids = data.get("book_ids")
    scanned_token = data.get("qr_token")

    if requested_book_ids is not None and not isinstance(requested_book_ids, list):
        return jsonify({
            "status": "error",
            "message": "book_ids must be a list when supplied."
        }), 400

    if requested_book_ids == []:
        return jsonify({
            "status": "error",
            "message": "Select at least one book to return."
        }), 400

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
                bb.due_date,
                bb.borrow_qr_used_at,
                bb.return_qr_token,
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
            return jsonify({
                "status": "error",
                "message": "Borrowing batch not found."
            }), 404

        if batch["status"] not in ("approved", "partially_returned"):
            return jsonify({
                "status": "error",
                "message": "Only approved, released borrowing batches can be returned."
            }), 400

        if batch["borrow_qr_used_at"] is None:
            return jsonify({
                "status": "error",
                "message": "Books have not been released yet."
            }), 400

        if not batch["return_qr_token"]:
            return jsonify({
                "status": "error",
                "message": "Return QR is not available."
            }), 400

        if batch["return_qr_used_at"] is not None:
            return jsonify({
                "status": "error",
                "message": "Return QR has already been completed."
            }), 400

        if scanned_token is not None and scanned_token != batch["return_qr_token"]:
            return jsonify({
                "status": "error",
                "message": "Invalid Return QR token."
            }), 400

        sql = """
            SELECT
                br.id AS request_id,
                br.book_id,
                b.title
            FROM borrow_requests br
            INNER JOIN books b ON b.id = br.book_id
            WHERE br.batch_id = %s
              AND br.status = 'approved'
              AND br.returned_at IS NULL
        """
        params = [batch_id]

        if requested_book_ids:
            valid_ids = []
            for item in requested_book_ids:
                try:
                    valid_ids.append(int(item))
                except (TypeError, ValueError):
                    return jsonify({
                        "status": "error",
                        "message": "Every book_id must be a valid integer."
                    }), 400

            placeholders = ",".join(["%s"] * len(valid_ids))
            sql += f" AND br.book_id IN ({placeholders})"
            params.extend(valid_ids)

        sql += " ORDER BY br.id ASC FOR UPDATE"
        cursor.execute(sql, tuple(params))
        returnable = cursor.fetchall()

        if not returnable:
            return jsonify({
                "status": "error",
                "message": "No approved, unreturned books were found for this batch."
            }), 400

        returned_books = []

        for item in returnable:
            cursor.execute("""
                UPDATE borrow_requests
                SET returned_at = NOW()
                WHERE id = %s
                  AND returned_at IS NULL
            """, (item["request_id"],))

            if cursor.rowcount == 0:
                continue

            cursor.execute("""
                UPDATE books
                SET
                    available_quantity = LEAST(
                        available_quantity + 1,
                        quantity
                    ),
                    status = 'available'
                WHERE id = %s
            """, (item["book_id"],))

            returned_books.append({
                "book_id": item["book_id"],
                "title": item["title"]
            })

        cursor.execute("""
            SELECT
                SUM(
                    CASE
                        WHEN br.status = 'approved'
                             AND br.returned_at IS NULL
                        THEN 1 ELSE 0
                    END
                ) AS active_count,
                SUM(
                    CASE
                        WHEN br.status = 'approved'
                             AND br.returned_at IS NOT NULL
                        THEN 1 ELSE 0
                    END
                ) AS returned_count
            FROM borrow_requests br
            WHERE br.batch_id = %s
        """, (batch_id,))
        counts = cursor.fetchone() or {}

        active_count = int(counts.get("active_count") or 0)
        returned_count = int(counts.get("returned_count") or 0)

        if active_count == 0 and returned_count > 0:
            new_status = "returned"
            cursor.execute("""
                UPDATE borrow_batches
                SET
                    status = %s,
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

        send_borrow_status_email(
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

    except Exception as error:
        conn.rollback()
        print("Return borrowing batch error:", error)
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        cursor.close()
        conn.close()
