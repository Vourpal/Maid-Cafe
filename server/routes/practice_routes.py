from flask import Blueprint

from middleware import require_admin

practice_bp = Blueprint("practice", __name__)


@practice_bp.route("/attendance/practice", methods=["GET"])
@require_admin
def get_practices():
    pass
