from flask import Blueprint, request

from queries.link_queries import get_links_by_category
from utils import get_db, success_response


link_bp = Blueprint("links", __name__)

@link_bp.route("/links", methods=["GET"])
def get_links():
    with get_db() as (conn, cur):
        category = request.args.get("category")
        data = get_links_by_category(cur, category)
        return success_response(data, 201)
