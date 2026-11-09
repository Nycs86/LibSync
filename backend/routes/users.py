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
                u.id,
                u.name,
                u.email,
                u.role,
                u.created_at,
                s.student_number,
                s.program,
                s.college,
                s.year_level,
                s.gender
            FROM users u
            LEFT JOIN students s ON s.user_id = u.id
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
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"status": "error", "message": "Request body must be a valid JSON object."}), 400
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")
        student_number = data.get("student_number")
        program = data.get("program")
        college = data.get("college")
        gender = data.get("gender")
        year_level_raw = data.get("year_level")

        required_text = {
            "Name": name,
            "Email": email,
            "School ID": student_number,
            "Program": program,
            "College": college,
            "Gender": gender,
        }
        missing = [
            label for label, value in required_text.items()
            if not isinstance(value, str) or not value.strip()
        ]
        if missing or not isinstance(password, str) or not password:
            required = ", ".join(missing + (["Password"] if not isinstance(password, str) or not password else []))
            return jsonify({
                "status": "error",
                "message": f"The following fields are required: {required}.",
            }), 400

        name = name.strip()
        email = email.strip()
        student_number = student_number.strip()
        program = program.strip()
        college = college.strip()
        gender = gender.strip()

        if len(name) > 100 or len(email) > 100:
            return jsonify({
                "status": "error",
                "message": "Name and email must not exceed 100 characters.",
            }), 400
        if len(student_number) > 50:
            return jsonify({"status": "error", "message": "School ID must not exceed 50 characters."}), 400
        if len(program) > 100:
            return jsonify({"status": "error", "message": "Program must not exceed 100 characters."}), 400
        if len(college) > 150:
            return jsonify({"status": "error", "message": "College must not exceed 150 characters."}), 400
        if len(gender) > 50:
            return jsonify({"status": "error", "message": "Gender must not exceed 50 characters."}), 400
        if len(password) > 1024:
            return jsonify({"status": "error", "message": "Password is too long."}), 400

        try:
            year_level = int(year_level_raw)
        except (TypeError, ValueError):
            return jsonify({"status": "error", "message": "Please select a valid year level."}), 400
        if year_level < 1 or year_level > 6:
            return jsonify({"status": "error", "message": "Year level must be between 1 and 6."}), 400

        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500

        cursor = connection.cursor(dictionary=True)
        student_role_id = _get_role_id(cursor, "student")
        if student_role_id is None:
            return jsonify({"status": "error", "message": "Student role is not configured in the database."}), 500

        cursor.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(%s) LIMIT 1", (email,))
        if cursor.fetchone():
            return jsonify({"status": "error", "message": "Email already exists."}), 409

        cursor.execute("SELECT id FROM students WHERE student_number = %s LIMIT 1", (student_number,))
        if cursor.fetchone():
            return jsonify({"status": "error", "message": "School ID is already registered."}), 409

        cursor.execute(
            """
            INSERT INTO users (name, email, password, role, role_id)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (name, email, generate_password_hash(password), "student", student_role_id),
        )
        user_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO students (
                user_id, student_number, program, college, year_level, gender
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (user_id, student_number, program, college, year_level, gender),
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
                "student_number": student_number,
                "program": program,
                "college": college,
                "year_level": year_level,
                "gender": gender,
            },
        }), 201

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()
        if getattr(error, "errno", None) == 1062:
            message = str(error).lower()
            if "student_number" in message:
                return jsonify({"status": "error", "message": "School ID is already registered."}), 409
            return jsonify({"status": "error", "message": "Email already exists."}), 409
        logger.exception("Integrity error while creating student account")
        return jsonify({"status": "error", "message": "Unable to create account because of a database constraint."}), 500

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error while creating student account")
        return jsonify({"status": "error", "message": "Unable to create account right now. Please try again."}), 500

    except Exception:
        if connection:
            connection.rollback()
        logger.exception("Unexpected error while creating student account")
        return jsonify({"status": "error", "message": "Unable to create account right now. Please try again."}), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()



# =========================================================
# ADMIN EDITS A STUDENT ACCOUNT AND SCHOOL PROFILE
# =========================================================
@users_bp.route("/api/users/<int:user_id>", methods=["PUT"])
@require_role("admin")
def update_student(user_id):
    connection = None
    cursor = None

    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"status": "error", "message": "Request body must be a valid JSON object."}), 400
        name = data.get("name")
        email = data.get("email")

        if not isinstance(name, str) or not name.strip():
            return jsonify({"status": "error", "message": "Student name is required."}), 400
        if not isinstance(email, str) or not email.strip():
            return jsonify({"status": "error", "message": "Student email is required."}), 400

        name = name.strip()
        email = email.strip()
        if len(name) > 100 or len(email) > 100:
            return jsonify({"status": "error", "message": "Name and email must not exceed 100 characters."}), 400

        student_fields = ("student_number", "program", "college", "year_level", "gender")
        update_profile = any(field in data for field in student_fields)
        profile = {}
        if update_profile:
            for field, maximum in (("student_number", 50), ("program", 100), ("college", 150), ("gender", 50)):
                value = data.get(field, "")
                if value is None:
                    value = ""
                if not isinstance(value, str):
                    return jsonify({"status": "error", "message": f"{field.replace('_', ' ').title()} must be text."}), 400
                value = value.strip()
                if len(value) > maximum:
                    return jsonify({"status": "error", "message": f"{field.replace('_', ' ').title()} must not exceed {maximum} characters."}), 400
                profile[field] = value or None

            year_raw = data.get("year_level")
            if year_raw in (None, ""):
                profile["year_level"] = None
            else:
                try:
                    profile["year_level"] = int(year_raw)
                except (TypeError, ValueError):
                    return jsonify({"status": "error", "message": "Year level must be a number."}), 400
                if profile["year_level"] < 1 or profile["year_level"] > 6:
                    return jsonify({"status": "error", "message": "Year level must be between 1 and 6."}), 400

        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id FROM users WHERE id = %s AND LOWER(role) = 'student' FOR UPDATE",
            (user_id,),
        )
        student = cursor.fetchone()
        if not student:
            return jsonify({"status": "error", "message": "Student account not found."}), 404

        cursor.execute(
            "UPDATE users SET name = %s, email = %s WHERE id = %s AND LOWER(role) = 'student'",
            (name, email, user_id),
        )

        if update_profile:
            cursor.execute(
                """
                INSERT INTO students (user_id, student_number, program, college, year_level, gender)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    student_number = VALUES(student_number),
                    program = VALUES(program),
                    college = VALUES(college),
                    year_level = VALUES(year_level),
                    gender = VALUES(gender)
                """,
                (user_id, profile["student_number"], profile["program"], profile["college"], profile["year_level"], profile["gender"]),
            )

        connection.commit()
        updated_user = {"id": user_id, "name": name, "email": email, "role": "student"}
        if update_profile:
            updated_user.update(profile)

        return jsonify({
            "status": "success",
            "message": "Student account updated successfully.",
            "user": updated_user,
        }), 200

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()
        if getattr(error, "errno", None) == 1062:
            message = str(error).lower()
            if "student_number" in message:
                return jsonify({"status": "error", "message": "That School ID is already assigned to another student."}), 409
            return jsonify({"status": "error", "message": "That email address is already used by another account."}), 409
        logger.exception("Integrity error while updating student account")
        return jsonify({"status": "error", "message": "Unable to update this student account."}), 500

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        logger.exception("Database error while updating student account")
        return jsonify({"status": "error", "message": "Unable to update this student account right now."}), 500

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
