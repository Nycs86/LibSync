from flask import Blueprint, jsonify, request
import mysql.connector

from database import get_db_connection


books_bp = Blueprint("books", __name__)


@books_bp.route("/api/books", methods=["GET"])
def get_books():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT *
            FROM books
            ORDER BY id DESC
        """)

        books = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify(books)

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@books_bp.route("/api/books", methods=["POST"])
def add_book():
    try:
        data = request.get_json()

        title = data.get("title")
        author = data.get("author")
        isbn = data.get("isbn")
        category = data.get("category")
        publisher = data.get("publisher")
        year_published = data.get("year_published")
        quantity = data.get("quantity", 1)

        if not title or not author:
            return jsonify({
                "status": "error",
                "message": "Title and author are required."
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO books
            (title, author, isbn, category, publisher,
             year_published, quantity, available_quantity)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            title,
            author,
            isbn,
            category,
            publisher,
            year_published,
            quantity,
            quantity
        )

        cursor.execute(query, values)
        connection.commit()

        book_id = cursor.lastrowid

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "Book added successfully!",
            "book_id": book_id
        }), 201

    except mysql.connector.IntegrityError:
        return jsonify({
            "status": "error",
            "message": "ISBN already exists."
        }), 409

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@books_bp.route("/api/books/<int:book_id>", methods=["PUT"])
def update_book(book_id):
    try:
        data = request.get_json()

        title = data.get("title")
        author = data.get("author")
        isbn = data.get("isbn")
        category = data.get("category")
        publisher = data.get("publisher")
        year_published = data.get("year_published")
        quantity = data.get("quantity")

        if not title or not author or quantity is None:
            return jsonify({
                "status": "error",
                "message": "Title, author, and quantity are required."
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT quantity, available_quantity
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

        borrowed_quantity = (
            book["quantity"] - book["available_quantity"]
        )

        if quantity < borrowed_quantity:
            cursor.close()
            connection.close()

            return jsonify({
                "status": "error",
                "message": "Quantity cannot be less than the number of borrowed copies."
            }), 400

        new_available_quantity = quantity - borrowed_quantity

        if new_available_quantity > 0:
            status = "available"
        else:
            status = "borrowed"

        cursor.execute("""
            UPDATE books
            SET title = %s,
                author = %s,
                isbn = %s,
                category = %s,
                publisher = %s,
                year_published = %s,
                quantity = %s,
                available_quantity = %s,
                status = %s
            WHERE id = %s
        """, (
            title,
            author,
            isbn,
            category,
            publisher,
            year_published,
            quantity,
            new_available_quantity,
            status,
            book_id
        ))

        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "Book updated successfully!"
        })

    except mysql.connector.IntegrityError:
        return jsonify({
            "status": "error",
            "message": "ISBN already exists."
        }), 409

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@books_bp.route("/api/books/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, quantity, available_quantity
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

        borrowed_quantity = (
            book["quantity"] - book["available_quantity"]
        )

        if borrowed_quantity > 0:
            cursor.close()
            connection.close()

            return jsonify({
                "status": "error",
                "message": "Cannot delete a book that is currently borrowed."
            }), 400

        cursor.execute("""
            DELETE FROM books
            WHERE id = %s
        """, (book_id,))

        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "Book deleted successfully!"
        })

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500