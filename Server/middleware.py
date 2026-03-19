from functools import wraps

from flask import request

from auth import verify_token
from db import connect_db
from queries.user_queries import get_me
from utils import APIError


def require_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = request.cookies.get("token")

        if not token:
            raise APIError("UNAUTHORIZED", "Not logged in", 401)

        user_id = verify_token(token)

        if not user_id:
            raise APIError("UNAUTHORIZED", "Invalid token", 401)
        return func(user_id=user_id, *args, **kwargs)

    return wrapper


def require_admin(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
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
            if not user.admin:
                raise APIError("FORBIDDEN", "Admins only", 403)
        finally:
            conn.close()

        return func(user_id=user_id, *args, **kwargs)
    return wrapper