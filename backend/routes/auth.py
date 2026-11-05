import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
import mysql.connector
from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from database import get_db_connection


auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

_VALID_ROLES = {"student", "librarian", "admin"}
_HASH_PREFIXES = ("scrypt:", "pbkdf2:")
_JWT_ISSUER = "libsync-api"
_JWT_ALGORITHM = "HS256"


def _jwt_secret():
    """Load the persistent JWT signing key from the environment."""
    secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if len(secret) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY is missing or too short. Configure a random key "
            "of at least 32 characters in the backend environment."
        )
    return secret


def _jwt_access_minutes():
    raw_value = os.getenv("JWT_ACCESS_TOKEN_MINUTES", "30")
    try:
        minutes = int(raw_value)
    except (TypeError, ValueError) as error:
        raise RuntimeError("JWT_ACCESS_TOKEN_MINUTES must be an integer.") from error

    if minutes < 1 or minutes > 1440:
        raise RuntimeError("JWT_ACCESS_TOKEN_MINUTES must be between 1 and 1440.")
    return minutes


def _create_access_token(user):
    """Create a signed, short-lived JWT for the authenticated account."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=_jwt_access_minutes())
    user_id = int(user["id"])

    payload = {
        "iss": _JWT_ISSUER,
        "sub": str(user_id),
        "uid": user_id,
        "role": user["role"],
        "token_type": "access",
        "iat": now,
        "exp": expires_at,
        "jti": secrets.token_urlsafe(18),
    }
    token = jwt.encode(payload, _jwt_secret(), algorithm=_JWT_ALGORITHM)
    return token, int((expires_at - now).total_seconds())


def _verify_stored_password(stored_password, submitted_password):
    """Return (is_valid, needs_upgrade) for hashed and legacy plaintext values."""
    if not isinstance(stored_password, str) or not isinstance(submitted_password, str):
        return False, False

    if stored_password.startswith(_HASH_PREFIXES):
        try:
            return check_password_hash(stored_password, submitted_password), False
        except (ValueError, TypeError):
            logger.warning("A stored password hash could not be verified")
            return False, False

    # Migrate legacy plaintext credentials after successful password and role checks.
    return hmac.compare_digest(stored_password, submitted_password), True


@auth_bp.route("/api/login", methods=["POST"])
def login():
    connection = None
    cursor = None

    try: 
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "status": "error",
                "message": "Request body must be a valid JSON object.",
            }), 400

        email = data.get("email")
        password = data.get("password")
        requested_role = data.get("role")

        if isinstance(email, str):
            email = email.strip()

        if isinstance(requested_role, str):
            requested_role = requested_role.strip().lower()


        if (
            not isinstance(email, str)
            or not email.strip()
            or not isinstance(password, str)
            or not password
        ):
            return jsonify({
                "status": "error",
                "message": "Email and password are required.",
            }), 400

        if requested_role not in _VALID_ROLES:
            return jsonify({
                "status": "error",
                "message": "A valid login role is required.",
            }), 400

        # Validate signing configuration before completing login. The app must
        # never report a successful login without issuing the required token.
        secret = _jwt_secret()
        access_minutes = _jwt_access_minutes()
        if not secret or not access_minutes:  # pragma: no cover - defensive
            raise RuntimeError("JWT configuration is invalid.")

        connection = get_db_connection()
        if connection is None:
            return jsonify({
                "status": "error",
                "message": "Database connection failed.",
            }), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, name, email, password, role, created_at
            FROM users
            WHERE email = %s
            LIMIT 1
            """,
            (email,),
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({
                "status": "error",
                "message": "Invalid email or password.",
            }), 401

        password_is_valid, needs_upgrade = _verify_stored_password(
            user.get("password"), password
        )
        if not password_is_valid:
            return jsonify({
                "status": "error",
                "message": "Invalid email or password.",
            }), 401

        if user.get("role") != requested_role:
            return jsonify({
                "status": "error",
                "message": f"This account is not registered as a {requested_role}.",
            }), 403

        if needs_upgrade:
            cursor.execute(
                "UPDATE users SET password = %s WHERE id = %s",
                (generate_password_hash(password), user["id"]),
            )
            connection.commit()

        access_token, expires_in = _create_access_token(user)

        return jsonify({
            "status": "success",
            "message": "Login successful!",
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": expires_in,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
            },
        }), 200

    except RuntimeError as error:
        logger.error("JWT configuration error during login: %s", error)
        return jsonify({
            "status": "error",
            "message": "Authentication service is not configured correctly.",
        }), 500

    except mysql.connector.Error:
        logger.exception("Database error during login")
        if connection:
            try:
                connection.rollback()
            except mysql.connector.Error:
                logger.exception("Rollback failed after login database error")
        return jsonify({
            "status": "error",
            "message": "Unable to process login right now. Please try again.",
        }), 500

    except Exception:
        logger.exception("Unexpected error during login")
        return jsonify({
            "status": "error",
            "message": "Unable to process login right now. Please try again.",
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


def _decode_bearer_token(authorization_header):
    """Validate an access token and return its claims."""
    if not authorization_header:
        return None, "missing"

    parts = authorization_header.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None, "malformed"

    try:
        claims = jwt.decode(
            parts[1],
            _jwt_secret(),
            algorithms=[_JWT_ALGORITHM],
            issuer=_JWT_ISSUER,
            options={
                "require": ["exp", "iat", "sub", "jti", "token_type", "role"],
            },
        )
        if claims.get("token_type") != "access":
            return None, "invalid"
        if claims.get("role") not in _VALID_ROLES:
            return None, "invalid"
        user_id_value = claims.get("sub")
        if not isinstance(user_id_value, str) or not user_id_value.isdigit():
            return None, "invalid"
        user_id = int(user_id_value)
        if user_id <= 0:
            return None, "invalid"
        return {**claims, "uid": user_id}, None
    except jwt.ExpiredSignatureError:
        return None, "expired"
    except jwt.InvalidTokenError:
        return None, "invalid"
    except RuntimeError:
        raise


def _legacy_auth_is_enabled():
    """Temporary compatibility switch for clients not yet migrated to JWT."""
    return os.getenv("ALLOW_LEGACY_X_USER_ID", "false").strip().lower() in {
        "1", "true", "yes", "on"
    }


def require_role(*required_roles):
    """Authorize requests using JWT Bearer tokens.

    During a controlled migration only, ALLOW_LEGACY_X_USER_ID=true permits
    old clients to continue sending X-User-ID when no Authorization header is
    supplied. A malformed/invalid Bearer token never falls back to that header.
    Disable the legacy switch after React and Flutter use Bearer tokens.

    Usage: @require_role("student") or @require_role("admin", "librarian").
    """
    allowed_roles = set()
    for role_group in required_roles:
        if isinstance(role_group, (list, tuple, set, frozenset)):
            allowed_roles.update(role_group)
        else:
            allowed_roles.add(role_group)

    if not allowed_roles or not allowed_roles.issubset(_VALID_ROLES):
        raise ValueError("require_role needs one or more valid role names")

    def decorator(function):
        @wraps(function)
        def wrapper(*args, **kwargs):
            authorization_header = request.headers.get("Authorization")
            user_id = None
            token_role = None

            try:
                if authorization_header:
                    claims, token_error = _decode_bearer_token(authorization_header)
                    if token_error:
                        message = (
                            "Access token has expired. Please sign in again."
                            if token_error == "expired"
                            else "A valid Bearer access token is required."
                        )
                        return jsonify({
                            "status": "error",
                            "message": message,
                        }), 401
                    user_id = claims["uid"]
                    token_role = claims["role"]
                elif _legacy_auth_is_enabled():
                    legacy_user_id = request.headers.get("X-User-ID", "").strip()
                    if not legacy_user_id.isdigit() or int(legacy_user_id) <= 0:
                        return jsonify({
                            "status": "error",
                            "message": "Authentication required. Sign in again.",
                        }), 401
                    user_id = int(legacy_user_id)
                else:
                    return jsonify({
                        "status": "error",
                        "message": "Authentication required. Please sign in again.",
                    }), 401

                connection = get_db_connection()
                if connection is None:
                    return jsonify({
                        "status": "error",
                        "message": "Database connection failed.",
                    }), 500

                cursor = connection.cursor(dictionary=True)
                cursor.execute(
                    """
                    SELECT id, name, email, role
                    FROM users
                    WHERE id = %s
                    LIMIT 1
                    """,
                    (user_id,),
                )
                user = cursor.fetchone()

                if not user:
                    return jsonify({
                        "status": "error",
                        "message": "User account was not found. Please sign in again.",
                    }), 401

                # Check the live DB role on every request. This makes a role
                # removal/reassignment take effect immediately, even if a JWT
                # containing the previous role has not expired yet.
                if token_role is not None and token_role != user.get("role"):
                    return jsonify({
                        "status": "error",
                        "message": "Account permissions changed. Please sign in again.",
                    }), 401

                if user.get("role") not in allowed_roles:
                    return jsonify({
                        "status": "error",
                        "message": "You do not have permission to perform this action.",
                    }), 403

                request.authenticated_user_id = user["id"]
                request.authenticated_user = user
                request.authenticated_via = "jwt" if token_role is not None else "legacy"
                

            except RuntimeError:
                logger.exception("JWT configuration error during request authorization")
                return jsonify({
                    "status": "error",
                    "message": "Authentication service is not configured correctly.",
                }), 500
            except mysql.connector.Error:
                logger.exception("Database error during role authorization")
                return jsonify({
                    "status": "error",
                    "message": "Unable to verify permissions right now.",
                }), 500
            finally:
                if "cursor" in locals() and cursor:
                    cursor.close()
                if "connection" in locals() and connection:
                    connection.close()

            return function(*args, **kwargs)

        return wrapper
    return decorator
