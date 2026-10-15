from flask import Blueprint, jsonify, request
import mysql.connector
import requests
import time

from database import get_db_connection


books_bp = Blueprint("books", __name__)

# Starter catalog settings.
# If the books table has fewer than 5 books, LibSync automatically tops it up
# to around 20 books from Open Library the next time GET /api/books is called.
AUTO_SEED_TRIGGER_COUNT = 5
STARTER_TARGET_COUNT = 20
DEFAULT_STARTER_QUANTITY = 1

STARTER_SEARCHES = [
    ("programming", "Programming"),
    ("information technology", "Information Technology"),
    ("science", "Science"),
    ("mathematics", "Mathematics"),
    ("literature", "Literature"),
]


def _pick_isbn(isbn_list):
    """Prefer ISBN-13, otherwise use the first available ISBN."""
    if not isbn_list:
        return None

    for value in isbn_list:
        cleaned = str(value).replace("-", "").strip()
        if len(cleaned) == 13 and cleaned.isdigit():
            return str(value)

    return str(isbn_list[0])


def seed_starter_books(max_new_books):
    """
    Import starter books from Open Library.
    Returns the number of books successfully added to MySQL.
    """
    if max_new_books <= 0:
        return 0

    collected = []
    seen_isbns = set()

    try:
        for search_term, category_name in STARTER_SEARCHES:
            if len(collected) >= max_new_books:
                break

            response = requests.get(
                "https://openlibrary.org/search.json",
                params={
                    "q": search_term,
                    "limit": 12,
                    "fields": (
                        "key,title,author_name,isbn,"
                        "first_publish_year,publisher,cover_i"
                    ),
                },
                headers={
                    "User-Agent": "LibSync/1.0"
                },
                timeout=10,
            )

            response.raise_for_status()
            data = response.json()

            category_added = 0

            for item in data.get("docs", []):
                if len(collected) >= max_new_books:
                    break

                # Keep the starter catalog balanced across categories.
                if category_added >= 4:
                    break

                isbn = _pick_isbn(item.get("isbn", []))

                # Skip items without an ISBN so duplicate checking is reliable.
                if not isbn or isbn in seen_isbns:
                    continue

                title = (item.get("title") or "Unknown Title").strip()
                authors = item.get("author_name", [])
                author = (
                    ", ".join(authors).strip()
                    if authors
                    else "Unknown Author"
                )

                publishers = item.get("publisher", [])
                publisher = publishers[0] if publishers else None

                year_published = item.get("first_publish_year")

                # Keep text safely within common VARCHAR sizes.
                title = title[:255]
                author = author[:255]
                publisher = publisher[:255] if publisher else None
                category = category_name[:100]

                collected.append({
                    "title": title,
                    "author": author,
                    "isbn": isbn[:30],
                    "category": category,
                    "publisher": publisher,
                    "year_published": year_published,
                })

                seen_isbns.add(isbn)
                category_added += 1

            # Be polite to the public Open Library API.
            time.sleep(0.4)

    except requests.exceptions.RequestException as error:
        print("Open Library starter import error:", error)
        return 0

    connection = None
    cursor = None
    imported = 0

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        for book in collected:
            # Avoid duplicates if this function is ever called again.
            cursor.execute(
                """
                SELECT id
                FROM books
                WHERE isbn = %s
                LIMIT 1
                """,
                (book["isbn"],),
            )

            if cursor.fetchone():
                continue

            cursor.execute(
                """
                INSERT INTO books (
                    title,
                    author,
                    isbn,
                    category,
                    publisher,
                    year_published,
                    quantity,
                    available_quantity,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'available')
                """,
                (
                    book["title"],
                    book["author"],
                    book["isbn"],
                    book["category"],
                    book["publisher"],
                    book["year_published"],
                    DEFAULT_STARTER_QUANTITY,
                    DEFAULT_STARTER_QUANTITY,
                ),
            )

            imported += 1

        connection.commit()
        print(f"LibSync starter catalog imported {imported} book(s).")
        return imported

    except mysql.connector.Error as error:
        if connection:
            connection.rollback()

        print("Starter catalog database error:", error)
        return 0

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


@books_bp.route("/api/books/search-online", methods=["GET"])
def search_online_books():
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify({
            "status": "error",
            "message": "Search query is required."
        }), 400

    try:
        response = requests.get(
            "https://openlibrary.org/search.json",
            params={
                "q": query,
                "limit": 20,
                "fields": (
                    "key,title,author_name,isbn,"
                    "first_publish_year,publisher,subject,cover_i"
                )
            },
            headers={
                "User-Agent": "LibSync/1.0"
            },
            timeout=10
        )

        response.raise_for_status()
        data = response.json()

        results = []

        for item in data.get("docs", []):
            authors = item.get("author_name", [])
            publishers = item.get("publisher", [])
            subjects = item.get("subject", [])
            isbns = item.get("isbn", [])

            isbn = _pick_isbn(isbns)
            cover_id = item.get("cover_i")

            cover_url = None

            if cover_id:
                cover_url = (
                    f"https://covers.openlibrary.org/"
                    f"b/id/{cover_id}-M.jpg"
                )

            results.append({
                "openlibrary_key": item.get("key"),
                "title": item.get("title", "Unknown Title"),
                "author": (
                    ", ".join(authors)
                    if authors
                    else "Unknown Author"
                ),
                "isbn": isbn,
                "category": (
                    subjects[0]
                    if subjects
                    else "General"
                ),
                "publisher": (
                    publishers[0]
                    if publishers
                    else None
                ),
                "year_published": item.get("first_publish_year"),
                "cover_url": cover_url
            })

        return jsonify({
            "status": "success",
            "count": len(results),
            "books": results
        }), 200

    except requests.exceptions.Timeout:
        return jsonify({
            "status": "error",
            "message": "Open Library request timed out."
        }), 504

    except requests.exceptions.RequestException as error:
        print("Open Library API error:", error)

        return jsonify({
            "status": "error",
            "message": "Unable to connect to Open Library.",
            "details": str(error)
        }), 502


@books_bp.route("/api/books", methods=["GET"])
def get_books():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM books
        """)

        total = cursor.fetchone()["total"]

        cursor.close()
        connection.close()
        cursor = None
        connection = None

        # Automatic starter catalog:
        # a nearly empty database gets populated from Open Library.
        if total < AUTO_SEED_TRIGGER_COUNT:
            needed = STARTER_TARGET_COUNT - total
            seed_starter_books(needed)

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT *
            FROM books
            ORDER BY id DESC
        """)

        books = cursor.fetchall()

        return jsonify(books)

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


@books_bp.route("/api/books", methods=["POST"])
def add_book():
    connection = None
    cursor = None

    try:
        data = request.get_json() or {}

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

        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return jsonify({
                "status": "error",
                "message": "Quantity must be a whole number."
            }), 400

        if quantity < 1:
            return jsonify({
                "status": "error",
                "message": "Quantity must be at least 1."
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO books
            (
                title,
                author,
                isbn,
                category,
                publisher,
                year_published,
                quantity,
                available_quantity,
                status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'available')
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

        return jsonify({
            "status": "success",
            "message": "Book added successfully!",
            "book_id": book_id
        }), 201

    except mysql.connector.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "status": "error",
            "message": "ISBN already exists."
        }), 409

    except mysql.connector.Error as error:
        if connection:
            connection.rollback()

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


@books_bp.route("/api/books/<int:book_id>", methods=["PUT"])
def update_book(book_id):
    connection = None
    cursor = None

    try:
        data = request.get_json() or {}

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

        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return jsonify({
                "status": "error",
                "message": "Quantity must be a whole number."
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
            return jsonify({
                "status": "error",
                "message": "Book not found."
            }), 404

        borrowed_quantity = (
            book["quantity"] - book["available_quantity"]
        )

        if quantity < borrowed_quantity:
            return jsonify({
                "status": "error",
                "message": (
                    "Quantity cannot be less than the number "
                    "of borrowed copies."
                )
            }), 400

        new_available_quantity = quantity - borrowed_quantity
        status = (
            "available"
            if new_available_quantity > 0
            else "borrowed"
        )

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

        return jsonify({
            "status": "success",
            "message": "Book updated successfully!"
        })

    except mysql.connector.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "status": "error",
            "message": "ISBN already exists."
        }), 409

    except mysql.connector.Error as error:
        if connection:
            connection.rollback()

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


@books_bp.route("/api/books/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    connection = None
    cursor = None

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
            return jsonify({
                "status": "error",
                "message": "Book not found."
            }), 404

        borrowed_quantity = (
            book["quantity"] - book["available_quantity"]
        )

        if borrowed_quantity > 0:
            return jsonify({
                "status": "error",
                "message": (
                    "Cannot delete a book that is currently borrowed."
                )
            }), 400

        cursor.execute("""
            DELETE FROM books
            WHERE id = %s
        """, (book_id,))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Book deleted successfully!"
        })

    except mysql.connector.Error as error:
        if connection:
            connection.rollback()

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()
