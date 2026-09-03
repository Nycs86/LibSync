from flask import Flask
from flask_cors import CORS
from routes.student import student_bp

from routes import auth_bp, users_bp, books_bp, borrowings_bp, borrow_requests_bp

app = Flask(__name__)

CORS(app)


# Register API routes
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
        "message": "LibSync API is running!"
    }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)