from flask import Flask
from flask_cors import CORS
from routes.student import student_bp
from routes import (
    auth_bp,
    users_bp,
    books_bp,
    borrowings_bp,
    borrow_requests_bp,
)

app = Flask(__name__)


CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
            ]
        }
    },
    methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Content-Type",
        "X-User-ID",
        "Authorization",
        "ngrok-skip-browser-warning",
    ],
    supports_credentials=False,
    max_age=600,
)


app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(books_bp)
app.register_blueprint(borrowings_bp)
app.register_blueprint(borrow_requests_bp)
app.register_blueprint(student_bp)


@app.route("/")
def home():
    return {
        "status": "success",
        "message": "LibSync API is running!",
    }


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
    )