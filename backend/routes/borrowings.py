from flask import Blueprint, jsonify, request
import mysql.connector

from database import get_db_connection


borrowings_bp = Blueprint("borrowings", __name__)


# =========================================================
# GET ALL BORROWINGS
# =========================================================
@borrowings_bp.route("/api/borrowings", methods=["GET"])
def get_borrowings():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                br.id,
                br.user_id,
                br.book_id,
                br.borrowed_at,
                br.due_date,
                br.returned_at,
                br.status,
                u.name AS user_name,
                b.title AS book_title
            FROM borrowings br
            JOIN users u ON br.user_id = u.id
            JOIN books b ON br.book_id = b.id
            ORDER BY br.id DESC
        """)

        borrowings = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "borrowings": borrowings
        }), 200

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


# =========================================================
# ADD BORROWING
# =========================================================
@borrowings_bp.route("/api/borrowings", methods=["POST"])
def add_borrowing():
    try:
        data = request.get_json()

        user_id = data.get("user_id")
        book_id = data.get("book_id")
        due_date = data.get("due_date")

        if not user_id or not book_id or not due_date:
            return jsonify({
                "status": "error",
                "message": "User, book, and due date are required."
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, available_quantity
            FROM books
            WHERE id = %s
        """, (book_id,))

        book = cursor.fetchone()

        if not book:
            cursor.close()
            connection.close()

            return jsonify({
                "status": "error",
                "message": "Book not found."
            }), 404

        if book["available_quantity"] <= 0:
            cursor.close()
            connection.close()

            return jsonify({
                "status": "error",
                "message": "Book is not available."
            }), 400

        cursor.execute("""
            INSERT INTO borrowings
            (user_id, book_id, borrowed_at, due_date, status)
            VALUES (%s, %s, NOW(), %s, %s)
        """, (
            user_id,
            book_id,
            due_date,
            "borrowed"
        ))

        cursor.execute("""
            UPDATE books
            SET available_quantity = available_quantity - 1
            WHERE id = %s
        """, (book_id,))

        connection.commit()

        borrowing_id = cursor.lastrowid

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "Book borrowed successfully!",
            "borrowing_id": borrowing_id
        }), 201

    except mysql.connector.Error as error:
        if "connection" in locals():
            connection.rollback()
            cursor.close()
            connection.close()

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


# =========================================================
# UPDATE BORROWING / RETURN BOOK
# =========================================================
@borrowings_bp.route(
    "/api/borrowings/<int:borrowing_id>",
    methods=["PUT"]
)
def update_borrowing(borrowing_id):
    try:
        data = request.get_json()

        status = data.get("status")

        if not status:
            return jsonify({
                "status": "error",
                "message": "Status is required."
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT book_id, status
            FROM borrowings
            WHERE id = %s
        """, (borrowing_id,))

        borrowing = cursor.fetchone()

        if not borrowing:
            cursor.close()
            connection.close()

            return jsonify({
                "status": "error",
                "message": "Borrowing record not found."
            }), 404

        old_status = borrowing["status"]
        book_id = borrowing["book_id"]

        if old_status == "borrowed" and status == "returned":

            cursor.execute("""
                UPDATE books
                SET available_quantity = available_quantity + 1
                WHERE id = %s
            """, (book_id,))

            cursor.execute("""
                UPDATE borrowings
                SET status = %s,
                    returned_at = NOW()
                WHERE id = %s
            """, (status, borrowing_id))

        else:

            cursor.execute("""
                UPDATE borrowings
                SET status = %s
                WHERE id = %s
            """, (status, borrowing_id))

        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "Borrowing updated successfully!"
        }), 200

    except mysql.connector.Error as error:
        if "connection" in locals():
            connection.rollback()
            cursor.close()
            connection.close()

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    # GET BORROWINGS FOR A SPECIFIC STUDENT

@borrowings_bp.route(
    "/api/student/borrowings/<int:user_id>",
    methods=["GET"]
)
def get_student_borrowings(user_id):

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

        # Get borrowings belonging only to this student
        cursor.execute("""
            SELECT
                br.id AS borrowing_id,
                br.book_id,
                b.title,
                b.author,
                br.borrowed_at,
                br.due_date,
                br.returned_at,
                br.status
            FROM borrowings br
            INNER JOIN books b
                ON br.book_id = b.id
            WHERE br.user_id = %s
            ORDER BY br.borrowed_at DESC
        """, (user_id,))

        borrowings = cursor.fetchall()

        return jsonify({
            "status": "success",
            "user_id": user_id,
            "borrowings": borrowings
        }), 200

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:
        cursor.close()
        conn.close()

        # GET ALL OVERDUE BORROWINGS

@borrowings_bp.route("/api/borrowings/overdue", methods=["GET"])
def get_overdue_borrowings():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                br.id AS borrowing_id,
                br.user_id,
                u.name AS user_name,
                u.email AS user_email,
                br.book_id,
                b.title AS book_title,
                br.borrowed_at,
                br.due_date,
                br.returned_at,
                br.status
            FROM borrowings br
            INNER JOIN users u
                ON br.user_id = u.id
            INNER JOIN books b
                ON br.book_id = b.id
            WHERE br.status = 'borrowed'
              AND br.due_date < NOW()
              AND br.returned_at IS NULL
            ORDER BY br.due_date ASC
        """)

        overdue = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "overdue": overdue
        }), 200

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500