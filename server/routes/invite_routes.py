from flask import Blueprint, request
from models import InviteCreate
from queries.invite_queries import (
    create_invite,
    delete_invite,
    get_invites,
)
from middleware import require_admin
from utils import APIError, success_response, get_db

invite_bp = Blueprint("invites", __name__)


@invite_bp.route("/invites", methods=["POST"])
@require_admin
def create_new_invite(user_id):
    with get_db() as (conn, cur):
        data = request.get_json()
        invite_data = InviteCreate(**data)

        invite = create_invite(
            cur,
            created_by=user_id,
            max_uses=invite_data.max_uses,
            expires_at=invite_data.expires_at,
        )

        return success_response(invite, 201)


@invite_bp.route("/invites", methods=["GET"])
@require_admin
def get_all_invites(user_id):
    with get_db() as (conn, cur):
        invites = get_invites(cur)
        return success_response(invites, 200)
    

@invite_bp.route("/invites/<int:invite_id>", methods=["DELETE"])
@require_admin
def remove_invite(user_id, invite_id):
    with get_db() as (conn, cur):
        deleted = delete_invite(cur, invite_id)

        if not deleted:
            raise APIError(
                "NOT_FOUND",
                f"Invite {invite_id} does not exist",
                404,
            )

        return success_response({"deleted": deleted}, 200)
