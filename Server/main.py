from flask import Flask, request
import bcrypt

from db import connect_db, get_event_by_id, update_task, update_event, Event, delete_event, EventUpdate, get_all_events, \
    create_event, get_user_by_id, UserBase, update_user, UserAuthorization, UserUpdate, delete_user, create_user

app = Flask(__name__)


def success_response(data, status=200):
    return {
        "success": True,
        "data": data,
        "error": None
    }, status


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
        "error": {
            "code": err.code,
            "message": err.message
        }
    }, err.status


@app.errorhandler(Exception)
def handle_unexpected_error(err):
    return {
        "success": False,
        "data": None,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "Something went wrong"
        }
    }, 500


@app.route("/")
def home():
    return {"success": True}


@app.route("/users", methods=["POST"])
def users():
    conn = connect_db()
    cur = conn.cursor()
    try:
        data = request.get_json()
        new_user_data = UserAuthorization(**data)

        # Hash the password
        hashed_pw = bcrypt.hashpw(
            new_user_data.password.encode("utf-8"),
            bcrypt.gensalt()
        )
        new_user_data.password = hashed_pw.decode("utf-8")

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
                    user_data.password.encode("utf-8"),
                    bcrypt.gensalt()

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


# TODO: add pagination eventually
@app.route("/events", methods=["GET", "POST"])
def events_collection():
    conn = connect_db()
    cur = conn.cursor()
    try:
        if request.method == "GET":
            events = get_all_events(cur)

            if len(events) == 0:
                raise APIError("EVENTS_NOT_FOUND", "No events found", 404)

            events_data = [event.model_dump() for event in events]
            return success_response(events_data, 200)

        elif request.method == "POST":
            data = request.get_json()
            posted_event = Event(**data)

            event_id = create_event(cur, posted_event)
            conn.commit()

            return success_response({"id": event_id}, 201)

    finally:
        conn.close()


# TODO: add a finally clause to close db connection
@app.route("/events/<int:event_id>", methods=["GET", "PATCH", "DELETE"])
def events_detail(event_id):
    conn = connect_db()
    cur = conn.cursor()
    try:
        if request.method == "GET":
            event = get_event_by_id(cur, event_id)
            if event is None:
                raise APIError("EVENT_NOT_FOUND", f"EVENT {event_id} does not exist", 404)
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
                raise APIError("EVENT_NOT_FOUND", f"EVENT {event_id} does not exist", 404)
            conn.commit()
            return success_response({"deleted": deleted_id}, 200)

    finally:
        conn.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
