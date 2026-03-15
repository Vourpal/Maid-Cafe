from flask import Blueprint, request
import bcrypt

from db import connect_db
from models import UserRegister, UserAuthorization, UserUpdate
from queries.user_queries import get_user_by_id, create_user, update_user, delete_user
from utils import success_response, APIError

user_bp = Blueprint("users", __name__)


@user_bp.route("/users", methods=["POST"])
def create_new_user():
    conn = connect_db()
    cur = conn.cursor()
    try:
        data = request.get_json()
        reg_data = UserRegister(**data)

        new_user_data = UserAuthorization(
            first_name=reg_data.first_name,
            last_name=reg_data.last_name,
            email=reg_data.email,
            username=reg_data.username,
            password=reg_data.password,
            admin=False,
            active=True,
        )

        hashed_pw = bcrypt.hashpw(new_user_data.password.encode("utf-8"), bcrypt.gensalt())
        new_user_data.password = hashed_pw.decode("utf-8")

        new_user_id = create_user(cur, new_user_data)
        conn.commit()

        return success_response({"id": new_user_id}, 201)

    finally:
        conn.close()


@user_bp.route("/users/<int:user_id>", methods=["GET", "PATCH", "DELETE"])
def user_detail(user_id):
    conn = connect_db()
    cur = conn.cursor()
    try:
        if request.method == "GET":
            user = get_user_by_id(cur, user_id)
            if user is None:
                raise APIError("USER_NOT_FOUND", f"User {user_id} does not exist", 404)
            return success_response(user.model_dump(), 200)

        elif request.method == "PATCH":
            data = request.get_json()
            user_data = UserUpdate(**data)
            if user_data.password is not None:
                hashed_pw = bcrypt.hashpw(user_data.password.encode("utf-8"), bcrypt.gensalt())
                user_data.password = hashed_pw.decode("utf-8")
            updated_user = update_user(cur, user_id, user_data)
            conn.commit()
            return success_response({"updated": updated_user}, 200)

        elif request.method == "DELETE":
            deleted_user = delete_user(cur, user_id)
            if deleted_user is None:
                raise APIError("USER_NOT_FOUND", f"User {user_id} does not exist", 404)
            conn.commit()
            return success_response({"deleted": deleted_user}, 200)

    finally:
        conn.close()
