import logging

from flask import Blueprint, jsonify, request
import mysql.connector
from werkzeug.security import generate_password_hash

from database import get_db_connection
from routes.auth import require_role


users_bp = Blueprint("users", __name__)
logger = logging.getLogger(__name__)


_ROLE_NAMES = {"student", "librarian", "admin"}


def _get_role_id(cursor, role_name):
    """Return the canonical role ID from the roles table, or None."""
    cursor.execute(
        "SELECT id FROM roles WHERE LOWER(role_name) = %s LIMIT 1",
        (role_name.lower(),),
    )
    role = cursor.fetchone()
    return role["id"] if role else None


# GET ALL USERS: admin only
@users_bp.route("/api/users", methods=["GET"])
@require_role("admin")
def get_users():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({
                "status": "error",
                "message": "Database connection failed.",
            }), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                u.id, u.name, u.email, u.role, u.created_at,
                s.student_number, s.program, s.college, s.year_level, s.gender
            FROM users AS u
            LEFT JOIN students AS s ON s.user_id = u.id
            ORDER BY u.id DESC
            """
        )
        return jsonify(cursor.fetchall()), 200

    except mysql.connector.Error:
        logger.exception("Database error while retrieving users")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve users right now.",
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# CREATE USER / STUDENT ACCOUNT
# Public registration is deliberately restricted to the student role.
@users_bp.route("/api/users", methods=["POST"])
def add_user():
    connection = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")

        if (
            not isinstance(name, str)
            or not name.strip()
            or not isinstance(email, str)
            or not email.strip()
            or not isinstance(password, str)
            or not password
        ):
            return jsonify({
                "status": "error",
                "message": "Name, email, and password are required.",
            }), 400

        name = name.strip()
        email = email.strip()
        if len(name) > 100 or len(email) > 100:
            return jsonify({
                "status": "error",
                "message": "Name and email must not exceed 100 characters.",
            }), 400
        if len(password) > 1024:
            return jsonify({
                "status": "error",
                "message": "Password is too long.",
            }), 400

        connection = get_db_connection()
        if connection is None:
            return jsonify({
                "status": "error",
                "message": "Database connection failed.",
            }), 500

        cursor = connection.cursor(dictionary=True)
        student_role_id = _get_role_id(cursor, "student")
        if student_role_id is None:
            return jsonify({
                "status": "error",
                "message": "Student role is not configured in the database.",
            }), 500

        cursor.execute(
            """
            INSERT INTO users (name, email, password, role, role_id)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                name,
                email,
                generate_password_hash(password),
                "student",
                student_role_id,
            ),
        )
        user_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO students (user_id) VALUES (%s)",
            (user_id,),
        )
        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Student account created successfully!",
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": "student",
            },
        }), 201

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()
        # MySQL/MariaDB duplicate-key error code.
        if getattr(error, "errno", None) == 1062:
            return jsonify({
                "status": "error",
                "message": "Email already exists.",
            }), 409
        logger.exception("Integrity error while creating student account")
        return jsonify({
            "status": "error",
            "message": "Unable to create account because of a database constraint.",
        }), 500

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error while creating student account")
        return jsonify({
            "status": "error",
            "message": "Unable to create account right now. Please try again.",
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()




# =========================================================
# ADMIN EDITS A STUDENT ACCOUNT AND ITS SCHOOL PROFILE
# =========================================================
@users_bp.route("/api/users/<int:user_id>", methods=["PUT"])
@require_role("admin")
def update_student(user_id):
    connection = None
    cursor = None
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"status": "error", "message": "A JSON object is required."}), 400

        required_fields = ("name", "email", "student_number", "program", "college", "gender")
        cleaned = {}
        for field in required_fields:
            value = data.get(field)
            if not isinstance(value, str) or not value.strip():
                return jsonify({"status": "error", "message": f"{field.replace('_', ' ').title()} is required."}), 400
            cleaned[field] = value.strip()

        limits = {"name": 100, "email": 100, "student_number": 50,
                  "program": 100, "college": 150, "gender": 50}
        for field, limit in limits.items():
            if len(cleaned[field]) > limit:
                return jsonify({"status": "error", "message": f"{field.replace('_', ' ').title()} exceeds {limit} characters."}), 400

        try:
            year_level = int(data.get("year_level"))
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Valid year level is required."}), 400
        if year_level not in (1, 2, 3, 4, 5, 6):
            return jsonify({"status": "error", "message": "Year level must be from 1 to 6."}), 400

        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT id FROM users
            WHERE id = %s AND LOWER(role) = 'student'
            FOR UPDATE
        """, (user_id,))
        if cursor.fetchone() is None:
            connection.rollback()
            return jsonify({"status": "error", "message": "Student account not found."}), 404

        cursor.execute("""
            UPDATE users SET name = %s, email = %s
            WHERE id = %s AND LOWER(role) = 'student'
        """, (cleaned["name"], cleaned["email"], user_id))

        # Older accounts may not yet have a students profile row.
        cursor.execute("SELECT user_id FROM students WHERE user_id = %s FOR UPDATE", (user_id,))
        profile_exists = cursor.fetchone() is not None
        details = (cleaned["student_number"], cleaned["program"], cleaned["college"],
                   year_level, cleaned["gender"])
        if profile_exists:
            cursor.execute("""
                UPDATE students SET student_number = %s, program = %s,
                    college = %s, year_level = %s, gender = %s
                WHERE user_id = %s
            """, (*details, user_id))
        else:
            cursor.execute("""
                INSERT INTO students
                    (user_id, student_number, program, college, year_level, gender)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (user_id, *details))
        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Student account and school information updated successfully.",
            "user": {"id": user_id, "role": "student", **cleaned, "year_level": year_level},
        }), 200
    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()
        if getattr(error, "errno", None) == 1062:
            return jsonify({"status": "error", "message": "Email or School ID already belongs to another account."}), 409
        logger.exception("Integrity error while updating student account")
        return jsonify({"status": "error", "message": "Student information could not be saved."}), 500
    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error while updating student account")
        return jsonify({"status": "error", "message": "Unable to update student information right now."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

# =========================================================
# ADMIN DELETES A STUDENT ACCOUNT
# Keep borrowing, request, and QR batch history intact.
# Students with existing library history are therefore protected
# from hard deletion.
# =========================================================
@users_bp.route("/api/users/<int:user_id>", methods=["DELETE"])
@require_role("admin")
def delete_student(user_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({
                "status": "error",
                "message": "Database connection failed.",
            }), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, name
            FROM users
            WHERE id = %s AND LOWER(role) = 'student'
            FOR UPDATE
            """,
            (user_id,),
        )
        student = cursor.fetchone()

        if not student:
            return jsonify({
                "status": "error",
                "message": "Student account not found.",
            }), 404

        history_checks = (
            ("borrowings", "borrowing records"),
            ("borrow_requests", "borrow requests"),
            ("borrow_batches", "QR borrowing batches"),
        )

        for table_name, description in history_checks:
            cursor.execute(
                f"SELECT COUNT(*) AS total FROM {table_name} WHERE user_id = %s",
                (user_id,),
            )
            if int(cursor.fetchone()["total"]) > 0:
                return jsonify({
                    "status": "error",
                    "message": (
                        f"This student has {description}. "
                        "The account was not deleted so library transaction "
                        "and QR history are preserved."
                    ),
                }), 409

        cursor.execute(
            "DELETE FROM users WHERE id = %s AND LOWER(role) = 'student'",
            (user_id,),
        )
        connection.commit()

        return jsonify({
            "status": "success",
            "message": f"Student account for {student['name']} was deleted.",
            "user_id": user_id,
        }), 200

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error while deleting student account")
        return jsonify({
            "status": "error",
            "message": "Unable to delete this student account right now.",
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ADMIN CREATES A NEW, SEPARATE LIBRARIAN ACCOUNT
# Does not modify users with role student or their borrowing history.
@users_bp.route("/api/admin/librarians", methods=["POST"])
@require_role("admin")
def create_librarian_account():
    connection = None
    cursor = None
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"status": "error", "message": "A JSON object is required."}), 400

        name = data.get("name")
        email = data.get("email")
        password = data.get("password")
        if (not isinstance(name, str) or not name.strip()
                or not isinstance(email, str) or not email.strip()
                or not isinstance(password, str)):
            return jsonify({"status": "error", "message": "Name, email, and password are required."}), 400

        name = name.strip()
        email = email.strip().lower()
        if len(name) > 100 or len(email) > 100:
            return jsonify({"status": "error", "message": "Name and email must not exceed 100 characters."}), 400
        if "@" not in email or email.startswith("@") or email.endswith("@") or any(c.isspace() for c in email):
            return jsonify({"status": "error", "message": "A valid email address is required."}), 400
        if len(password) < 8 or len(password) > 128:
            return jsonify({"status": "error", "message": "Password must contain 8 to 128 characters."}), 400

        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500
        cursor = connection.cursor(dictionary=True)
        role_id = _get_role_id(cursor, "librarian")
        if role_id is None:
            return jsonify({"status": "error", "message": "Librarian role is not configured in the database."}), 500

        cursor.execute("""
            INSERT INTO users (name, email, password, role, role_id)
            VALUES (%s, %s, %s, 'librarian', %s)
        """, (name, email, generate_password_hash(password), role_id))
        user_id = cursor.lastrowid
        cursor.execute("INSERT INTO librarians (user_id) VALUES (%s)", (user_id,))
        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Librarian account created successfully.",
            "user": {"id": user_id, "name": name, "email": email, "role": "librarian"},
        }), 201
    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()
        if getattr(error, "errno", None) == 1062:
            return jsonify({"status": "error", "message": "Email already exists."}), 409
        logger.exception("Integrity error creating librarian")
        return jsonify({"status": "error", "message": "Unable to create librarian account."}), 500
    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error creating librarian")
        return jsonify({"status": "error", "message": "Unable to create librarian account right now."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ADMIN ASSIGNS A STUDENT AS LIBRARIAN
@users_bp.route("/api/users/<int:user_id>/assign-librarian", methods=["PUT"])
@require_role("admin")
def assign_librarian(user_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({
                "status": "error",
                "message": "Database connection failed.",
            }), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, name, email, role FROM users WHERE id = %s FOR UPDATE",
            (user_id,),
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({"status": "error", "message": "User not found."}), 404
        if user["role"] == "admin":
            return jsonify({
                "status": "error",
                "message": "Admin cannot be assigned as librarian.",
            }), 400
        if user["role"] == "librarian":
            return jsonify({
                "status": "error",
                "message": "User is already a librarian.",
            }), 400

        librarian_role_id = _get_role_id(cursor, "librarian")
        if librarian_role_id is None:
            return jsonify({
                "status": "error",
                "message": "Librarian role is not configured in the database.",
            }), 500

        # Keep the role string, role_id, and role-specific profile table aligned.
        cursor.execute("DELETE FROM students WHERE user_id = %s", (user_id,))
        cursor.execute(
            "UPDATE users SET role = %s, role_id = %s WHERE id = %s",
            ("librarian", librarian_role_id, user_id),
        )
        cursor.execute(
            "INSERT IGNORE INTO librarians (user_id) VALUES (%s)",
            (user_id,),
        )
        connection.commit()

        return jsonify({
            "status": "success",
            "message": "User assigned as librarian successfully.",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": "librarian",
            },
        }), 200

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error while assigning librarian role")
        return jsonify({
            "status": "error",
            "message": "Unable to assign librarian role right now.",
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ADMIN REMOVES A LIBRARIAN; THE ACCOUNT RETURNS TO STUDENT ROLE
@users_bp.route("/api/users/<int:user_id>/remove-librarian", methods=["PUT"])
@require_role("admin")
def remove_librarian(user_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({
                "status": "error",
                "message": "Database connection failed.",
            }), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, name, email, role FROM users WHERE id = %s FOR UPDATE",
            (user_id,),
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({"status": "error", "message": "User not found."}), 404
        if user["role"] != "librarian":
            return jsonify({
                "status": "error",
                "message": "User is not a librarian.",
            }), 400

        student_role_id = _get_role_id(cursor, "student")
        if student_role_id is None:
            return jsonify({
                "status": "error",
                "message": "Student role is not configured in the database.",
            }), 500

        cursor.execute("DELETE FROM librarians WHERE user_id = %s", (user_id,))
        cursor.execute(
            "UPDATE users SET role = %s, role_id = %s WHERE id = %s",
            ("student", student_role_id, user_id),
        )
        cursor.execute(
            "INSERT IGNORE INTO students (user_id) VALUES (%s)",
            (user_id,),
        )
        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Librarian removed successfully.",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": "student",
            },
        }), 200

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error while removing librarian role")
        return jsonify({
            "status": "error",
            "message": "Unable to remove librarian role right now.",
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
        

# ADMIN EDITS A LIBRARIAN ACCOUNT (NAME AND EMAIL ONLY)
@users_bp.route("/api/users/<int:user_id>/librarian", methods=["PUT"])
@require_role("admin")
def update_librarian(user_id):
    connection = None
    cursor = None
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"status": "error", "message": "A JSON object is required."}), 400
        name = data.get("name")
        email = data.get("email")
        if not isinstance(name, str) or not name.strip() or not isinstance(email, str) or not email.strip():
            return jsonify({"status": "error", "message": "Librarian name and email are required."}), 400
        name, email = name.strip(), email.strip()
        if len(name) > 100 or len(email) > 100:
            return jsonify({"status": "error", "message": "Name and email must not exceed 100 characters."}), 400

        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE id = %s AND LOWER(role) = 'librarian' FOR UPDATE", (user_id,))
        if cursor.fetchone() is None:
            return jsonify({"status": "error", "message": "Librarian account not found."}), 404
        cursor.execute(
            "UPDATE users SET name = %s, email = %s WHERE id = %s AND LOWER(role) = 'librarian'",
            (name, email, user_id),
        )
        connection.commit()
        return jsonify({"status": "success", "message": "Librarian account updated successfully.",
                        "user": {"id": user_id, "name": name, "email": email, "role": "librarian"}}), 200
    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()
        if getattr(error, "errno", None) == 1062:
            return jsonify({"status": "error", "message": "That email address is already used by another account."}), 409
        logger.exception("Integrity error updating librarian")
        return jsonify({"status": "error", "message": "Unable to update librarian account."}), 500
    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error updating librarian")
        return jsonify({"status": "error", "message": "Unable to update librarian account right now."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ADMIN DELETES A LIBRARIAN ACCOUNT WITHOUT DESTROYING LIBRARY HISTORY
@users_bp.route("/api/users/<int:user_id>/librarian", methods=["DELETE"])
@require_role("admin")
def delete_librarian(user_id):
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, name FROM users WHERE id = %s AND LOWER(role) = 'librarian' FOR UPDATE",
            (user_id,),
        )
        librarian = cursor.fetchone()
        if not librarian:
            return jsonify({"status": "error", "message": "Librarian account not found."}), 404

        # Existing borrowing/QR history must never be silently deleted.
        for table_name, description in (
            ("borrowings", "borrowing records"),
            ("borrow_requests", "borrow requests"),
            ("borrow_batches", "QR borrowing batches"),
        ):
            cursor.execute(f"SELECT COUNT(*) AS total FROM {table_name} WHERE user_id = %s", (user_id,))
            if int(cursor.fetchone()["total"]) > 0:
                return jsonify({"status": "error", "message":
                                f"This librarian has {description}. Account deletion is blocked to preserve library history."}), 409

        cursor.execute("DELETE FROM librarians WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = %s AND LOWER(role) = 'librarian'", (user_id,))
        connection.commit()
        return jsonify({"status": "success", "message": f"Librarian account for {librarian['name']} was deleted.",
                        "user_id": user_id}), 200
    except mysql.connector.IntegrityError:
        if connection:
            connection.rollback()
        logger.exception("Librarian deletion blocked by database references")
        return jsonify({"status": "error", "message":
                        "This librarian is referenced by other records. Deletion was blocked to preserve library history."}), 409
    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error deleting librarian")
        return jsonify({"status": "error", "message": "Unable to delete librarian account right now."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
