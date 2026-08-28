from flask import Blueprint, jsonify, request
import mysql.connector

from database import get_db_connection
from .auth import require_role


student_bp = Blueprint("student", __name__)


# =========================================================
# GET STUDENT BORROWINGS
# =========================================================

@student_bp.route("/api/student/borrowings/<int:user_id>", methods=["GET"])
@require_role("student")
def get_student_borrowings(user_id):

    authenticated_user_id = request.authenticated_user_id

    # Student can only view their own records
    if authenticated_user_id != user_id:
        return jsonify({
            "status": "error",
            "message": "You can only view your own borrowings."
        }), 403

    conn = get_db_connection()

    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:

        cursor.execute("""
            SELECT
                br.id AS request_id,
                br.status AS request_status,
                br.qr_token,
                b.id AS book_id,
                b.title,
                b.author,
                bw.id AS borrowing_id,
                bw.borrowed_at,
                bw.due_date,
                bw.returned_at,
                bw.status AS borrowing_status
            FROM borrow_requests br

            INNER JOIN books b
                ON br.book_id = b.id

            LEFT JOIN borrowings bw
                ON bw.user_id = br.user_id
                AND bw.book_id = br.book_id

            WHERE br.user_id = %s

            ORDER BY br.id DESC
        """, (user_id,))

        records = cursor.fetchall()

        return jsonify({
            "status": "success",
            "user_id": user_id,
            "borrowings": records
        }), 200

    except mysql.connector.Error as error:

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:

        cursor.close()
        conn.close()


# =========================================================
# GET STUDENT PROFILE
# =========================================================

@student_bp.route("/api/student/profile/<int:user_id>", methods=["GET"])
@require_role("student")
def get_student_profile(user_id):

    authenticated_user_id = request.authenticated_user_id

    if authenticated_user_id != user_id:
        return jsonify({
            "status": "error",
            "message": "You can only view your own profile."
        }), 403

    conn = get_db_connection()

    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:

        cursor.execute("""
            SELECT
                id,
                name,
                email,
                role,
                created_at
            FROM users
            WHERE id = %s
              AND role = 'student'
        """, (user_id,))

        user = cursor.fetchone()

        if not user:
            return jsonify({
                "status": "error",
                "message": "Student not found."
            }), 404

        return jsonify({
            "status": "success",
            "user": user
        }), 200

    except mysql.connector.Error as error:

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:

        cursor.close()
        conn.close()

# UPDATE OVERDUE BORROWINGS
@student_bp.route(
    "/api/student/borrowings/<int:user_id>/status",
    methods=["GET"]
)
@require_role("student")
def update_student_borrowing_status(user_id):

    authenticated_user_id = request.authenticated_user_id

    if authenticated_user_id != user_id:
        return jsonify({
            "status": "error",
            "message": "You can only view your own borrowings."
        }), 403

    conn = get_db_connection()

    if conn is None:
        return jsonify({
            "status": "error",
            "message": "Database connection failed."
        }), 500

    cursor = conn.cursor(dictionary=True)

    try:

        # Automatically mark overdue books
        cursor.execute("""
            UPDATE borrowings
            SET status = 'overdue'
            WHERE user_id = %s
              AND status = 'borrowed'
              AND due_date < CURDATE()
              AND returned_at IS NULL
        """, (user_id,))

        conn.commit()

        # Get updated borrowing records
        cursor.execute("""
            SELECT
                bw.id AS borrowing_id,
                bw.book_id,
                b.title,
                b.author,
                bw.borrowed_at,
                bw.due_date,
                bw.returned_at,
                bw.status
            FROM borrowings bw
            INNER JOIN books b
                ON bw.book_id = b.id
            WHERE bw.user_id = %s
            ORDER BY bw.id DESC
        """, (user_id,))

        borrowings = cursor.fetchall()

        return jsonify({
            "status": "success",
            "user_id": user_id,
            "borrowings": borrowings
        }), 200

    except mysql.connector.Error as error:

        conn.rollback()

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:

        cursor.close()
        conn.close()