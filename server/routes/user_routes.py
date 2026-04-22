import os
import resend
from flask import Blueprint, request
import bcrypt
from psycopg2 import errors as pg_errors
from pydantic import ValidationError
from models import UserRegister, UserAuthorization, UserUpdate
from queries.invite_queries import validate_invite, use_invite
from datetime import datetime
from queries.user_queries import (
    get_admins,
    get_me,
    get_user_by_email,
    get_user_by_id,
    create_user,
    get_users,
    update_user,
    delete_user,
)
from middleware import require_admin, require_auth
from utils import success_response, APIError, get_db

from dotenv import load_dotenv  # type: ignore


user_bp = Blueprint("users", __name__)

load_dotenv()

resend.api_key = os.getenv("RESEND_KEY")


# TODO: add validation errors
@user_bp.route("/users", methods=["GET"])
@require_admin
def get_all_users(user_id):
    with get_db() as (conn, cur):
        data = get_users(cur)
        return success_response([u.model_dump() for u in data], 200)


@user_bp.route("/users/admin", methods=["GET"])
@require_auth
def get_all_admins(user_id):
    with get_db() as (conn, cur):
        data = get_admins(cur)
        return success_response([u.model_dump() for u in data], 200)


@user_bp.route("/users/admin/email", methods=["POST"])
@require_auth
def email_admins(user_id):
    with get_db() as (conn, cur):
        data = get_admins(cur)

    results = []

    for d in data:
        result = resend.Emails.send({
            "from": "Acme <onboarding@resend.dev>",
            "to": [d.email],
            "subject": "hello world",
            "html": "<p>it works!</p>",
        })

        results.append(result)

    return success_response(results, 200)


@user_bp.route("/users", methods=["POST"])
def create_new_user():
    try:
        with get_db() as (conn, cur):
            data = request.get_json()

            invite_code = data.get("invite_code")
            if not invite_code:
                raise APIError("INVITE_REQUIRED", "Invite code is required", 400)

            invite = validate_invite(cur, invite_code)
            if not invite:
                raise APIError("INVALID_INVITE", "Invalid or expired invite code", 400)

            try:  # ← wrap just the validation
                reg_data = UserRegister(**data)
            except ValidationError as e:
                raise APIError("VALIDATION_ERROR", str(e), 422)

            new_user_data = UserAuthorization(
                first_name=reg_data.first_name,
                last_name=reg_data.last_name,
                email=reg_data.email,
                username=reg_data.username,
                password=reg_data.password,
                admin=False,
                active=True,
            )
            hashed_pw = bcrypt.hashpw(
                new_user_data.password.encode("utf-8"), bcrypt.gensalt()
            )
            new_user_data.password = hashed_pw.decode("utf-8")
            new_user_id = create_user(cur, new_user_data)
            used = use_invite(cur, invite_code)
            if not used:
                raise APIError("INVITE_RACE_CONDITION", "Invite already used", 400)
            return success_response({"id": new_user_id}, 201)

    except pg_errors.UniqueViolation as e:
        if "users_email_key" in str(e):
            raise APIError("DUPLICATE_EMAIL", "Email already in use", 409)
        elif "users_username_key" in str(e):
            raise APIError("DUPLICATE_USERNAME", "Username already in use", 409)
        raise APIError("DUPLICATE_FIELD", "A unique field already exists", 409)


@user_bp.route("/users/<int:target_user_id>", methods=["GET"])
def user_get(target_user_id):
    with get_db() as (conn, cur):
        user = get_user_by_id(cur, target_user_id)
        if user is None:
            raise APIError(
                "USER_NOT_FOUND", f"User {target_user_id} does not exist", 404
            )
        return success_response(user.model_dump(), 200)


@user_bp.route("/users/<int:target_user_id>", methods=["PATCH", "DELETE"])
@require_auth
def user_detail(user_id, target_user_id):
    updated_user = None
    admins = None
    current_user = None
    availability_changed = False

    with get_db() as (conn, cur):
        current_user = get_me(cur, user_id)

        if user_id != target_user_id and not current_user.admin:
            raise APIError("FORBIDDEN", "Not authorized", 403)

        if request.method == "PATCH":
            data = request.get_json()
            user_data = UserUpdate(**data)

            availability_changed = "availability" in data

            if user_data.password is not None:
                current_password = data.get("current_password")
                if not current_password:
                    raise APIError("BAD_REQUEST", "Current password required", 400)

                full_user = get_user_by_email(cur, current_user.email)

                if not bcrypt.checkpw(
                    current_password.encode(),
                    full_user.password.encode()
                ):
                    raise APIError("FORBIDDEN", "Current password is incorrect", 403)

                hashed_pw = bcrypt.hashpw(
                    user_data.password.encode("utf-8"),
                    bcrypt.gensalt()
                )
                user_data.password = hashed_pw.decode("utf-8")

            updated_user = update_user(cur, target_user_id, user_data)

            # fetch admins INSIDE DB context
            if availability_changed:
                admins = get_admins(cur)

        elif request.method == "DELETE":
            deleted_user = delete_user(cur, target_user_id)

            if deleted_user is None:
                raise APIError(
                    "USER_NOT_FOUND",
                    f"User {target_user_id} does not exist",
                    404
                )

            return success_response({"deleted": deleted_user}, 200)

    # 🔥 OUTSIDE DB CONTEXT (safe place for side effects)
    if request.method == "PATCH" and availability_changed:
        for admin in admins:
            resend.Emails.send({
                "from": "Maid Cafe <onboarding@resend.dev>",
                "to": [admin.email],
                "subject": "Availability updated",
                "html": f"""
                    <p>{current_user.username} updated their availability.</p>
                """,
            })

    return success_response({"updated": updated_user}, 200)