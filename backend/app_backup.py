from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
CORS(app)


def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="libsync_db"
    )


@app.route("/")
def home():
    return jsonify({
        "message": "LibSync API is running!"
    })


@app.route("/api/test-db")
def test_db():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT DATABASE()")
        database = cursor.fetchone()

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "MySQL connection successful!",
            "database": database[0]
        })

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/users", methods=["GET"])
def get_users():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, name, email, role, created_at
            FROM users
            ORDER BY id DESC
        """)

        users = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify(users)

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/users", methods=["POST"])
def add_user():
    try:
        data = request.get_json()

        name = data.get("name")
        email = data.get("email")
        password = data.get("password")
        role = data.get("role", "student")

        if not name or not email or not password:
            return jsonify({
                "status": "error",
                "message": "Name, email, and password are required."
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO users (name, email, password, role)
            VALUES (%s, %s, %s, %s)
        """

        values = (name, email, password, role)

        cursor.execute(query, values)
        connection.commit()

        user_id = cursor.lastrowid

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "User added successfully!",
            "user_id": user_id
        }), 201

    except mysql.connector.IntegrityError:
        return jsonify({
            "status": "error",
            "message": "Email already exists."
        }), 409

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

@app.route("/api/books", methods=["GET"])
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


@app.route("/api/books", methods=["POST"])
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

@app.route("/api/borrowings", methods=["GET"])
def get_borrowings():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                borrowings.id,
                users.name AS borrower,
                books.title AS book,
                borrowings.borrowed_at,
                borrowings.due_date,
                borrowings.returned_at,
                borrowings.status
            FROM borrowings
            INNER JOIN users ON borrowings.user_id = users.id
            INNER JOIN books ON borrowings.book_id = books.id
            ORDER BY borrowings.id DESC
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


@app.route("/api/borrowings", methods=["POST"])
def borrow_book():
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

        # Check book availability
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
            (user_id, book_id, due_date, status)
            VALUES (%s, %s, %s, 'borrowed')
        """, (user_id, book_id, due_date))

        borrowing_id = cursor.lastrowid

        # Reduce available quantity
        new_available = book["available_quantity"] - 1

        status = "available"

        if new_available == 0:
            status = "borrowed"

        cursor.execute("""
            UPDATE books
            SET available_quantity = %s,
                status = %s
            WHERE id = %s
        """, (new_available, status, book_id))

        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "Book borrowed successfully!",
            "borrowing_id": borrowing_id
        }), 201

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/borrowings/<int:borrowing_id>/return", methods=["PUT"])
def return_book(borrowing_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Find borrowing record
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

        if borrowing["status"] == "returned":
            cursor.close()
            connection.close()

            return jsonify({
                "status": "error",
                "message": "Book has already been returned."
            }), 400

        # Mark borrowing as returned
        cursor.execute("""
            UPDATE borrowings
            SET returned_at = CURRENT_TIMESTAMP,
                status = 'returned'
            WHERE id = %s
        """, (borrowing_id,))

        # Increase available quantity
        cursor.execute("""
            UPDATE books
            SET available_quantity = available_quantity + 1,
                status = 'available'
            WHERE id = %s
        """, (borrowing["book_id"],))

        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({
            "status": "success",
            "message": "Book returned successfully!"
        })

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500



@app.route("/api/books/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check if book exists
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

        # Don't allow deleting a book with active borrowings
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

@app.route("/api/books/<int:book_id>", methods=["PUT"])
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

        # Get current book
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

        borrowed_quantity = book["quantity"] - book["available_quantity"]

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




if __name__ == "__main__":
    app.run(debug=True)