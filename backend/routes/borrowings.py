import logging

from flask import Blueprint, jsonify, request
import mysql.connector

from database import get_db_connection
from .auth import require_role


borrowings_bp = Blueprint("borrowings", __name__)
logger = logging.getLogger(__name__)


# =========================================================
# GET ALL BORROWINGS (LEGACY HISTORY + RELEASED QR BATCHES)
# =========================================================
@borrowings_bp.route("/api/borrowings", methods=["GET"])
@require_role("admin", "librarian")
def get_borrowings():
    """Return one normalized list while preserving historical legacy rows.

    New borrowing transactions are stored in borrow_batches/borrow_requests.
    Existing records in borrowings remain visible as legacy history.
    """
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT *
            FROM (
                SELECT
                    CONCAT('legacy-', br.id) AS id,
                    br.id AS borrowing_id,
                    NULL AS batch_id,
                    'legacy' AS source,
                    br.user_id,
                    br.book_id,
                    br.borrowed_at,
                    br.due_date,
                    br.returned_at,
                    CASE
                        WHEN br.returned_at IS NOT NULL OR br.status = 'returned' THEN 'returned'
                        WHEN br.status = 'overdue' OR br.due_date < CURDATE() THEN 'overdue'
                        ELSE 'borrowed'
                    END AS status,
                    u.name AS user_name,
                    b.title AS book_title
                FROM borrowings br
                INNER JOIN users u ON u.id = br.user_id
                INNER JOIN books b ON b.id = br.book_id

                UNION ALL

                SELECT
                    CONCAT('batch-', req.id) AS id,
                    req.id AS borrowing_id,
                    batch.id AS batch_id,
                    'qr_batch' AS source,
                    req.user_id,
                    req.book_id,
                    batch.borrow_qr_used_at AS borrowed_at,
                    batch.due_date,
                    req.returned_at,
                    CASE
                        WHEN req.returned_at IS NOT NULL THEN 'returned'
                        WHEN batch.due_date < UTC_TIMESTAMP() THEN 'overdue'
                        ELSE 'borrowed'
                    END AS status,
                    u.name AS user_name,
                    b.title AS book_title
                FROM borrow_requests req
                INNER JOIN borrow_batches batch ON batch.id = req.batch_id
                INNER JOIN users u ON u.id = req.user_id
                INNER JOIN books b ON b.id = req.book_id
                WHERE req.status = 'approved'
                  AND batch.borrow_qr_used_at IS NOT NULL
            ) AS all_borrowings
            ORDER BY borrowed_at DESC, id DESC
        """)
        rows = cursor.fetchall()
        return jsonify({"status": "success", "borrowings": rows}), 200

    except mysql.connector.Error:
        logger.exception("Unable to retrieve borrowing records")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve borrowing records right now."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================================================
# LEGACY WRITE ENDPOINTS (DISABLED)
# =========================================================
@borrowings_bp.route("/api/borrowings", methods=["POST"])
@require_role("librarian")
def add_borrowing():
    """Direct creation is disabled to prevent bypassing student approval/QR release."""
    return jsonify({
        "status": "error",
        "message": "Direct borrowing creation is disabled. Use the student borrow request and librarian QR release workflow."
    }), 409


@borrowings_bp.route("/api/borrowings/<int:borrowing_id>", methods=["PUT"])
@require_role("librarian")
def update_borrowing(borrowing_id):
    """Direct returns are disabled; returns must be completed through Return QR."""
    return jsonify({
        "status": "error",
        "message": "Direct borrowing updates are disabled. Use the librarian Return QR workflow."
    }), 409


# =========================================================
# GET OVERDUE BORROWINGS (LEGACY + QR BATCH)
# =========================================================
@borrowings_bp.route("/api/borrowings/overdue", methods=["GET"])
@require_role("admin", "librarian")
def get_overdue_borrowings():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT *
            FROM (
                SELECT
                    CONCAT('legacy-', br.id) AS id,
                    br.id AS borrowing_id,
                    NULL AS batch_id,
                    'legacy' AS source,
                    br.user_id,
                    u.name AS user_name,
                    u.email AS user_email,
                    br.book_id,
                    b.title AS book_title,
                    br.borrowed_at,
                    br.due_date,
                    br.returned_at,
                    'overdue' AS status
                FROM borrowings br
                INNER JOIN users u ON u.id = br.user_id
                INNER JOIN books b ON b.id = br.book_id
                WHERE br.returned_at IS NULL
                  AND br.status <> 'returned'
                  AND br.due_date < CURDATE()

                UNION ALL

                SELECT
                    CONCAT('batch-', req.id) AS id,
                    req.id AS borrowing_id,
                    batch.id AS batch_id,
                    'qr_batch' AS source,
                    req.user_id,
                    u.name AS user_name,
                    u.email AS user_email,
                    req.book_id,
                    b.title AS book_title,
                    batch.borrow_qr_used_at AS borrowed_at,
                    batch.due_date,
                    req.returned_at,
                    'overdue' AS status
                FROM borrow_requests req
                INNER JOIN borrow_batches batch ON batch.id = req.batch_id
                INNER JOIN users u ON u.id = req.user_id
                INNER JOIN books b ON b.id = req.book_id
                WHERE req.status = 'approved'
                  AND batch.borrow_qr_used_at IS NOT NULL
                  AND req.returned_at IS NULL
                  AND batch.due_date < UTC_TIMESTAMP()
            ) AS overdue_records
            ORDER BY due_date ASC, borrowed_at ASC
        """)
        overdue = cursor.fetchall()
        return jsonify({"status": "success", "overdue": overdue}), 200

    except mysql.connector.Error:
        logger.exception("Unable to retrieve overdue records")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve overdue records right now."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
