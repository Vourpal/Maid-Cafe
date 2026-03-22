from flask import Blueprint, jsonify, make_response, request
import bcrypt

from queries.user_queries import get_me, get_user_by_email
from auth import create_token
from middleware import require_auth
from utils import success_response, APIError, get_db

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    with get_db() as (conn, cur):
        data = request.get_json()
        remember_me = data.get("remember_me")
        email = data.get("email")
        password = data.get("password")

        user = get_user_by_email(cur, email)

        if not user:
            raise APIError("INVALID_CREDENTIALS", "Invalid user or password", 401)

        if not bcrypt.checkpw(password.encode(), user.password.encode()):
            raise APIError("INVALID_CREDENTIALS", "Invalid user or password", 401)

        token = create_token(user.id, remember_me)

        # This is for localstorage
        return jsonify({
            "success": True,
            "data": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "username": user.username,
                "admin": user.admin,
                "token": token  # ← return token in body
            },
            "error": None,
        })

        # This is for cookies

        # response = make_response(
        #         jsonify({
        #             "success": True,
        #             "data": {
        #                 "id": user.id,
        #                 "email": user.email,
        #                 "first_name": user.first_name,
        #                 "last_name": user.last_name,
        #                 "username": user.username,
        #                 "admin": user.admin
        #             },
        #             "error": None,
        #         })
        #     )

        # response.set_cookie(
        #     "token",
        #     token,
        #     httponly=True,
        #     samesite="None",  # changed from "Lax"
        #     secure=True,      # changed from False — required when samesite="None"
        #     path="/",
        #     max_age=60 * 60 * 24 * 30 if remember_me else 60 * 60 * 24,
        # )
        # return response


@auth_bp.route("/auth/me", methods=["GET"])
@require_auth
def get_current_user(user_id):
    with get_db() as (conn, cur):
        user = get_me(cur, user_id)
        return success_response(user.model_dump())


@auth_bp.route("/auth/logout", methods=["POST"])
def logout():
    # for cookies, make sure to change samesite to None when deploying...
    # response = make_response({"message": "Logged out successfully"})
    # response.delete_cookie("token", path="/", samesite="Lax")
    # return response
    return jsonify({"success": True, "message": "Logged out"})