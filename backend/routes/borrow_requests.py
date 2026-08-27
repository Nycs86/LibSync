from flask import Blueprint, jsonify, request
from database import get_db_connection
from .auth import require_role
import qrcode
import io
import base64


borrow_requests_bp = Blueprint("borrow_requests", __name__)

@borrow_requests_bp.route("/api/borrow-requests", methods=["POST"])
def create_borrow_request():

    data = request.get_json()

    user_id = data.get("user_id")
    book_id = data.get("book_id")

    if not user_id or not book_id:
        return jsonify({
            "status": "error",
            "message": "user_id and book_id are required."
        }), 400

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
            "SELECT id FROM users WHERE id = %s",
            (user_id,)
        )

        user = cursor.fetchone()

        if not user:
            return jsonify({
                "status": "error",
                "message": "User not found."
            }), 404

        # Check book
        cursor.execute(
            """
            SELECT id, title, available_quantity
            FROM books
            WHERE id = %s
            """,
            (book_id,)
        )

        book = cursor.fetchone()

        if not book:
            return jsonify({
                "status": "error",
                "message": "Book not found."
            }), 404

        # Check availability
        if book["available_quantity"] <= 0:
            return jsonify({
                "status": "error",
                "message": "Book is currently unavailable."
            }), 400

        # Check existing pending request
        cursor.execute(
            """
            SELECT id
            FROM borrow_requests
            WHERE user_id = %s
            AND book_id = %s
            AND status = 'pending'
            """,
            (user_id, book_id)
        )

        existing_request = cursor.fetchone()

        if existing_request:
            return jsonify({
                "status": "error",
                "message": "You already have a pending request for this book."
            }), 400

        # Create request
        cursor.execute(
            """
            INSERT INTO borrow_requests
            (user_id, book_id, status)
            VALUES (%s, %s, 'pending')
            """,
            (user_id, book_id)
        )

        conn.commit()

        request_id = cursor.lastrowid

        return jsonify({
            "status": "success",
            "message": "Borrow request submitted successfully.",
            "request_id": request_id
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
@require_role("admin")
def decide_borrow_request(request_id):

    data = request.get_json() or {}

    # Get authenticated admin ID from the authentication helper
    admin_id = request.authenticated_user_id
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

        # Get borrow request
        cursor.execute("""
            SELECT
                br.id,
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

        if borrow_request["status"] != "pending":
            return jsonify({
                "status": "error",
                "message": "This request has already been processed."
            }), 400

        # =========================
        # DECLINE REQUEST
        # =========================

        if decision == "declined":

            cursor.execute("""
                UPDATE borrow_requests
                SET
                    status = 'declined',
                    approved_by = %s,
                    approved_at = NOW()
                WHERE id = %s
            """, (admin_id, request_id))

            conn.commit()

            return jsonify({
                "status": "success",
                "message": "Borrow request declined.",
                "request_id": request_id
            }), 200

        # =========================
        # APPROVE REQUEST
        # =========================

        if borrow_request["available_quantity"] <= 0:
            return jsonify({
                "status": "error",
                "message": "Book is no longer available."
            }), 400

        # Generate unique QR token
        import uuid

        qr_token = str(uuid.uuid4())

        # Update borrow request
        cursor.execute("""
            UPDATE borrow_requests
            SET
                status = 'approved',
                approved_by = %s,
                approved_at = NOW(),
                qr_token = %s
            WHERE id = %s
        """, (admin_id, qr_token, request_id))

        # Reduce available quantity
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
        """, (borrow_request["book_id"],))

        # Create borrowing record
        cursor.execute("""
            INSERT INTO borrowings
            (
                user_id,
                book_id,
                borrowed_at,
                due_date,
                returned_at,
                status
            )
            VALUES
            (
                %s,
                %s,
                NOW(),
                DATE_ADD(NOW(), INTERVAL 7 DAY),
                NULL,
                'borrowed'
            )
        """, (
            borrow_request["user_id"],
            borrow_request["book_id"]
        ))

        borrowing_id = cursor.lastrowid

        conn.commit()

        return jsonify({
            "status": "success",
            "message": "Borrow request approved.",
            "request_id": request_id,
            "borrowing_id": borrowing_id,
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

# GENERATE QR CODE FOR APPROVED BORROW REQUEST

@borrow_requests_bp.route(
    "/api/borrow-requests/<int:request_id>/qr",
    methods=["GET"]
)
def generate_borrow_qr(request_id):

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
                br.book_id,
                br.status,
                br.qr_token,
                b.title AS book_title,
                u.name AS user_name
            FROM borrow_requests br
            INNER JOIN books b
                ON br.book_id = b.id
            INNER JOIN users u
                ON br.user_id = u.id
            WHERE br.id = %s
            """,
            (request_id,)
        )

        borrow_request = cursor.fetchone()

        if not borrow_request:
            return jsonify({
                "status": "error",
                "message": "Borrow request not found."
            }), 404

        if borrow_request["status"] != "approved":
            return jsonify({
                "status": "error",
                "message": "QR code is only available for approved requests."
            }), 400

        if not borrow_request["qr_token"]:
            return jsonify({
                "status": "error",
                "message": "QR token not found."
            }), 400

        # QR content
        qr_data = borrow_request["qr_token"]

        # Create QR code
        qr = qrcode.QRCode(
            version=1,
            box_size=10,
            border=4
        )

        qr.add_data(qr_data)
        qr.make(fit=True)

        qr_image = qr.make_image()

        # Convert image to bytes
        image_bytes = io.BytesIO()
        qr_image.save(image_bytes, format="PNG")
        image_bytes.seek(0)

        # Convert image to Base64
        qr_base64 = base64.b64encode(
            image_bytes.getvalue()
        ).decode("utf-8")

        return jsonify({
            "status": "success",
            "request_id": borrow_request["id"],
            "user_id": borrow_request["user_id"],
            "book_id": borrow_request["book_id"],
            "book_title": borrow_request["book_title"],
            "user_name": borrow_request["user_name"],
            "qr_token": borrow_request["qr_token"],
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