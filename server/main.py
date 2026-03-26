from flask import Flask
from flask_cors import CORS
import traceback
import os
from utils import APIError
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.event_routes import event_bp
from routes.attendance_routes import attendance_bp
from routes.practice_routes import practice_bp

print("PORT:", os.getenv("PORT"))

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=[
    "http://localhost:3000",
    "http://192.168.4.103:3000",
    "https://maid-cafe-gxuv.vercel.app"
])

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(event_bp)
app.register_blueprint(attendance_bp)
app.register_blueprint(practice_bp)


# Error handlers
@app.errorhandler(APIError)
def handle_api_error(err):
    return {
        "success": False,
        "data": None,
        "error": {"code": err.code, "message": err.message},
    }, err.status


@app.errorhandler(Exception)
def handle_unexpected_error(err):
    print("UNEXPECTED ERROR:", err)
    traceback.print_exc()
    return {
        "success": False,
        "data": None,
        "error": {"code": "INTERNAL_SERVER_ERROR", "message": "Something went wrong"},
    }, 500


@app.route("/")
def home():
    return {"success": True}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
