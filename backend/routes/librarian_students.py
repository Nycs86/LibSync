"""Read-only student directory for authenticated LibSync librarians."""
import logging

import mysql.connector
from flask import Blueprint, jsonify

from database import get_db_connection
from .auth import require_role

librarian_students_bp = Blueprint('librarian_students', __name__)
logger = logging.getLogger(__name__)


@librarian_students_bp.route('/api/librarian/students', methods=['GET'])
@require_role('librarian')
def get_librarian_students():
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        if connection is None:
            return jsonify({'status': 'error', 'message': 'Database connection failed.'}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute('''
            SELECT id, name, email
            FROM users
            WHERE role = %s
            ORDER BY name ASC, id ASC
        ''', ('student',))
        return jsonify({'status': 'success', 'students': cursor.fetchall()}), 200
    except mysql.connector.Error:
        logger.exception('Failed to load librarian student directory')
        return jsonify({'status': 'error', 'message': 'Unable to load students.'}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()
