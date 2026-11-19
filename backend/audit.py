"""Best-effort audit logging for successful LibSync API actions.

Audit events deliberately omit request bodies, passwords, tokens, and other
credentials. The audit_logs table is created by the SQL migration shipped with
this update.
"""

import logging
import re

from flask import request
import mysql.connector

from database import get_db_connection

logger = logging.getLogger(__name__)

_ID_PATTERN = re.compile(r"/([0-9]+)(?:/|$)")


def _safe_role(value):
    role = str(value or "").strip().lower()
    return role if role in {"admin", "librarian", "student"} else None


def _actor_from_request():
    actor = getattr(request, "audit_actor", None) or getattr(
        request, "authenticated_user", None
    )
    if not isinstance(actor, dict):
        return None
    try:
        user_id = int(actor.get("id") or actor.get("user_id"))
    except (TypeError, ValueError):
        user_id = None
    return {
        "user_id": user_id,
        "user_name": str(actor.get("name") or "")[:120] or None,
        "user_role": _safe_role(actor.get("role")),
    }


def _json_response(response):
    try:
        if response.is_json:
            data = response.get_json(silent=True)
            return data if isinstance(data, dict) else {}
    except Exception:
        pass
    return {}


def _target_id(path, response_data):
    # Prefer an ID in the resource URL. For create operations, use a returned
    # entity ID where the API provides one.
    matches = _ID_PATTERN.findall(path)
    if matches:
        return matches[0][:64]

    for key in ("user", "book", "request", "batch"):
        value = response_data.get(key)
        if isinstance(value, dict) and value.get("id") is not None:
            return str(value["id"])[:64]
    for key in ("user_id", "book_id", "request_id", "batch_id"):
        if response_data.get(key) is not None:
            return str(response_data[key])[:64]
    return None


def _describe_event(method, path, response_data):
    normalized = path.rstrip("/") or "/"
    method = method.upper()

    if normalized == "/api/logout":
        return "LOGOUT", "Authentication", "User signed out of LibSync."

    if normalized == "/api/users" and method == "POST":
        return "CREATE", "Users", "Registered a student account."
    if normalized == "/api/admin/librarians" and method == "POST":
        return "CREATE", "Librarians", "Created a librarian account."
    if normalized.endswith("/assign-librarian") and method == "PUT":
        return "ASSIGN_ROLE", "Librarians", "Assigned a student account as a librarian."
    if normalized.endswith("/remove-librarian") and method == "PUT":
        return "REMOVE_ROLE", "Librarians", "Changed a librarian account back to student."
    if normalized.endswith("/librarian") and method == "PUT":
        return "UPDATE", "Librarians", "Updated a librarian account."
    if normalized.endswith("/librarian") and method == "DELETE":
        return "DELETE", "Librarians", "Deleted a librarian account."
    if normalized.startswith("/api/users/") and method == "PUT":
        return "UPDATE", "Users", "Updated a student account."
    if normalized.startswith("/api/users/") and method == "DELETE":
        return "DELETE", "Users", "Deleted a student account."

    if normalized == "/api/books/fetch-missing-descriptions" and method == "POST":
        return "UPDATE", "Books", "Fetched missing book descriptions."
    if normalized == "/api/books" and method == "POST":
        return "CREATE", "Books", "Added a book to the library catalogue."
    if normalized.startswith("/api/books/") and method == "PUT":
        return "UPDATE", "Books", "Updated a book record."
    if normalized.startswith("/api/books/") and method == "DELETE":
        return "DELETE", "Books", "Deleted a book record."

    if normalized == "/api/borrow-requests" and method == "POST":
        return "REQUEST_BORROW", "Borrowing", "Submitted a borrowing request."
    if normalized.startswith("/api/borrow-requests/") and normalized.endswith("/decision") and method == "PUT":
        decision_data = request.get_json(silent=True)
        decision = str((decision_data or {}).get("decision", "")).lower() if isinstance(decision_data, dict) else ""
        if decision == "approved":
            return "APPROVE", "Borrowing", "Approved a borrowing request."
        if decision == "declined":
            return "DECLINE", "Borrowing", "Declined a borrowing request."
        return "UPDATE", "Borrowing", "Updated a borrowing request decision."
    if normalized == "/api/borrow-batches/lookup" and method == "POST":
        return "QR_LOOKUP", "QR Workflow", "Looked up a borrowing batch using a QR code."
    if normalized.startswith("/api/borrow-batches/") and normalized.endswith("/release") and method == "PUT":
        return "RELEASE", "Borrowing", "Released approved books after QR verification."
    if normalized.startswith("/api/borrow-batches/") and normalized.endswith("/request-return") and method == "POST":
        return "REQUEST_RETURN", "Returns", "Requested a return QR code."
    if normalized.startswith("/api/borrow-batches/") and normalized.endswith("/return") and method == "PUT":
        return "RETURN", "Returns", "Confirmed returned books after QR verification."
    if normalized.startswith("/api/librarian/pending-returns/") and normalized.endswith("/resolve") and method == "POST":
        return "RETURN_RECOVERY", "Returns", "Confirmed returned books from QR Scan History after the original Return QR scan."

    # Capture future write endpoints too, while giving them a neutral label.
    module = "System"
    if "/borrow" in normalized:
        module = "Borrowing"
    elif "/book" in normalized:
        module = "Books"
    elif "/user" in normalized or "/librarian" in normalized:
        module = "Users"
    action = {"POST": "CREATE", "PUT": "UPDATE", "PATCH": "UPDATE", "DELETE": "DELETE"}.get(method, "UPDATE")
    return action, module, f"Performed a {action.lower()} action in {module.lower()}."


def log_api_activity(response):
    """Persist one event after a response, without changing the API response."""
    path = request.path.rstrip("/") or "/"
    method = request.method.upper()

    if not path.startswith("/api/"):
        return response

    # Login is the only unauthenticated route recorded here. Failed attempts
    # are recorded without saving the submitted email or password.
    if path == "/api/login" and method == "POST":
        if response.status_code < 400:
            actor = _actor_from_request()
            if not actor:
                return response
            action = "LOGIN"
            module = "Authentication"
            description = "User signed in successfully."
            outcome = "SUCCESS"
        elif response.status_code in (401, 403):
            payload = request.get_json(silent=True) or {}
            actor = {
                "user_id": None,
                "user_name": None,
                "user_role": _safe_role(payload.get("role")),
            }
            action = "LOGIN_FAILED"
            module = "Authentication"
            description = "A sign-in attempt failed."
            outcome = "FAILED"
        else:
            return response
        target_id = None
    elif method in {"POST", "PUT", "PATCH", "DELETE"} and response.status_code < 400:
        # Do not interpret the QR lookup POST as a data mutation; it still
        # records a meaningful security/workflow event.
        actor = _actor_from_request()
        if not actor:
            return response
        payload = _json_response(response)
        action, module, description = _describe_event(method, path, payload)
        outcome = "SUCCESS"
        target_id = _target_id(path, payload)
    else:
        return response

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        if connection is None:
            logger.warning("Audit event was not saved: database connection unavailable")
            return response

        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO audit_logs (
                user_id, user_name, user_role, action, module,
                description, target_id, outcome, ip_address, user_agent
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                actor.get("user_id"),
                actor.get("user_name"),
                actor.get("user_role"),
                action,
                module,
                description,
                target_id,
                outcome,
                (request.remote_addr or "")[:45] or None,
                (request.headers.get("User-Agent") or "")[:255] or None,
            ),
        )
        connection.commit()
    except mysql.connector.Error:
        logger.exception("Unable to save LibSync audit event")
        if connection:
            try:
                connection.rollback()
            except mysql.connector.Error:
                logger.exception("Unable to roll back audit log insert")
    except Exception:
        logger.exception("Unexpected error while saving LibSync audit event")
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

    return response
