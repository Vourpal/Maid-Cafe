import csv
import io

from flask import Response, jsonify, request

from contextlib import contextmanager


from db import connect_db, release_db 

@contextmanager
def get_db():
    conn = None
    try:
        conn = connect_db()
        cur = conn.cursor()
        yield conn, cur
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            release_db(conn)

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
    


# ── Query-string parsing ──────────────────────────────────────────────────────
# Raw int(request.args.get(...)) raises ValueError on junk input, which the
# global handler turns into a 500. These coerce and clamp instead.


def int_arg(name, default=None, minimum=None, maximum=None):
    raw = request.args.get(name)
    if raw is None or raw == "":
        value = default
    else:
        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise APIError("VALIDATION_ERROR", f"'{name}' must be a whole number", 422)

    if value is None:
        return None
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def bool_arg(name, default=None):
    """Tri-state: returns None when the caller did not supply the parameter, so
    filters can distinguish "no preference" from "explicitly false"."""
    raw = request.args.get(name)
    if raw is None or raw == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def str_arg(name, default=None, allowed=None):
    raw = request.args.get(name)
    if raw is None or raw.strip() == "":
        return default
    value = raw.strip()
    if allowed is not None and value not in allowed:
        return default
    return value


def pagination_args(default_quantity=25, max_quantity=200):
    """Shared page/quantity handling. Quantity is capped so a client cannot ask
    for an unbounded result set."""
    page = int_arg("page", default=1, minimum=1)
    quantity = int_arg(
        "quantity", default=default_quantity, minimum=1, maximum=max_quantity
    )
    return page, quantity, (page - 1) * quantity


# ── CSV export ────────────────────────────────────────────────────────────────


def csv_response(filename: str, headers: list[str], rows: list[list]):
    """Build a downloadable CSV.

    utf-8-sig gives Excel the BOM it needs to read non-ASCII names correctly.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(headers)
    for row in rows:
        writer.writerow(["" if cell is None else cell for cell in row])

    return Response(
        buffer.getvalue().encode("utf-8-sig"),
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            # Lets the browser read the filename on a cross-origin download.
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
