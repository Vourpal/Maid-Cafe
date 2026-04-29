from flask import Blueprint, request

from queries.link_queries import create_link, get_links_by_category, update_link
from utils import get_db, success_response


link_bp = Blueprint("links", __name__)

@link_bp.route("/links", methods=["GET"])
def get_links():
    with get_db() as (conn, cur):
        category = request.args.get("category")
        data = get_links_by_category(cur, category)
        return success_response(data, 201)


@link_bp.route("/links", methods=["POST"])
def create_link_route():
    with get_db() as (conn, cur):
        data = request.get_json()

        category = data.get("category")
        link_url = data.get("link_url")
        title = data.get("title")

        new_link = create_link(cur, category, link_url, title)
        conn.commit()

        return {"data": new_link, "success": True, "error": None}, 201


@link_bp.route("/links/<int:link_id>", methods=["PUT"])
def update_link_route(link_id):
    with get_db() as (conn, cur):
        data = request.get_json()

        category = data.get("category")
        link_url = data.get("link_url")
        title = data.get("title")

        updated_link = update_link(cur, link_id, category, link_url, title)

        if not updated_link:
            return {"data": None, "success": False, "error": "Link not found"}, 404

        conn.commit()

        return {"data": updated_link, "success": True, "error": None}