from flask import Blueprint, jsonify, request
import mysql.connector

from routes.auth import require_role
from database import get_db_connection


users_bp = Blueprint("users", __name__)


# GET ALL USERS
@users_bp.route("/api/users", methods=["GET"])
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

        return jsonify(users), 200

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


# CREATE USER / STUDENT ACCOUNT
@users_bp.route("/api/users", methods=["POST"])
def add_user():
    connection = None
    cursor = None

    try:
        data = request.get_json() or {}

        name = data.get("name")
        email = data.get("email")
        password = data.get("password")

        if not name or not email or not password:
            return jsonify({
                "status": "error",
                "message": "Name, email, and password are required."
            }), 400

        # New registered users are students by default
        role = "student"

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO users (name, email, password, role)
            VALUES (%s, %s, %s, %s)
        """, (name, email, password, role))

        user_id = cursor.lastrowid

        # Also insert into students table
        cursor.execute("""
            INSERT INTO students (user_id)
            VALUES (%s)
        """, (user_id,))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Student account created successfully!",
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": "student"
            }
        }), 201

    except mysql.connector.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "status": "error",
            "message": "Email already exists."
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


# ADMIN ASSIGNS A STUDENT AS LIBRARIAN
@users_bp.route("/api/users/<int:user_id>/assign-librarian", methods=["PUT"])
@require_role("admin")
def assign_librarian(user_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, name, email, role
            FROM users
            WHERE id = %s
        """, (user_id,))

        user = cursor.fetchone()

        if not user:
            return jsonify({
                "status": "error",
                "message": "User not found."
            }), 404

        if user["role"] == "admin":
            return jsonify({
                "status": "error",
                "message": "Admin cannot be assigned as librarian."
            }), 400

        if user["role"] == "librarian":
            return jsonify({
                "status": "error",
                "message": "User is already a librarian."
            }), 400

        # Remove from students table
        cursor.execute("""
            DELETE FROM students
            WHERE user_id = %s
        """, (user_id,))

        # Change role
        cursor.execute("""
            UPDATE users
            SET role = 'librarian'
            WHERE id = %s
        """, (user_id,))

        # Add to librarians table
        cursor.execute("""
            INSERT INTO librarians (user_id)
            VALUES (%s)
        """, (user_id,))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "User assigned as librarian successfully.",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": "librarian"
            }
        }), 200

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

@users_bp.route("/api/users/<int:user_id>/remove-librarian", methods=["PUT"])
@require_role("admin")
def remove_librarian(user_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, name, email, role
            FROM users
            WHERE id = %s
        """, (user_id,))

        user = cursor.fetchone()

        if not user:
            return jsonify({
                "status": "error",
                "message": "User not found."
            }), 404

        if user["role"] != "librarian":
            return jsonify({
                "status": "error",
                "message": "User is not a librarian."
            }), 400

        cursor.execute("""
            DELETE FROM librarians
            WHERE user_id = %s
        """, (user_id,))

        cursor.execute("""
            UPDATE users
            SET role = 'student'
            WHERE id = %s
        """, (user_id,))

        cursor.execute("""
            INSERT IGNORE INTO students (user_id)
            VALUES (%s)
        """, (user_id,))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Librarian removed successfully.",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": "student"
            }
        }), 200

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