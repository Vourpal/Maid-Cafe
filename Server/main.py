from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
import bcrypt
import traceback

from db import (
    UserRegister,
    connect_db,
    get_event_by_id,
    get_events_paginated,
    get_total_events,
    get_user_by_email,
    update_event,
    Event,
    delete_event,
    EventUpdate,
    create_event,
    get_user_by_id,
    update_user,
    UserAuthorization,
    UserUpdate,
    delete_user,
    create_user,
)
from auth import create_token, verify_token

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=[
    "http://localhost:3000",
    "http://192.168.4.103:3000"
])


# TODO1: JWT authentication
# TODO2: Blueprints (modular routing)
# TODO3: Filterings + sorting + advanced pagination
# TODO4: Environment variables + config management
# TODO5: swagger docs
# TODO6: Pytest
def success_response(data, status=200):
    return {"success": True, "data": data, "error": None}, status


class APIError(Exception):
    def __init__(self, code, message, status=400):
        self.code = code
        self.message = message
        self.status = status


@app.errorhandler(APIError)
def handle_api_error(err):
    return {
        "success": False,
        "data": None,
        "error": {"code": err.code, "message": err.message},
    }, err.status


@app.errorhandler(Exception)
def handle_unexpected_error(err):
    print("UNEXPECTED ERROR:", err)
    traceback.print_exc()  # <-- prints full traceback to console

    return {
        "success": False,
        "data": None,
        "error": {"code": "INTERNAL_SERVER_ERROR", "message": "Something went wrong"},
    }, 500


@app.route("/")
def home():
    return {"success": True}


@app.route("/auth/login", methods=["POST"])
def login():
    conn = connect_db()
    cur = conn.cursor()

    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        user = get_user_by_email(cur, email)

        print("USER:", user)
        print("HASH:", repr(user.password))
        print("ENTERED PASSWORD:", password)

        if not user:
            raise APIError("INVALID_CREDENTIALS", "invalid user or passowrd", 401)

        if not bcrypt.checkpw(password.encode(), user.password.encode()):
            raise APIError("INVALID_CREDENTIALS", "invalid user or passowrd", 401)

        token = create_token(user.id)
        # response needed because you can't set cookie to a normal dict|||
        response = make_response(
            jsonify(
                {
                    "success": True,
                    "data": {
                        "id": user.id,
                        "email": user.email,
                        "name": user.first_name,
                    },
                    "error": None,
                }
            )
        )

        response.set_cookie(
            "token",
            token,
            httponly=True,
            samesite="Lax",
            secure=False, # set to true in production with https
            max_age=60 * 60 * 24 * 7,  # might need to change this to 1 day (60*60*24)?
        )
        return response

    finally:
        conn.close()


@app.route("/auth/me", methods=["GET"])
def get_current_user():
    token = request.cookies.get("token")

    if not token:
        raise APIError("UNAUTHORIZED", "Not logged in", 401)

    user_id = verify_token(token)  # does this token contain a userid

    if not user_id:
        raise APIError("UNAUTHORIZED", "Invalid token", 401)

    conn = connect_db()
    cur = conn.cursor()

    try:
        user = get_user_by_id(cur, user_id)  # does this userid even exist in db?
        print("this is what i look like", success_response(user.model_dump()))

        return success_response(user.model_dump())
    finally:
        conn.close()


@app.route("/auth/logout", methods=["POST"])
def logout():
    response = make_response({"message": "Logged out successfully"})
    response.delete_cookie("token", path="/", samesite="Lax")
    return response


@app.route("/users", methods=["POST"])
def users():
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

        # Hash the password
        hashed_pw = bcrypt.hashpw(
            new_user_data.password.encode("utf-8"), bcrypt.gensalt()
        )
        new_user_data.password = hashed_pw.decode("utf-8")
        print("REGISTERED PASSWORD:", new_user_data.password)

        new_user_id = create_user(cur, new_user_data)
        conn.commit()

        return success_response({"id": new_user_id}, 201)

    finally:
        conn.close()


@app.route("/users/<int:user_id>", methods=["GET", "PATCH", "DELETE"])
def users_collection(user_id):
    conn = connect_db()
    cur = conn.cursor()
    try:
        if request.method == "GET":
            user = get_user_by_id(cur, user_id)
            if user is None:
                raise APIError("USER_NOT_FOUND", f"USER {user_id} does not exist", 404)
            return success_response(user.model_dump(), 200)

        elif request.method == "PATCH":
            data = request.get_json()
            user_data = UserUpdate(**data)
            # If password is being updated, hash it
            if user_data.password is not None:
                hashed_pw = bcrypt.hashpw(
                    user_data.password.encode("utf-8"), bcrypt.gensalt()
                )
                user_data.password = hashed_pw.decode("utf-8")
            updated_user = update_user(cur, user_id, user_data)
            conn.commit()

            return success_response({"updated": updated_user}, 200)

        elif request.method == "DELETE":
            deleted_user = delete_user(cur, user_id)

            if deleted_user is None:
                raise APIError("USER_NOT_FOUND", f"USER {user_id} does not exist", 404)

            conn.commit()
            return success_response({"deleted": deleted_user}, 200)

    finally:
        conn.close()


@app.route("/events", methods=["GET", "POST"])
def events_collection():
    conn = connect_db()
    cur = conn.cursor()

    try:
        if request.method == "GET":
            page = int(request.args.get("page", 1))
            quantity = int(request.args.get("quantity", 10))
            offset = (page - 1) * quantity

            # Filters
            min_capacity = request.args.get("min_capacity")

            events = get_events_paginated(cur, quantity, offset, min_capacity)
            total = get_total_events(cur)

            if len(events) == 0:
                raise APIError("EVENTS_NOT_FOUND", "No events found", 404)

            return success_response(
                {
                    "page": page,
                    "quantity": quantity,
                    "count": len(events),
                    "total": total,
                    "events": [event.model_dump() for event in events],
                },
                200,
            )

        elif request.method == "POST":
            data = request.get_json()
            posted_event = Event(**data)

            event_id = create_event(cur, posted_event)
            conn.commit()

            return success_response({"id": event_id}, 201)

    finally:
        conn.close()


@app.route("/events/<int:event_id>", methods=["GET", "PATCH", "DELETE"])
def events_detail(event_id):
    conn = connect_db()
    cur = conn.cursor()
    try:
        if request.method == "GET":
            event = get_event_by_id(cur, event_id)
            if event is None:
                raise APIError(
                    "EVENT_NOT_FOUND", f"EVENT {event_id} does not exist", 404
                )
            return success_response(event.model_dump(), 200)

        elif request.method == "PATCH":
            data = request.get_json()
            updated_event = EventUpdate(**data)
            updated_id = update_event(cur, event_id, updated_event)
            conn.commit()
            return success_response({"id": updated_id}, 200)

        elif request.method == "DELETE":
            deleted_id = delete_event(cur, event_id)
            if deleted_id is None:
                raise APIError(
                    "EVENT_NOT_FOUND", f"EVENT {event_id} does not exist", 404
                )
            conn.commit()
            return success_response({"deleted": deleted_id}, 200)

    finally:
        conn.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
