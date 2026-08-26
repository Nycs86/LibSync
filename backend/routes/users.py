from flask import Blueprint, jsonify, request
import mysql.connector

from database import get_db_connection


users_bp = Blueprint("users", __name__)


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

        return jsonify(users)

    except mysql.connector.Error as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@users_bp.route("/api/users", methods=["POST"])
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