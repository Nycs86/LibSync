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
                         OR bw.status = 'returned'
                        THEN 'returned'
                    WHEN bw.due_date IS NOT NULL
                         AND bw.due_date < CURDATE()
                        THEN 'overdue'
                    ELSE 'borrowed'
                END AS status,
                CASE
                    WHEN bw.returned_at IS NOT NULL
                         OR bw.status = 'returned'
                        THEN 'returned'
                    WHEN bw.due_date IS NOT NULL
                         AND bw.due_date < CURDATE()
                        THEN 'overdue'
                    ELSE 'borrowed'
                END AS borrowing_status
            FROM borrowings bw
            INNER JOIN books b
                ON b.id = bw.book_id
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
                    WHEN req.returned_at IS NOT NULL
                        THEN 'returned'
                    WHEN batch.due_date IS NOT NULL
                         AND batch.due_date < UTC_TIMESTAMP()
                        THEN 'overdue'
                    ELSE 'borrowed'
                END AS status,
                CASE
                    WHEN req.returned_at IS NOT NULL
                        THEN 'returned'
                    WHEN batch.due_date IS NOT NULL
                         AND batch.due_date < UTC_TIMESTAMP()
                        THEN 'overdue'
                    ELSE 'borrowed'
                END AS borrowing_status
            FROM borrow_requests req
            INNER JOIN borrow_batches batch
                ON batch.id = req.batch_id
            INNER JOIN books b
                ON b.id = req.book_id
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
        records = _get_student_borrowing_records(
            cursor,
            user_id,
        )

        return jsonify({
            "status": "success",
            "user_id": user_id,
            "borrowings": records,
            "total": len(records),
        }), 200

    except mysql.connector.Error:
        logger.exception(
            "Database error while retrieving student borrowing history"
        )
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve borrowing history right now.",
        }), 500

    except Exception:
        logger.exception(
            "Unexpected error while retrieving student borrowing history"
        )
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
    authenticated_user_id = getattr(
        request,
        "authenticated_user_id",
        None,
    )

    if authenticated_user_id != user_id:
        return jsonify({
            "status": "error",
            "message": "You can only view your own records.",
        }), 403

    return None


# =========================================================
# GET STUDENT BORROWINGS - LEGACY + QR BATCH HISTORY
# =========================================================
@student_bp.route(
    "/api/student/borrowings/<int:user_id>",
    methods=["GET"],
)
@require_role("student")
def get_student_borrowings(user_id):
    ownership_error = _verify_student_owns_path(user_id)

    if ownership_error:
        return ownership_error

    return _load_student_borrowings(user_id)


# =========================================================
# GET STUDENT PROFILE
# =========================================================
@student_bp.route(
    "/api/student/profile/<int:user_id>",
    methods=["GET"],
)
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
            return jsonify({"status": "error", "message": "Database connection failed."}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                u.id, u.name, u.email, u.role,
                s.student_number, s.program, s.college, s.year_level, s.gender
            FROM users u
            LEFT JOIN students s ON s.user_id = u.id
            WHERE u.id = %s AND LOWER(u.role) = 'student'
            LIMIT 1
            """,
            (user_id,),
        )
        profile = cursor.fetchone()
        if not profile:
            return jsonify({"status": "error", "message": "Student profile not found."}), 404

        return jsonify({"status": "success", "user": profile}), 200

    except mysql.connector.Error:
        logger.exception("Database error while retrieving student profile")
        return jsonify({"status": "error", "message": "Unable to retrieve student profile right now."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================================================
# UPDATE STUDENT PROFILE
# =========================================================
@student_bp.route(
    "/api/student/profile/<int:user_id>",
    methods=["PUT"],
)
@require_role("student")
def update_student_profile(user_id):
    ownership_error = _verify_student_owns_path(user_id)

    if ownership_error:
        return ownership_error

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Invalid request body.",
        }), 400

    name = str(data.get("name", "")).strip()
    student_number = str(
        data.get("student_number", "")
    ).strip()
    program = str(data.get("program", "")).strip()
    college = str(data.get("college", "")).strip()
    gender = str(data.get("gender", "")).strip()

    year_level_raw = data.get("year_level")

    if not name:
        return jsonify({
            "status": "error",
            "message": "Name is required.",
        }), 400

    for field_name, value, maximum in (
        ("School ID", student_number, 50),
        ("Program", program, 100),
        ("College", college, 150),
        ("Gender", gender, 50),
    ):
        if len(value) > maximum:
            return jsonify({
                "status": "error",
                "message": f"{field_name} must not exceed {maximum} characters.",
            }), 400

    year_level = None

    if year_level_raw not in (None, ""):
        try:
            year_level = int(year_level_raw)
        except (TypeError, ValueError):
            return jsonify({
                "status": "error",
                "message": "Year level must be a number.",
            }), 400

        if year_level < 1 or year_level > 6:
            return jsonify({
                "status": "error",
                "message": "Year level must be between 1 and 6.",
            }), 400

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
            UPDATE users
            SET name = %s
            WHERE id = %s
              AND role = 'student'
            """,
            (name, user_id),
        )

        cursor.execute(
            """
            INSERT INTO students (
                user_id,
                student_number,
                program,
                college,
                year_level,
                gender
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                student_number = VALUES(student_number),
                program = VALUES(program),
                college = VALUES(college),
                year_level = VALUES(year_level),
                gender = VALUES(gender)
            """,
            (
                user_id,
                student_number or None,
                program or None,
                college or None,
                year_level,
                gender or None,
            ),
        )

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Profile updated successfully.",
        }), 200

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()
        if getattr(error, "errno", None) == 1062:
            return jsonify({
                "status": "error",
                "message": "This School ID is already registered to another student.",
            }), 409
        logger.exception("Integrity error while updating student profile")
        return jsonify({
            "status": "error",
            "message": "Unable to update student profile because of a database constraint.",
        }), 500

    except mysql.connector.Error:
        if connection:
            connection.rollback()

        logger.exception(
            "Database error while updating student profile"
        )

        return jsonify({
            "status": "error",
            "message": "Unable to update student profile right now.",
        }), 500

    except Exception:
        if connection:
            connection.rollback()

        logger.exception(
            "Unexpected error while updating student profile"
        )

        return jsonify({
            "status": "error",
            "message": "Unable to update student profile right now.",
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


# =========================================================
# LEGACY COMPATIBILITY ROUTE - NOW READ-ONLY
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


# =========================================================
# GET THE AUTHENTICATED STUDENT'S BORROWING RISK SCORE
# =========================================================
@student_bp.route(
    "/api/student/borrowing-risk",
    methods=["GET"],
)
@require_role("student")
def get_student_borrowing_risk():
    """Return the same rule-based risk score used by the Admin dashboard."""
    user_id = request.authenticated_user_id
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
                risk_data.*,
                CASE
                    WHEN risk_score >= 60 THEN 'High'
                    WHEN risk_score >= 25 THEN 'Medium'
                    ELSE 'Low'
                END AS risk_level,
                UTC_TIMESTAMP() AS calculated_at
            FROM (
                SELECT
                    u.id AS user_id,

                    COUNT(DISTINCT CASE
                        WHEN bb.status IN ('approved', 'partially_returned')
                        THEN bb.id
                    END) AS active_loans,

                    COUNT(DISTINCT CASE
                        WHEN bb.due_date < UTC_TIMESTAMP()
                         AND bb.status IN ('approved', 'partially_returned')
                        THEN bb.id
                    END) AS current_overdue_loans,

                    COUNT(DISTINCT CASE
                        WHEN bb.due_date < UTC_TIMESTAMP()
                         AND bb.status IN ('approved', 'partially_returned')
                         AND br.status = 'approved'
                         AND br.returned_at IS NULL
                        THEN br.id
                    END) AS current_overdue_books,

                    COALESCE(
                        MAX(
                            CASE
                                WHEN bb.due_date < UTC_TIMESTAMP()
                                 AND bb.status IN ('approved', 'partially_returned')
                                THEN TIMESTAMPDIFF(DAY, bb.due_date, UTC_TIMESTAMP())
                                ELSE 0
                            END
                        ),
                        0
                    ) AS max_days_overdue,

                    COUNT(DISTINCT CASE
                        WHEN br.returned_at IS NOT NULL
                         AND bb.due_date IS NOT NULL
                         AND br.returned_at > bb.due_date
                        THEN br.id
                    END) AS past_late_returns,

                    LEAST(
                        100,
                        COUNT(DISTINCT CASE
                            WHEN bb.due_date < UTC_TIMESTAMP()
                             AND bb.status IN ('approved', 'partially_returned')
                            THEN bb.id
                        END) * 50
                        +
                        LEAST(
                            COALESCE(
                                MAX(
                                    CASE
                                        WHEN bb.due_date < UTC_TIMESTAMP()
                                         AND bb.status IN ('approved', 'partially_returned')
                                        THEN TIMESTAMPDIFF(DAY, bb.due_date, UTC_TIMESTAMP())
                                        ELSE 0
                                    END
                                ),
                                0
                            ) * 2,
                            40
                        )
                        +
                        LEAST(
                            COUNT(DISTINCT CASE
                                WHEN br.returned_at IS NOT NULL
                                 AND bb.due_date IS NOT NULL
                                 AND br.returned_at > bb.due_date
                                THEN br.id
                            END) * 15,
                            30
                        )
                        +
                        GREATEST(
                            COUNT(DISTINCT CASE
                                WHEN bb.status IN ('approved', 'partially_returned')
                                THEN bb.id
                            END) - 1,
                            0
                        ) * 5
                    ) AS risk_score

                FROM users u
                LEFT JOIN borrow_batches bb ON bb.user_id = u.id
                LEFT JOIN borrow_requests br ON br.batch_id = bb.id
                WHERE u.id = %s
                  AND LOWER(u.role) = 'student'
                GROUP BY u.id
            ) AS risk_data
            """,
            (user_id,),
        )
        risk = cursor.fetchone()

        if not risk:
            return jsonify({
                "status": "error",
                "message": "Student risk information was not found.",
            }), 404

        return jsonify({
            "status": "success",
            "model": {
                "type": "rule_based_overdue_risk_scoring",
                "version": "1.0",
                "score_range": {"minimum": 0, "maximum": 100},
                "levels": {
                    "low": "0-24",
                    "medium": "25-59",
                    "high": "60-100",
                },
            },
            "risk": risk,
        }), 200

    except mysql.connector.Error:
        logger.exception("Database error while calculating student borrowing risk.")
        return jsonify({
            "status": "error",
            "message": "Unable to calculate your borrowing risk score right now.",
        }), 500
    except Exception:
        logger.exception("Unexpected error while calculating student borrowing risk.")
        return jsonify({
            "status": "error",
            "message": "Unable to calculate your borrowing risk score right now.",
        }), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
