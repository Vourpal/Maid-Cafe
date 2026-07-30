from flask import Blueprint, request
import bcrypt
from psycopg2 import errors as pg_errors
from pydantic import ValidationError
from models import AdminUserUpdate, UserRegister, UserAuthorization, UserUpdate
from queries.audit_queries import diff_changes, record_audit
from queries.invite_queries import validate_invite, use_invite
from queries.practice_queries import (
    get_user_practice_history,
    get_user_practice_summary,
)
from queries.user_queries import (
    count_admins,
    count_users,
    get_me,
    get_user_admin_state,
    get_user_by_email,
    get_user_by_id,
    create_user,
    get_users,
    update_user,
    delete_user,
)
from middleware import require_admin, require_auth
from utils import (
    APIError,
    bool_arg,
    get_db,
    int_arg,
    pagination_args,
    str_arg,
    success_response,
)

user_bp = Blueprint("users", __name__)

# Fields an admin may change on another account that the owner cannot.
_ADMIN_ONLY_FIELDS = {"admin", "active"}

_SORT_OPTIONS = {"name", "username", "email", "type", "admin", "active"}


@user_bp.route("/users", methods=["GET"])
@require_admin
def get_all_users(user_id):
    """Paginated, searchable staff directory.

    Returns an envelope (users/total/page/quantity) rather than a bare array so
    the client can paginate; callers that want everything pass a large quantity.
    """
    with get_db() as (conn, cur):
        page, quantity, offset = pagination_args(default_quantity=25, max_quantity=1000)
        search = str_arg("search")
        sort = str_arg("sort", default="name", allowed=_SORT_OPTIONS)
        direction = str_arg("direction", default="asc", allowed={"asc", "desc"})
        user_type = str_arg("type", allowed={"maid", "butler"})
        admin_only = bool_arg("admin_only", default=False)
        active = bool_arg("active")

        users = get_users(
            cur,
            limit=quantity,
            offset=offset,
            search=search,
            sort=sort,
            direction=direction,
            user_type=user_type,
            admin_only=admin_only,
            active=active,
        )
        total = count_users(
            cur,
            search=search,
            user_type=user_type,
            admin_only=admin_only,
            active=active,
        )

        return success_response(
            {
                "page": page,
                "quantity": quantity,
                "count": len(users),
                "total": total,
                "users": [u.model_dump() for u in users],
            },
            200,
        )


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

            record_audit(
                cur,
                actor_id=new_user_id,
                action="create",
                entity_type="user",
                entity_id=new_user_id,
                summary=(
                    f"{reg_data.first_name} {reg_data.last_name} registered "
                    f"with invite {invite_code}"
                ),
            )

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
    with get_db() as (conn, cur):
        current_user = get_me(cur, user_id)
        if current_user is None:
            raise APIError("UNAUTHORIZED", "Invalid token", 401)

        is_self = user_id == target_user_id
        is_admin = current_user.admin

        if not is_self and not is_admin:
            raise APIError("FORBIDDEN", "Not authorized", 403)

        if request.method == "PATCH":
            data = dict(request.get_json() or {})

            # Not a column — pulled out before validation because both models
            # forbid extra fields.
            current_password = data.pop("current_password", None)

            # Admins get the wider model (admin/active); everyone else gets the
            # self-service one, so the privileged flags are unreachable.
            model = AdminUserUpdate if is_admin else UserUpdate

            try:
                user_data = model(**data)
            except ValidationError as e:
                raise APIError("VALIDATION_ERROR", str(e), 422)

            requested = user_data.model_dump(exclude_unset=True)
            if not requested:
                raise APIError("BAD_REQUEST", "No fields to update", 400)

            before = get_user_admin_state(cur, target_user_id)
            if before is None:
                raise APIError(
                    "USER_NOT_FOUND", f"User {target_user_id} does not exist", 404
                )

            # ── Privileged flag guards ───────────────────────────────────────
            # Both prevent an admin locking themselves — or everyone — out.
            if requested.get("admin") is False:
                if is_self:
                    raise APIError(
                        "CANNOT_DEMOTE_SELF",
                        "You cannot remove your own admin access. Ask another admin.",
                        409,
                    )
                if count_admins(cur, excluding_user_id=target_user_id) == 0:
                    raise APIError(
                        "LAST_ADMIN",
                        "This is the only admin account — promote someone else first.",
                        409,
                    )

            if requested.get("active") is False and is_self:
                raise APIError(
                    "CANNOT_DEACTIVATE_SELF",
                    "You cannot deactivate your own account.",
                    409,
                )

            # ── Password handling ────────────────────────────────────────────
            password_changed = False
            if user_data.password is not None:
                if is_self:
                    # Changing your own password always requires the old one.
                    if not current_password:
                        raise APIError("BAD_REQUEST", "Current password required", 400)

                    full_user = get_user_by_email(cur, current_user.email)
                    if not bcrypt.checkpw(
                        current_password.encode(), full_user.password.encode()
                    ):
                        raise APIError(
                            "FORBIDDEN", "Current password is incorrect", 403
                        )
                # An admin resetting somebody else's password cannot supply that
                # user's current password, so it is not required here. The reset
                # is written to the audit log instead.

                hashed_pw = bcrypt.hashpw(
                    user_data.password.encode("utf-8"), bcrypt.gensalt()
                )
                user_data.password = hashed_pw.decode("utf-8")
                password_changed = True

            try:
                updated_user = update_user(cur, target_user_id, user_data)
            except pg_errors.UniqueViolation as e:
                if "users_email_key" in str(e):
                    raise APIError("DUPLICATE_EMAIL", "Email already in use", 409)
                if "users_username_key" in str(e):
                    raise APIError("DUPLICATE_USERNAME", "Username already in use", 409)
                raise APIError("DUPLICATE_FIELD", "A unique field already exists", 409)

            if updated_user is None:
                raise APIError(
                    "USER_NOT_FOUND", f"User {target_user_id} does not exist", 404
                )

            # ── Audit ────────────────────────────────────────────────────────
            after = get_user_admin_state(cur, target_user_id)
            changes = diff_changes(before, after or {})
            if password_changed:
                changes["password"] = {"from": "***", "to": "***"}
            # availability is large and noisy; record that it moved, not the blob.
            if "availability" in requested:
                changes["availability"] = {"from": "…", "to": "…"}

            if changes:
                target_name = f"{before['first_name']} {before['last_name']}"
                if is_self:
                    summary = f"Updated own profile ({', '.join(changes)})"
                else:
                    summary = f"Updated {target_name} ({', '.join(changes)})"

                record_audit(
                    cur,
                    actor_id=user_id,
                    actor=current_user,
                    action="update",
                    entity_type="user",
                    entity_id=target_user_id,
                    summary=summary,
                    changes=changes,
                )

            return success_response({"updated": updated_user}, 200)

        elif request.method == "DELETE":
            before = get_user_admin_state(cur, target_user_id)
            if before is None:
                raise APIError(
                    "USER_NOT_FOUND", f"User {target_user_id} does not exist", 404
                )

            if is_self:
                raise APIError(
                    "CANNOT_DELETE_SELF",
                    "You cannot delete your own account.",
                    409,
                )

            if before["admin"] and count_admins(cur, excluding_user_id=target_user_id) == 0:
                raise APIError(
                    "LAST_ADMIN",
                    "This is the only admin account — promote someone else first.",
                    409,
                )

            try:
                deleted_user = delete_user(cur, target_user_id)
            except pg_errors.ForeignKeyViolation:
                # attendances/practices/tasks reference users without ON DELETE
                # rules, so anyone with history cannot be hard-deleted. Say so
                # plainly instead of surfacing a 500.
                raise APIError(
                    "USER_HAS_HISTORY",
                    "This member has event or practice history and cannot be "
                    "deleted. Mark them inactive instead.",
                    409,
                )

            if deleted_user is None:
                raise APIError(
                    "USER_NOT_FOUND", f"User {target_user_id} does not exist", 404
                )

            record_audit(
                cur,
                actor_id=user_id,
                actor=current_user,
                action="delete",
                entity_type="user",
                entity_id=target_user_id,
                summary=(
                    f"Deleted {before['first_name']} {before['last_name']} "
                    f"(@{before['username']})"
                ),
                changes={"deleted": before},
            )

            return success_response({"deleted": deleted_user}, 200)


@user_bp.route("/users/<int:target_user_id>/practice-history", methods=["GET"])
@require_auth
def user_practice_history(user_id, target_user_id):
    """One member's practice attendance record over time.

    Visible to admins for anyone, and to members for themselves.
    """
    with get_db() as (conn, cur):
        current_user = get_me(cur, user_id)
        if current_user is None:
            raise APIError("UNAUTHORIZED", "Invalid token", 401)

        if user_id != target_user_id and not current_user.admin:
            raise APIError("FORBIDDEN", "Not authorized", 403)

        target = get_user_admin_state(cur, target_user_id)
        if target is None:
            raise APIError(
                "USER_NOT_FOUND", f"User {target_user_id} does not exist", 404
            )

        include_upcoming = bool_arg("include_upcoming", default=False)
        limit = int_arg("limit", default=None, minimum=1, maximum=500)

        history = get_user_practice_history(
            cur, target_user_id, past_only=not include_upcoming
        )
        if limit:
            history = history[:limit]

        return success_response(
            {
                "user": {
                    "id": target["id"],
                    "first_name": target["first_name"],
                    "last_name": target["last_name"],
                    "username": target["username"],
                    "type": target["type"],
                },
                "summary": get_user_practice_summary(cur, target_user_id),
                "history": history,
            },
            200,
        )
