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
            SELECT id, name, email, role, created_at
            FROM users
            ORDER BY id DESC
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
