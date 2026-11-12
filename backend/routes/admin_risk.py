import logging
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from database import get_db_connection
from .auth import require_role

admin_risk_bp = Blueprint("admin_risk", __name__)
logger = logging.getLogger(__name__)


def _utc_datetime(value):
    """Normalize MySQL DATETIME or ISO timestamps for consistent UTC comparison."""
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _calculate_performance(returns):
    """Apply book-level penalties/recovery in chronological return order."""
    score = 100
    on_time_returns = 0
    late_returns = 0

    for record in returns:
        returned_at = _utc_datetime(record["returned_at"])
        due_date = _utc_datetime(record["due_date"])
        if returned_at is None or due_date is None:
            continue

        if returned_at <= due_date:
            on_time_returns += 1
            score = min(100, score + 5)
        else:
            late_returns += 1
            seconds_late = (returned_at - due_date).total_seconds()
            days_late = max(1, int((seconds_late + 86400 - 1) // 86400))
            score = max(0, score - min(days_late * 10, 50))

    level = "High" if score >= 80 else "Medium" if score >= 50 else "Low"
    return {
        "performance_score": score,
        "performance_level": level,
        "completed_returns": on_time_returns + late_returns,
        "on_time_returns": on_time_returns,
        "late_returns": late_returns,
    }


@admin_risk_bp.route("/api/admin/return-performance", methods=["GET"])
@require_role("admin")
def get_return_performance():
    """Return rule-based book-return performance scores for students."""
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT
                u.id AS user_id,
                u.name,
                u.email,
                s.student_number,
                s.program,
                s.college,
                s.year_level,
                s.gender
            FROM users u
            LEFT JOIN students s ON s.user_id = u.id
            WHERE u.role = 'student'
            ORDER BY u.name ASC
        """)
        students = cursor.fetchall()

        cursor.execute("""
            SELECT
                bb.user_id,
                br.id AS return_id,
                br.returned_at,
                bb.due_date
            FROM borrow_requests br
            INNER JOIN borrow_batches bb ON bb.id = br.batch_id
            INNER JOIN users u ON u.id = bb.user_id
            WHERE u.role = 'student'
              AND br.returned_at IS NOT NULL
              AND bb.due_date IS NOT NULL
            ORDER BY br.returned_at ASC, br.id ASC
        """)
        return_rows = cursor.fetchall()
        returns_by_student = {}
        for row in return_rows:
            returns_by_student.setdefault(row["user_id"], []).append(row)

        for student in students:
            student.update(_calculate_performance(returns_by_student.get(student["user_id"], [])))

        students.sort(key=lambda row: (row["performance_score"], row["name"] or ""))

        summary = {
            "total_students": len(students),
            "high_performance": sum(s["performance_level"] == "High" for s in students),
            "medium_performance": sum(s["performance_level"] == "Medium" for s in students),
            "low_performance": sum(s["performance_level"] == "Low" for s in students),
        }

        return jsonify({
            "status": "success",
            "model": {
                "type": "rule_based_return_performance_scoring",
                "version": "1.0",
                "score_range": {"minimum": 0, "maximum": 100},
                "levels": {"low": "0-49", "medium": "50-79", "high": "80-100"},
                "rules": {
                    "initial_score": 100,
                    "on_time_recovery": 5,
                    "late_penalty_per_day": 10,
                    "maximum_late_penalty_per_book": 50,
                    "partial_day_counts_as_full_day": True,
                },
            },
            "summary": summary,
            "students": students,
        }), 200

    except Exception:
        logger.exception("Failed to calculate student return performance scores.")
        return jsonify({"status": "error", "message": "Unable to calculate return performance scores."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


@admin_risk_bp.route("/api/student/return-performance", methods=["GET"])
@require_role("student")
def get_my_return_performance():
    """Return only the authenticated student's book-return performance."""
    connection = None
    cursor = None
    try:
        user_id = request.authenticated_user_id
        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT br.returned_at, bb.due_date
            FROM borrow_requests br
            INNER JOIN borrow_batches bb ON bb.id = br.batch_id
            WHERE bb.user_id = %s
              AND br.returned_at IS NOT NULL
              AND bb.due_date IS NOT NULL
            ORDER BY br.returned_at ASC, br.id ASC
        """, (user_id,))
        performance = _calculate_performance(cursor.fetchall())
        return jsonify({"status": "success", "performance": performance}), 200
    except Exception:
        logger.exception("Failed to calculate student return performance.")
        return jsonify({"status": "error", "message": "Unable to calculate return performance."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


@admin_risk_bp.route("/api/librarian/students/<int:student_id>/return-performance", methods=["GET"])
@require_role("librarian")
def get_student_return_performance_for_librarian(student_id):
    """Provide existing rule-based performance to librarians for request review."""
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE id = %s AND role = 'student'", (student_id,))
        if cursor.fetchone() is None:
            return jsonify({"status": "error", "message": "Student not found."}), 404
        cursor.execute("""
            SELECT br.returned_at, bb.due_date
            FROM borrow_requests br
            INNER JOIN borrow_batches bb ON bb.id = br.batch_id
            WHERE bb.user_id = %s
              AND br.returned_at IS NOT NULL
              AND bb.due_date IS NOT NULL
            ORDER BY br.returned_at ASC, br.id ASC
        """, (student_id,))
        return jsonify({
            "status": "success",
            "student_id": student_id,
            "performance": _calculate_performance(cursor.fetchall()),
        }), 200
    except Exception:
        logger.exception("Failed to calculate librarian-visible return performance.")
        return jsonify({"status": "error", "message": "Unable to load student performance."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()
