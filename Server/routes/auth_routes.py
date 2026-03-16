from flask import Blueprint, jsonify, make_response, request
import bcrypt

from db import connect_db
from queries.user_queries import get_me, get_user_by_email
from auth import create_token, verify_token
from utils import success_response, APIError

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    conn = connect_db()
    cur = conn.cursor()

    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        user = get_user_by_email(cur, email)

        if not user:
            raise APIError("INVALID_CREDENTIALS", "Invalid user or password", 401)

        if not bcrypt.checkpw(password.encode(), user.password.encode()):
            raise APIError("INVALID_CREDENTIALS", "Invalid user or password", 401)

        token = create_token(user.id)

        response = make_response(
            jsonify({
                "success": True,
                "data": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.first_name,
                    "admin": user.admin
                },
                "error": None,
            })
        )

        response.set_cookie(
            "token",
            token,
            httponly=True,
            samesite="Lax",
            secure=False,  # set to True in production with HTTPS
            path="/",
            max_age=60 * 60 * 24 * 7,
        )
        return response

    finally:
        conn.close()


@auth_bp.route("/auth/me", methods=["GET"])
def get_current_user():
    token = request.cookies.get("token")

    if not token:
        raise APIError("UNAUTHORIZED", "Not logged in", 401)

    user_id = verify_token(token)

    if not user_id:
        raise APIError("UNAUTHORIZED", "Invalid token", 401)

    conn = connect_db()
    cur = conn.cursor()

    try:
        user = get_me(cur, user_id)

        user_dict = user.model_dump()

        return success_response(user_dict)
    finally:
        conn.close()


@auth_bp.route("/auth/logout", methods=["POST"])
def logout():
    response = make_response({"message": "Logged out successfully"})
    response.delete_cookie("token", path="/", samesite="Lax")
    return response
