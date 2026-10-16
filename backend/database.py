import os
import mysql.connector
from mysql.connector import Error

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def get_db_connection():
    """
    Create a MySQL connection using environment variables.

    Required environment variables:
      DB_HOST
      DB_PORT
      DB_USER
      DB_PASSWORD
      DB_NAME
    """

    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME", "libsync_db"),
            ssl_disabled=False,
            connection_timeout=10,
        )

        if connection.is_connected():
            return connection

    except Error as error:
        print("Database connection error:", error)

    return None
