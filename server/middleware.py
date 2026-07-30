from functools import wraps

from flask import request

from auth import verify_token
from db import connect_db, release_db
from queries.user_queries import get_me
from utils import APIError

# COOKIE VERSION

# def require_auth(func):
#     @wraps(func)
#     def wrapper(*args, **kwargs):
#         token = request.cookies.get("token")

#         if not token:
#             raise APIError("UNAUTHORIZED", "Not logged in", 401)

#         user_id = verify_token(token)

#         if not user_id:
#             raise APIError("UNAUTHORIZED", "Invalid token", 401)
#         return func(user_id=user_id, *args, **kwargs)

#     return wrapper

# LOCALSTORAGE VERSION


def require_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            raise APIError("UNAUTHORIZED", "Not logged in", 401)

        token = auth_header.split(" ")[1]
        user_id = verify_token(token)

        if not user_id:
            raise APIError("UNAUTHORIZED", "Invalid token", 401)

        return func(user_id=user_id, *args, **kwargs)

    return wrapper


# COOKIE VERSION

# def require_admin(func):
#     @wraps(func)
#     def wrapper(*args, **kwargs):
#         token = request.cookies.get("token")

#         if not token:
#             raise APIError("UNAUTHORIZED", "Not logged in", 401)

#         user_id = verify_token(token)

#         if not user_id:
#             raise APIError("UNAUTHORIZED", "Invalid token", 401)

#         conn = connect_db()
#         cur = conn.cursor()
#         try:
#             user = get_me(cur, user_id)
#             if not user.admin:
#                 raise APIError("FORBIDDEN", "Admins only", 403)
#         finally:
#             conn.close()

#         return func(user_id=user_id, *args, **kwargs)

#     return wrapper


def require_admin(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            raise APIError("UNAUTHORIZED", "Not logged in", 401)

        token = auth_header.split(" ")[1]
        user_id = verify_token(token)

        if not user_id:
            raise APIError("UNAUTHORIZED", "Invalid token", 401)

        conn = connect_db()
        try:
            cur = conn.cursor()
            user = get_me(cur, user_id)

            # A token for a since-deleted user is not a valid session.
            if user is None:
                raise APIError("UNAUTHORIZED", "Invalid token", 401)

            if not user.admin:
                raise APIError("FORBIDDEN", "Admins only", 403)
        finally:
            # Return the connection to the pool. conn.close() would drop it
            # while the pool still counted it as in use, leaking a slot per call.
            release_db(conn)

        return func(user_id=user_id, *args, **kwargs)

    return wrapper
