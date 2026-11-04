import logging

from flask import Blueprint, jsonify, request
import mysql.connector

from database import get_db_connection
from .auth import require_role


student_bp = Blueprint("student", __name__)
logger = logging.getLogger(__name__)


def _get_student_borrowing_records(cursor, user_id):
    """Return a unified, read-only borrowing history for one student.

    Historical direct borrowings remain in `borrowings`. New QR workflow
    transactions are represented by released, approved rows in
    `borrow_requests` joined to `borrow_batches`.

    QR tokens are deliberately not included in this history response. The
    dedicated batch QR endpoint is responsible for returning the currently
    valid token to the owning student.
    """
    cursor.execute(
        """
        SELECT *
        FROM (
            SELECT
                CONCAT('legacy-', bw.id) AS record_id,
                'legacy' AS source,
                NULL AS request_id,
                NULL AS batch_id,
                bw.id AS borrowing_id,
                bw.user_id,
                bw.book_id,
                b.title,
                b.author,
                bw.borrowed_at,
                bw.due_date,
                bw.returned_at,
                NULL AS request_status,
                NULL AS qr_token,
                CASE
                    WHEN bw.returned_at IS NOT NULL
                         OR bw.status = 'returned' THEN 'returned'
                    WHEN bw.due_date IS NOT NULL
                         AND bw.due_date < CURDATE() THEN 'overdue'
                    ELSE 'borrowed'
                END AS status,
                CASE
                    WHEN bw.returned_at IS NOT NULL
                         OR bw.status = 'returned' THEN 'returned'
                    WHEN bw.due_date IS NOT NULL
                         AND bw.due_date < CURDATE() THEN 'overdue'
                    ELSE 'borrowed'
                END AS borrowing_status
            FROM borrowings bw
            INNER JOIN books b ON b.id = bw.book_id
            WHERE bw.user_id = %s

            UNION ALL

            SELECT
                CONCAT('batch-', req.id) AS record_id,
                'qr_batch' AS source,
                req.id AS request_id,
                batch.id AS batch_id,
                req.id AS borrowing_id,
                req.user_id,
                req.book_id,
                b.title,
                b.author,
                batch.borrow_qr_used_at AS borrowed_at,
                batch.due_date,
                req.returned_at,
                req.status AS request_status,
                NULL AS qr_token,
                CASE
                    WHEN req.returned_at IS NOT NULL THEN 'returned'
                    WHEN batch.due_date IS NOT NULL
                         AND batch.due_date < CURDATE() THEN 'overdue'
                    ELSE 'borrowed'
                END AS status,
                CASE
                    WHEN req.returned_at IS NOT NULL THEN 'returned'
                    WHEN batch.due_date IS NOT NULL
                         AND batch.due_date < CURDATE() THEN 'overdue'
                    ELSE 'borrowed'
                END AS borrowing_status
            FROM borrow_requests req
            INNER JOIN borrow_batches batch ON batch.id = req.batch_id
            INNER JOIN books b ON b.id = req.book_id
            WHERE req.user_id = %s
              AND req.batch_id IS NOT NULL
              AND req.status = 'approved'
              AND batch.borrow_qr_used_at IS NOT NULL
        ) AS student_history
        ORDER BY borrowed_at DESC, record_id DESC
        """,
        (user_id, user_id),
    )
    return cursor.fetchall()


def _load_student_borrowings(user_id):
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
        records = _get_student_borrowing_records(cursor, user_id)
        return jsonify({
            "status": "success",
            "user_id": user_id,
            "borrowings": records,
            "total": len(records),
        }), 200

    except mysql.connector.Error:
        logger.exception("Unable to retrieve student borrowing history")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve borrowing history right now.",
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


def _verify_student_owns_path(user_id):
    authenticated_user_id = getattr(request, "authenticated_user_id", None)
    if authenticated_user_id != user_id:
        return jsonify({
            "status": "error",
            "message": "You can only view your own records.",
        }), 403
    return None


# =========================================================
# GET STUDENT BORROWINGS — LEGACY + QR BATCH HISTORY
# =========================================================
@student_bp.route("/api/student/borrowings/<int:user_id>", methods=["GET"])
@require_role("student")
def get_student_borrowings(user_id):
    ownership_error = _verify_student_owns_path(user_id)
    if ownership_error:
        return ownership_error
    return _load_student_borrowings(user_id)


# =========================================================
# GET STUDENT PROFILE
# =========================================================
@student_bp.route("/api/student/profile/<int:user_id>", methods=["GET"])
@require_role("student")
def get_student_profile(user_id):
    ownership_error = _verify_student_owns_path(user_id)
    if ownership_error:
        return ownership_error

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
            WHERE id = %s AND role = 'student'
            LIMIT 1
            """,
            (user_id,),
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({
                "status": "error",
                "message": "Student not found.",
            }), 404

        return jsonify({"status": "success", "user": user}), 200

    except mysql.connector.Error:
        logger.exception("Unable to retrieve student profile")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve student profile right now.",
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================================================
# LEGACY COMPATIBILITY ROUTE — NOW READ-ONLY
# =========================================================
@student_bp.route(
    "/api/student/borrowings/<int:user_id>/status",
    methods=["GET"],
)
@require_role("student")
def get_student_borrowing_status(user_id):
    """Return computed statuses; GET requests must not mutate loan records.

    This keeps the old URL working while removing the former behavior that
    updated only the legacy `borrowings` table and ignored QR batch loans.
    """
    ownership_error = _verify_student_owns_path(user_id)
    if ownership_error:
        return ownership_error
    return _load_student_borrowings(user_id)
