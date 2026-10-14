from flask import Blueprint, jsonify, request
from database import get_db_connection
from .auth import require_role
import qrcode
import io
import base64
import uuid
borrow_requests_bp = Blueprint("borrow_requests", __name__)

@borrow_requests_bp.route("/api/borrow-requests", methods=["POST"])

def create_borrow_request():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    book_ids = data.get("book_ids")
    # Backward compatibility:
    # kung isang book_id lang ang sinend ng old frontend
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
    # Remove duplicate book IDs
    book_ids = list(dict.fromkeys(book_ids))
    conn = get_db_connection()
    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500
    cursor = conn.cursor(dictionary=True)
    try:
        # =========================
        # CHECK STUDENT
        # =========================
        cursor.execute("""
            SELECT id, name, role
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
        # =========================
        # CHECK ALL BOOKS
        # =========================
        placeholders = ",".join(["%s"] * len(book_ids))
        cursor.execute(
            f"""
            SELECT
                id,
                title,
                available_quantity,
                status
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
        # Check availability
        unavailable_books = []
        for book in books:
            if book["available_quantity"] <= 0:
                unavailable_books.append(book["title"])
        if unavailable_books:
            return jsonify({
                "status": "error",
                "message": "Some selected books are unavailable.",
                "books": unavailable_books
            }), 400
        # =========================
        # CHECK EXISTING REQUESTS
        # =========================
        cursor.execute(
            f"""
            SELECT
                br.book_id,
                b.title
            FROM borrow_requests br
            INNER JOIN books b
                ON br.book_id = b.id
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
                "books": [
                    item["title"]
                    for item in existing_requests
                ]
            }), 400
        # CREATE BORROW BATCH
        qr_token = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO borrow_batches (
                user_id,
                status,
                qr_token
            )
            VALUES (%s, 'pending', %s)
        """, (user_id, qr_token))
        batch_id = cursor.lastrowid
        # =========================
        # CREATE REQUEST PER BOOK
        # =========================
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
            """, (
                batch_id,
                user_id,
                book_id
            ))
            request_ids.append(
                cursor.lastrowid
            )
        conn.commit()
        return jsonify({
            "status": "success",
            "message": "Borrow batch submitted successfully.",
            "batch_id": batch_id,
            "request_ids": request_ids,
            "total_books": len(book_ids),
            "qr_available": True,
            "qr_payload": qr_token
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    finally:
        cursor.close()
        conn.close()

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
        cursor.execute(
            """
            SELECT
                br.id,
                br.user_id,
                u.name AS user_name,
                u.email AS user_email,
                br.book_id,
                b.title AS book_title,
                br.requested_at,
                br.status,
                br.approved_by,
                br.approved_at,
                br.qr_token
            FROM borrow_requests br
            INNER JOIN users u
                ON br.user_id = u.id
            INNER JOIN books b
                ON br.book_id = b.id
            ORDER BY br.requested_at DESC
            """
        )
        requests = cursor.fetchall()
        return jsonify({
            "status": "success",
            "requests": requests
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    finally:
        cursor.close()
        conn.close()

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
        # =========================
        # GET REQUEST
        # =========================
        cursor.execute("""
            SELECT
                br.id,
                br.batch_id,
                br.user_id,
                br.book_id,
                br.status,
                b.title,
                b.available_quantity
            FROM borrow_requests br
            INNER JOIN books b
                ON br.book_id = b.id
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
        # =========================
        # APPROVE
        # =========================
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
            """, (
                librarian_id,
                request_id
            ))
            # Reserve one copy
            cursor.execute("""
                UPDATE books
                SET
                    available_quantity = available_quantity - 1,
                    status = CASE
                        WHEN available_quantity - 1 <= 0
                        THEN 'unavailable'
                        ELSE 'available'
                    END
                WHERE id = %s
            """, (
                borrow_request["book_id"],
            ))
        # =========================
        # DECLINE
        # =========================
        else:
            cursor.execute("""
                UPDATE borrow_requests
                SET
                    status = 'declined',
                    approved_by = %s,
                    approved_at = NOW()
                WHERE id = %s
            """, (
                librarian_id,
                request_id
            ))
        # =========================
        # CHECK WHOLE BATCH
        # =========================
        cursor.execute("""
            SELECT
                COUNT(*) AS total_requests,
                SUM(
                    CASE
                        WHEN status = 'pending'
                        THEN 1
                        ELSE 0
                    END
                ) AS pending_count,
                SUM(
                    CASE
                        WHEN status = 'approved'
                        THEN 1
                        ELSE 0
                    END
                ) AS approved_count,
                SUM(
                    CASE
                        WHEN status = 'declined'
                        THEN 1
                        ELSE 0
                    END
                ) AS declined_count
            FROM borrow_requests
            WHERE batch_id = %s
        """, (batch_id,))
        summary = cursor.fetchone()
        qr_token = None
        batch_status = "pending"
        # =========================
        # ALL REQUESTS PROCESSED
        # =========================
        if summary["pending_count"] == 0:
            # At least one book approved
            if summary["approved_count"] > 0:
                cursor.execute("""
                    SELECT qr_token
                    FROM borrow_batches
                    WHERE id = %s
                """, (batch_id,))
                batch = cursor.fetchone()
                if batch["qr_token"]:
                    qr_token = batch["qr_token"]
                else:
                    qr_token = str(uuid.uuid4())
                cursor.execute("""
                    UPDATE borrow_batches
                    SET
                        status = 'approved',
                        qr_token = %s,
                        approved_by = %s,
                        approved_at = NOW()
                    WHERE id = %s
                """, (
                    qr_token,
                    librarian_id,
                    batch_id
                ))
                batch_status = "approved"
            # All books declined
            else:
                cursor.execute("""
                    UPDATE borrow_batches
                    SET
                        status = 'declined',
                        approved_by = %s,
                        approved_at = NOW()
                    WHERE id = %s
                """, (
                    librarian_id,
                    batch_id
                ))
                batch_status = "declined"
        conn.commit()
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
            "qr_available": qr_token is not None,
            "qr_token": qr_token
        }), 200
    except Exception as e:
        conn.rollback()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    finally:
        cursor.close()
        conn.close()

# =========================================

# GET BORROW BATCHES FOR A SPECIFIC STUDENT

# =========================================

@borrow_requests_bp.route(
    "/api/student/borrow-batches/<int:user_id>",
    methods=["GET"]
)

@require_role("student")

def get_student_borrow_batches(user_id):
    authenticated_user_id = request.authenticated_user_id
    # Student can only view their own borrow batches
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
                qr_token,
                status,
                requested_at,
                approved_by,
                approved_at
            FROM borrow_batches
            WHERE user_id = %s
            ORDER BY requested_at DESC
        """, (user_id,))
        batches = cursor.fetchall()
        if not batches:
            return jsonify({
                "status": "success",
                "batches": []
            }), 200
        for batch in batches:
            cursor.execute("""
                SELECT
                    br.id AS request_id,
                    br.book_id,
                    b.title,
                    b.author,
                    br.status
                FROM borrow_requests br
                INNER JOIN books b
                    ON br.book_id = b.id
                WHERE br.batch_id = %s
                ORDER BY br.id ASC
            """, (batch["id"],))
            books = cursor.fetchall()
            batch["books"] = books
            batch["qr_available"] = (
                batch["qr_token"] is not None
                and batch["status"] in [
                    "pending",
                    "approved",
                    "partially_returned"
                ]
            )
        return jsonify({
            "status": "success",
            "batches": batches
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    finally:
        cursor.close()
        conn.close()

# GET BORROW REQUESTS FOR A SPECIFIC STUDENT

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
        # Check if user exists
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
        # Get requests belonging only to this student
        cursor.execute("""
            SELECT
                br.id,
                br.user_id,
                br.book_id,
                b.title AS book_title,
                br.status,
                br.requested_at,
                br.approved_by,
                br.approved_at,
                br.qr_token
            FROM borrow_requests br
            INNER JOIN books b
                ON br.book_id = b.id
            WHERE br.user_id = %s
            ORDER BY br.requested_at DESC
        """, (user_id,))
        requests = cursor.fetchall()
        return jsonify({
            "status": "success",
            "user_id": user_id,
            "requests": requests
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    finally:
        cursor.close()
        conn.close()

# =========================================
# GENERATE ONE QR CODE FOR AN APPROVED BATCH

# =========================================

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
                bb.qr_token,
                bb.status,
                bb.requested_at,
                bb.approved_at,
                u.name AS student_name,
                u.email AS student_email
            FROM borrow_batches bb
            INNER JOIN users u
                ON bb.user_id = u.id
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
        if not batch["qr_token"]:
            return jsonify({
                "status": "error",
                "message": "QR code is not available yet."
            }), 400
        cursor.execute("""
            SELECT
                br.id AS request_id,
                br.book_id,
                b.title,
                b.author,
                br.status
            FROM borrow_requests br
            INNER JOIN books b
                ON br.book_id = b.id
            WHERE br.batch_id = %s
            ORDER BY br.id ASC
        """, (batch_id,))
        approved_books = cursor.fetchall()
        qr = qrcode.QRCode(
            version=1,
            box_size=10,
            border=4
        )
        qr.add_data(batch["qr_token"])
        qr.make(fit=True)
        qr_image = qr.make_image()
        image_bytes = io.BytesIO()
        qr_image.save(image_bytes, format="PNG")
        image_bytes.seek(0)
        qr_base64 = base64.b64encode(
            image_bytes.getvalue()
        ).decode("utf-8")
        return jsonify({
            "status": "success",
            "batch": {
                "id": batch["id"],
                "student_id": batch["user_id"],
                "student_name": batch["student_name"],
                "student_email": batch["student_email"],
                "status": batch["status"],
                "requested_at": batch["requested_at"],
                "approved_at": batch["approved_at"]
            },
            "books": approved_books,
            "qr_token": batch["qr_token"],
            "qr_code": f"data:image/png;base64,{qr_base64}"
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    finally:
        cursor.close()
        conn.close()

# =========================================================

# LOOK UP A BORROW BATCH FROM A SCANNED QR TOKEN (LIBRARIAN)

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
                bb.qr_token,
                bb.requested_at,
                bb.approved_by,
                bb.approved_at,
                u.name AS student_name,
                u.email AS student_email
            FROM borrow_batches bb
            INNER JOIN users u
                ON u.id = bb.user_id
            WHERE bb.qr_token = %s
            LIMIT 1
        """, (qr_token,))
        batch = cursor.fetchone()
        if not batch:
            return jsonify({
                "status": "error",
                "message": "Invalid QR code. Borrowing batch not found."
            }), 404
        cursor.execute("""
            SELECT
                br.id AS request_id,
                br.batch_id,
                br.user_id,
                br.book_id,
                b.title AS book_title,
                b.author,
                br.status,
                br.requested_at,
                br.approved_by,
                br.approved_at
            FROM borrow_requests br
            INNER JOIN books b
                ON b.id = br.book_id
            WHERE br.batch_id = %s
            ORDER BY br.id ASC
        """, (batch["id"],))
        batch_requests = cursor.fetchall()
        batch["requests"] = batch_requests
        batch["total_books"] = len(batch_requests)
        return jsonify({
            "status": "success",
            "message": "Borrowing batch found.",
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

# ==========================================

# LOOK UP BORROWING BATCH USING QR TOKEN
