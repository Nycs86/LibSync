import logging
from flask import Blueprint, jsonify
from database import get_db_connection
from .auth import require_role

admin_risk_bp = Blueprint("admin_risk", __name__)
logger = logging.getLogger(__name__)

@admin_risk_bp.route("/api/admin/overdue-risk", methods=["GET"])
@require_role("admin")
def get_overdue_risk():
    """Return rule-based overdue risk scores using real LibSync data only."""
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
        cursor.execute("""
            SELECT
                risk_data.*,
                CASE
                    WHEN risk_score >= 60 THEN 'High'
                    WHEN risk_score >= 25 THEN 'Medium'
                    ELSE 'Low'
                END AS risk_level
            FROM (
                SELECT
                    u.id AS user_id,
                    u.name,
                    u.email,
                    s.student_number,
                    s.program,
                    s.college,
                    s.year_level,
                    s.gender,

                    COUNT(DISTINCT CASE
                        WHEN bb.status IN ('approved', 'partially_returned')
                        THEN bb.id
                    END) AS active_loans,

                    COUNT(DISTINCT CASE
                        WHEN bb.due_date < UTC_TIMESTAMP()
                         AND bb.status IN ('approved', 'partially_returned')
                        THEN bb.id
                    END) AS current_overdue_loans,

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
                LEFT JOIN students s ON s.user_id = u.id
                LEFT JOIN borrow_batches bb ON bb.user_id = u.id
                LEFT JOIN borrow_requests br ON br.batch_id = bb.id
                WHERE u.role = 'student'
                GROUP BY
                    u.id,
                    u.name,
                    u.email,
                    s.student_number,
                    s.program,
                    s.college,
                    s.year_level,
                    s.gender
            ) AS risk_data
            ORDER BY
                risk_score DESC,
                current_overdue_loans DESC,
                max_days_overdue DESC,
                name ASC
        """)

        students = cursor.fetchall()

        summary = {
            "total_students": len(students),
            "high_risk": sum(1 for row in students if row["risk_level"] == "High"),
            "medium_risk": sum(1 for row in students if row["risk_level"] == "Medium"),
            "low_risk": sum(1 for row in students if row["risk_level"] == "Low"),
        }

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
            "summary": summary,
            "students": students,
        }), 200

    except Exception:
        logger.exception("Failed to calculate admin overdue risk scores.")
        return jsonify({
            "status": "error",
            "message": "Unable to calculate overdue risk scores.",
        }), 500

    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()
