from flask import jsonify

from contextlib import contextmanager


from db import connect_db, release_db 

@contextmanager
def get_db():
    conn = connect_db()
    try:
        yield conn, conn.cursor()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_db(conn)    # ← was conn.close()


# ── Response helpers ──────────────────────────────────────────────────────────


def success_response(data, status=200):
    return jsonify({"success": True, "data": data, "error": None}), status


def error_response(code, message, status=400):
    return jsonify(
        {"success": False, "data": None, "error": {"code": code, "message": message}}
    ), status


# ── Custom exception ──────────────────────────────────────────────────────────


class APIError(Exception):
    def __init__(self, code, message, status=400):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


# ── Error handlers ────────────────────────────────────────────────────────────


def register_error_handlers(app):

    @app.errorhandler(APIError)
    def handle_api_error(e):
        return error_response(e.code, e.message, e.status)

    @app.errorhandler(Exception)
    def handle_unexpected(e):
        app.logger.exception(e)
        return error_response("INTERNAL_ERROR", "Something went wrong", 500)
    

