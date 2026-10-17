from flask import Blueprint, jsonify, request
import mysql.connector

from database import get_db_connection


auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.get_json() or {}

        email = data.get("email")
        password = data.get("password")
        requested_role = data.get("role")

        if not email or not password:
            return jsonify({
                "status": "error",
                "message": "Email and password are required."
            }), 400

        if requested_role not in ["student", "librarian", "admin"]:
            return jsonify({
                "status": "error",
                "message": "A valid login role is required."
            }), 400

        connection = get_db_connection()
        if connection is None:
            return jsonify({
                "status": "error",
                "message": "Database connection failed."
            }), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, name, email, password, role, created_at
            FROM users
            WHERE email = %s
            LIMIT 1
        """, (email,))

        user = cursor.fetchone()

        cursor.close()
        connection.close()

        if not user:
            return jsonify({
                "status": "error",
                "message": "Invalid email or password."
            }), 401

        if password != user["password"]:
            return jsonify({
                "status": "error",
                "message": "Invalid email or password."
            }), 401

        if user["role"] != requested_role:
            return jsonify({
                "status": "error",
                "message": f"This account is not registered as a {requested_role}."
            }), 403

        return jsonify({
            "status": "success",
            "message": "Login successful!",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"]
            }
        }), 200

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


# ROLE PROTECTION HELPER

def require_role(required_role):
    def decorator(function):

        from functools import wraps

        @wraps(function)
        def wrapper(*args, **kwargs):

            user_id = request.headers.get("X-User-ID")

            if not user_id:
                return jsonify({
                    "status": "error",
                    "message": "Authentication required."
                }), 401

            try:
                connection = get_db_connection()
                if connection is None:
                    return jsonify({
                        "status": "error",
                        "message": "Database connection failed."
                    }), 500

                cursor = connection.cursor(dictionary=True)

                cursor.execute("""
                    SELECT id, name, email, role
                    FROM users
                    WHERE id = %s
                """, (user_id,))

                user = cursor.fetchone()

                cursor.close()
                connection.close()

                if not user:
                    return jsonify({
                        "status": "error",
                        "message": "User not found."
                    }), 401

                if user["role"] != required_role:
                    return jsonify({
                        "status": "error",
                        "message": "You do not have permission to perform this action."
                    }), 403

                request.authenticated_user_id = user["id"]

                return function(*args, **kwargs)

            except mysql.connector.Error as error:

                return jsonify({
                    "status": "error",
                    "message": str(error)
                }), 500

        return wrapper

    return decorator
