from flask import Blueprint, jsonify, request
import mysql.connector

from database import get_db_connection


borrowings_bp = Blueprint("borrowings", __name__)


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
                br.borrow_date,
                br.due_date,
                br.return_date,
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

        return jsonify(borrowings)

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@borrowings_bp.route("/api/borrowings", methods=["POST"])
def add_borrowing():
    try:
        data = request.get_json()

        user_id = data.get("user_id")
        book_id = data.get("book_id")
        borrow_date = data.get("borrow_date")
        due_date = data.get("due_date")

        if not user_id or not book_id or not borrow_date or not due_date:
            return jsonify({
                "status": "error",
                "message": "User, book, borrow date, and due date are required."
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check if the book exists and is available
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

        # Create borrowing record
        cursor.execute("""
            INSERT INTO borrowings
            (user_id, book_id, borrow_date, due_date, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            book_id,
            borrow_date,
            due_date,
            "borrowed"
        ))

        # Decrease available copies
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


@borrowings_bp.route("/api/borrowings/<int:borrowing_id>", methods=["PUT"])
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

        # If changing from borrowed to returned,
        # increase the available quantity.
        if old_status == "borrowed" and status == "returned":
            cursor.execute("""
                UPDATE books
                SET available_quantity = available_quantity + 1
                WHERE id = %s
            """, (book_id,))

            cursor.execute("""
                UPDATE borrowings
                SET status = %s,
                    return_date = CURDATE()
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
        })

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500