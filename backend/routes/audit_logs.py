import logging
from datetime import datetime

import mysql.connector
from flask import Blueprint, jsonify, request

from database import get_db_connection
from .auth import require_role


audit_logs_bp = Blueprint("audit_logs", __name__)
logger = logging.getLogger(__name__)


@audit_logs_bp.route("/api/admin/history-logs", methods=["GET"])
@require_role("admin")
def get_history_logs():
    """Return paginated, filterable audit logs to Admin users only."""
    try:
        page = max(1, int(request.args.get("page", "1")))
        per_page = min(100, max(10, int(request.args.get("per_page", "20"))))
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "Invalid pagination values."}), 400

    search = request.args.get("search", "").strip()[:100]
    action = request.args.get("action", "").strip().upper()[:40]
    role = request.args.get("role", "").strip().lower()[:20]
    date_from = request.args.get("date_from", "").strip()
    date_to = request.args.get("date_to", "").strip()

    valid_actions = {
        "LOGIN", "LOGIN_FAILED", "LOGOUT", "CREATE", "UPDATE", "DELETE",
        "ASSIGN_ROLE", "REMOVE_ROLE", "REQUEST_BORROW", "APPROVE", "DECLINE",
        "QR_LOOKUP", "RELEASE", "REQUEST_RETURN", "RETURN",
    }
    valid_roles = {"admin", "librarian", "student"}
    if action and action not in valid_actions:
        return jsonify({"status": "error", "message": "Invalid action filter."}), 400
    if role and role not in valid_roles:
        return jsonify({"status": "error", "message": "Invalid role filter."}), 400
    try:
        if date_from:
            datetime.strptime(date_from, "%Y-%m-%d")
        if date_to:
            datetime.strptime(date_to, "%Y-%m-%d")
    except ValueError:
        return jsonify({"status": "error", "message": "Dates must use YYYY-MM-DD format."}), 400

    where_parts = []
    params = []
    if search:
        like = f"%{search}%"
        where_parts.append(
            "(user_name LIKE %s OR CAST(user_id AS CHAR) LIKE %s OR "
            "user_role LIKE %s OR action LIKE %s OR module LIKE %s OR description LIKE %s)"
        )
        params.extend([like, like, like, like, like, like])
    if action:
        where_parts.append("action = %s")
        params.append(action)
    if role:
        where_parts.append("user_role = %s")
        params.append(role)
    if date_from:
        where_parts.append("created_at >= %s")
        params.append(f"{date_from} 00:00:00")
    if date_to:
        where_parts.append("created_at < DATE_ADD(%s, INTERVAL 1 DAY)")
        params.append(date_to)

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    offset = (page - 1) * per_page
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({"status": "error", "message": "Database connection failed."}), 500
        cursor = connection.cursor(dictionary=True)

        cursor.execute(f"SELECT COUNT(*) AS total FROM audit_logs {where_sql}", tuple(params))
        total = int((cursor.fetchone() or {}).get("total") or 0)

        cursor.execute(
            f"""
            SELECT id, user_id, user_name, user_role, action, module,
                   description, target_id, outcome, ip_address, user_agent, created_at
            FROM audit_logs
            {where_sql}
            ORDER BY created_at DESC, id DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [per_page, offset]),
        )
        logs = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(DATE(created_at) = CURDATE()), 0) AS today,
                COALESCE(SUM(action IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')), 0) AS authentication,
                COALESCE(SUM(action NOT IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')), 0) AS changes
            FROM audit_logs
            """
        )
        summary = cursor.fetchone() or {}

        return jsonify({
            "status": "success",
            "logs": logs,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
            "summary": {
                "total": int(summary.get("total") or 0),
                "today": int(summary.get("today") or 0),
                "authentication": int(summary.get("authentication") or 0),
                "changes": int(summary.get("changes") or 0),
            },
        }), 200

    except mysql.connector.Error:
        logger.exception("Unable to retrieve audit history")
        return jsonify({
            "status": "error",
            "message": "Unable to retrieve history logs. Make sure the audit_logs SQL migration has been applied.",
        }), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
