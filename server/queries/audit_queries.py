"""Audit trail for administrative mutations.

Writes go through the same cursor as the change being recorded, so the log
entry and the change land in one transaction — if the mutation rolls back, so
does its audit row.
"""

from psycopg2.extras import Json

# Whitelisted so a typo can't quietly create a new pseudo-action.
ACTIONS = {"create", "update", "delete", "restore", "login"}

_SORTABLE = "created_at DESC, id DESC"


def actor_label(user) -> str | None:
    """Human-readable stamp for the acting admin, denormalised so the entry
    survives that user being deleted later."""
    if user is None:
        return None
    return f"{user.first_name} {user.last_name} (@{user.username})"


def record_audit(
    db,
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    summary: str | None = None,
    changes: dict | None = None,
    actor: object | None = None,
):
    """Append one entry to the audit log.

    `changes` is stored as JSONB and is meant to hold a {field: {from, to}}
    style diff, but any JSON-serialisable dict is accepted.
    """
    db.execute(
        """
        INSERT INTO audit_log
            (actor_id, actor_label, action, entity_type, entity_id, summary, changes)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            actor_id,
            actor_label(actor),
            action,
            entity_type,
            entity_id,
            summary[:255] if summary else None,
            Json(changes) if changes is not None else None,
        ),
    )
    row = db.fetchone()
    return row[0] if row else None


def _audit_filters(entity_type=None, action=None, actor_id=None, search=None):
    clause = ""
    params: list = []

    if entity_type:
        clause += " AND a.entity_type = %s"
        params.append(entity_type)

    if action:
        clause += " AND a.action = %s"
        params.append(action)

    if actor_id:
        clause += " AND a.actor_id = %s"
        params.append(actor_id)

    if search:
        clause += " AND (a.summary ILIKE %s OR a.actor_label ILIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])

    return clause, params


def get_audit_log(
    db,
    limit: int,
    offset: int,
    entity_type: str | None = None,
    action: str | None = None,
    actor_id: int | None = None,
    search: str | None = None,
):
    clause, params = _audit_filters(entity_type, action, actor_id, search)

    db.execute(
        f"""
        SELECT
            a.id,
            a.actor_id,
            a.actor_label,
            a.action,
            a.entity_type,
            a.entity_id,
            a.summary,
            a.changes,
            a.created_at
        FROM audit_log a
        WHERE 1=1 {clause}
        ORDER BY {_SORTABLE}
        LIMIT %s OFFSET %s;
        """,
        tuple(params + [limit, offset]),
    )

    return [
        {
            "id": row[0],
            "actor_id": row[1],
            "actor_label": row[2],
            "action": row[3],
            "entity_type": row[4],
            "entity_id": row[5],
            "summary": row[6],
            "changes": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
        }
        for row in db.fetchall()
    ]


def count_audit_log(
    db,
    entity_type: str | None = None,
    action: str | None = None,
    actor_id: int | None = None,
    search: str | None = None,
):
    clause, params = _audit_filters(entity_type, action, actor_id, search)
    db.execute(
        f"SELECT COUNT(*) FROM audit_log a WHERE 1=1 {clause};",
        tuple(params),
    )
    return db.fetchone()[0]


def get_audit_entity_types(db):
    """Distinct entity types present in the log, for populating filter menus."""
    db.execute("SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type;")
    return [row[0] for row in db.fetchall()]


def diff_changes(before: dict, after: dict, redact: set[str] | None = None) -> dict:
    """Build a {field: {"from": x, "to": y}} diff of only what actually moved.

    Fields named in `redact` are recorded as changed without their values, so
    secrets never reach the log.
    """
    redact = redact or set()
    changes: dict = {}

    for key, new_value in after.items():
        old_value = before.get(key)
        if old_value == new_value:
            continue
        if key in redact:
            changes[key] = {"from": "***", "to": "***"}
        else:
            changes[key] = {"from": old_value, "to": new_value}

    return changes
