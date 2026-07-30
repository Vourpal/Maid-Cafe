"""Costume and prop inventory.

Status is derived, not stored. An item is:

    retired / in_repair / in_laundry   from `condition`
    assigned                           when an open checkout row exists
    available                          otherwise

Keeping it out of a column means the status can never drift out of step with the
checkout log the way a stored copy would. `quantity` is respected: an item with
3 copies only reads as `assigned` once all 3 are out.
"""

from datetime import datetime, timezone

_UPDATABLE_COLUMNS = {
    "name",
    "category",
    "description",
    "size",
    "color",
    "owner_id",
    "condition",
    "quantity",
    "storage_location",
    "notes",
}

# Whitelist for ORDER BY so the sort parameter never reaches SQL directly.
_SORT_COLUMNS = {
    "name": "i.name ASC",
    "category": "i.category ASC, i.name ASC",
    "condition": "i.condition ASC, i.name ASC",
    "owner": "o.last_name ASC NULLS FIRST, i.name ASC",
    "created_at": "i.created_at DESC",
}

# out_count is the number of copies currently checked out, which is what the
# derived status and the availability filter both hang off.
_SELECT = """
    SELECT
        i.id,
        i.name,
        i.category,
        i.description,
        i.size,
        i.color,
        i.owner_id,
        i.condition,
        i.quantity,
        i.storage_location,
        i.notes,
        i.created_at,
        o.first_name,
        o.last_name,
        o.username,
        (SELECT COUNT(*) FROM costume_assignments ca
            WHERE ca.item_id = i.id AND ca.returned_at IS NULL) AS out_count
    FROM costume_items i
    LEFT JOIN users o ON o.id = i.owner_id
"""


def _iso(value):
    return value.isoformat() if value else None


def _is_overdue(due_back_at, returned_at) -> bool:
    """Still out and past its due date. due_back_at is TIMESTAMPTZ, so compare
    against an aware now — a naive comparison would raise."""
    if returned_at is not None or due_back_at is None:
        return False

    now = datetime.now(timezone.utc)
    if due_back_at.tzinfo is None:
        now = now.replace(tzinfo=None)
    return due_back_at < now


def _derive_status(condition: str, out_count: int, quantity: int) -> str:
    if condition == "retired":
        return "retired"
    if condition == "needs_repair":
        return "in_repair"
    if condition == "needs_cleaning":
        return "in_laundry"
    if out_count >= max(quantity, 1):
        return "assigned"
    if out_count > 0:
        return "partially_out"
    return "available"


def _item_row(row):
    owner = None
    if row[6] is not None and row[12] is not None:
        owner = {
            "id": row[6],
            "first_name": row[12],
            "last_name": row[13],
            "username": row[14],
        }

    out_count = row[15]
    quantity = row[8]

    return {
        "id": row[0],
        "name": row[1],
        "category": row[2],
        "description": row[3],
        "size": row[4],
        "color": row[5],
        "owner_id": row[6],
        "condition": row[7],
        "quantity": quantity,
        "storage_location": row[9],
        "notes": row[10],
        "created_at": _iso(row[11]),
        "owner": owner,
        "group_owned": row[6] is None,
        "out_count": out_count,
        "available_count": max(quantity - out_count, 0),
        "status": _derive_status(row[7], out_count, quantity),
    }


def create_costume_item(db, item):
    db.execute(
        """
        INSERT INTO costume_items
            (name, category, description, size, color, owner_id, condition,
             quantity, storage_location, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            item.name,
            item.category,
            item.description,
            item.size,
            item.color,
            item.owner_id,
            item.condition,
            item.quantity,
            item.storage_location,
            item.notes,
        ),
    )
    return db.fetchone()[0]


def _costume_filters(
    category=None,
    condition=None,
    owner_id=None,
    group_owned=None,
    search=None,
    availability=None,
):
    """Shared between the list and count queries so the total always matches the
    rows. `availability` is filtered on the derived open-checkout count."""
    clause = ""
    params: list = []

    if category:
        clause += " AND i.category = %s"
        params.append(category)

    if condition:
        clause += " AND i.condition = %s"
        params.append(condition)

    if owner_id is not None:
        clause += " AND i.owner_id = %s"
        params.append(owner_id)

    if group_owned is True:
        clause += " AND i.owner_id IS NULL"
    elif group_owned is False:
        clause += " AND i.owner_id IS NOT NULL"

    if search:
        clause += """
            AND (
                i.name ILIKE %s
                OR i.description ILIKE %s
                OR i.storage_location ILIKE %s
                OR i.color ILIKE %s
            )
        """
        like = f"%{search}%"
        params.extend([like] * 4)

    open_count = """
        (SELECT COUNT(*) FROM costume_assignments ca
            WHERE ca.item_id = i.id AND ca.returned_at IS NULL)
    """

    if availability == "available":
        clause += f"""
            AND i.condition NOT IN ('retired', 'needs_repair', 'needs_cleaning')
            AND {open_count} < GREATEST(i.quantity, 1)
        """
    elif availability == "assigned":
        clause += f" AND {open_count} > 0"
    elif availability == "in_repair":
        clause += " AND i.condition = 'needs_repair'"
    elif availability == "in_laundry":
        clause += " AND i.condition = 'needs_cleaning'"
    elif availability == "retired":
        clause += " AND i.condition = 'retired'"

    return clause, params


def get_costume_items(
    db,
    limit: int = 50,
    offset: int = 0,
    category: str | None = None,
    condition: str | None = None,
    owner_id: int | None = None,
    group_owned: bool | None = None,
    search: str | None = None,
    availability: str | None = None,
    sort: str = "name",
):
    clause, params = _costume_filters(
        category, condition, owner_id, group_owned, search, availability
    )
    order_by = _SORT_COLUMNS.get(sort, _SORT_COLUMNS["name"])

    db.execute(
        f"""
        {_SELECT}
        WHERE 1=1 {clause}
        ORDER BY {order_by}, i.id ASC
        LIMIT %s OFFSET %s;
        """,
        tuple(params + [limit, offset]),
    )
    return [_item_row(row) for row in db.fetchall()]


def count_costume_items(
    db,
    category: str | None = None,
    condition: str | None = None,
    owner_id: int | None = None,
    group_owned: bool | None = None,
    search: str | None = None,
    availability: str | None = None,
):
    clause, params = _costume_filters(
        category, condition, owner_id, group_owned, search, availability
    )
    db.execute(
        f"SELECT COUNT(*) FROM costume_items i WHERE 1=1 {clause};",
        tuple(params),
    )
    return db.fetchone()[0]


def get_costume_item_by_id(db, item_id: int):
    db.execute(
        f"""
        {_SELECT}
        WHERE i.id = %s;
        """,
        (item_id,),
    )
    row = db.fetchone()
    return _item_row(row) if row else None


def update_costume_item(db, item_id: int, item):
    """Partial update driven by exclude_unset, so an explicit null clears a
    nullable column (that is how an item goes from member-owned back to
    group-owned)."""
    payload = item.model_dump(exclude_unset=True)

    fields = []
    values = []
    for column, value in payload.items():
        if column not in _UPDATABLE_COLUMNS:
            continue
        fields.append(f"{column} = %s")
        values.append(value)

    if not fields:
        return None

    db.execute(
        f"""
        UPDATE costume_items
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
        """,
        tuple(values + [item_id]),
    )
    row = db.fetchone()
    return row[0] if row else None


def delete_costume_item(db, item_id: int):
    db.execute(
        """
        DELETE FROM costume_items
        WHERE id = %s
        RETURNING id;
        """,
        (item_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def get_costume_stats(db):
    """Counts for the tab header."""
    db.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE category = 'costume') AS costumes,
            COUNT(*) FILTER (WHERE category = 'prop') AS props,
            COUNT(*) FILTER (WHERE owner_id IS NULL) AS group_owned,
            COUNT(*) FILTER (WHERE condition = 'needs_repair') AS needs_repair,
            COUNT(*) FILTER (WHERE condition = 'needs_cleaning') AS needs_cleaning,
            COUNT(*) FILTER (WHERE condition = 'retired') AS retired
        FROM costume_items;
        """
    )
    row = db.fetchone()

    db.execute(
        """
        SELECT
            COUNT(*) AS checked_out,
            COUNT(*) FILTER (WHERE due_back_at IS NOT NULL AND due_back_at < NOW())
                AS overdue
        FROM costume_assignments
        WHERE returned_at IS NULL;
        """
    )
    out = db.fetchone()

    return {
        "total": row[0],
        "costumes": row[1],
        "props": row[2],
        "group_owned": row[3],
        "member_owned": row[0] - row[3],
        "needs_repair": row[4],
        "needs_cleaning": row[5],
        "retired": row[6],
        "checked_out": out[0],
        "overdue": out[1],
    }


# ── Check-out log ────────────────────────────────────────────────────────────


_ASSIGNMENT_SELECT = """
    SELECT
        ca.id,
        ca.item_id,
        ca.user_id,
        ca.event_id,
        ca.checked_out_at,
        ca.due_back_at,
        ca.returned_at,
        ca.notes,
        u.first_name,
        u.last_name,
        u.username,
        e.title,
        e.start_date,
        e.end_date,
        i.name,
        i.category
    FROM costume_assignments ca
    LEFT JOIN users u ON u.id = ca.user_id
    LEFT JOIN events e ON e.id = ca.event_id
    JOIN costume_items i ON i.id = ca.item_id
"""


def _costume_assignment_row(row):
    return {
        "id": row[0],
        "item_id": row[1],
        "user_id": row[2],
        "event_id": row[3],
        "checked_out_at": _iso(row[4]),
        "due_back_at": _iso(row[5]),
        "returned_at": _iso(row[6]),
        "notes": row[7],
        "first_name": row[8],
        "last_name": row[9],
        "username": row[10],
        "event_title": row[11],
        "event_start": _iso(row[12]),
        "event_end": _iso(row[13]),
        "item_name": row[14],
        "item_category": row[15],
        "open": row[6] is None,
        "overdue": _is_overdue(row[5], row[6]),
    }


def checkout_costume_item(db, item_id: int, checkout):
    db.execute(
        """
        INSERT INTO costume_assignments
            (item_id, user_id, event_id, due_back_at, notes)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            item_id,
            checkout.user_id,
            checkout.event_id,
            checkout.due_back_at,
            checkout.notes,
        ),
    )
    return db.fetchone()[0]


def return_costume_item(db, assignment_id: int, notes: str | None = None):
    """Close one checkout row. Already-returned rows are left alone so a double
    click cannot rewrite the original return time."""
    db.execute(
        """
        UPDATE costume_assignments
        SET returned_at = NOW(),
            notes = COALESCE(%s, notes)
        WHERE id = %s AND returned_at IS NULL
        RETURNING id;
        """,
        (notes, assignment_id),
    )
    row = db.fetchone()
    return row[0] if row else None


def get_costume_assignment_by_id(db, assignment_id: int):
    db.execute(
        f"""
        {_ASSIGNMENT_SELECT}
        WHERE ca.id = %s;
        """,
        (assignment_id,),
    )
    row = db.fetchone()
    return _costume_assignment_row(row) if row else None


def get_item_history(db, item_id: int, limit: int = 50):
    db.execute(
        f"""
        {_ASSIGNMENT_SELECT}
        WHERE ca.item_id = %s
        ORDER BY ca.checked_out_at DESC
        LIMIT %s;
        """,
        (item_id, limit),
    )
    return [_costume_assignment_row(row) for row in db.fetchall()]


def get_open_checkouts(db, event_id: int | None = None, user_id: int | None = None):
    """Everything currently out, optionally narrowed to one event or member."""
    clause = ""
    params: list = []

    if event_id is not None:
        clause += " AND ca.event_id = %s"
        params.append(event_id)

    if user_id is not None:
        clause += " AND ca.user_id = %s"
        params.append(user_id)

    db.execute(
        f"""
        {_ASSIGNMENT_SELECT}
        WHERE ca.returned_at IS NULL {clause}
        ORDER BY ca.due_back_at ASC NULLS LAST, ca.checked_out_at DESC;
        """,
        tuple(params),
    )
    return [_costume_assignment_row(row) for row in db.fetchall()]


def find_conflicting_checkouts(db, item_id: int, event_id: int | None):
    """Open checkouts of this item that clash with the target event.

    Two cases count as a clash:

      * the item is out against an event whose date range overlaps the target
        event's, using the standard half-open overlap test (a.start < b.end AND
        a.end > b.start)
      * the item is simply still out and not tied to any event, so nobody knows
        when it is coming back

    Called with the item row locked FOR UPDATE by the caller, so two admins
    checking the same item out at once cannot both pass the check.
    """
    if event_id is None:
        db.execute(
            f"""
            {_ASSIGNMENT_SELECT}
            WHERE ca.item_id = %s AND ca.returned_at IS NULL;
            """,
            (item_id,),
        )
        return [_costume_assignment_row(row) for row in db.fetchall()]

    db.execute(
        f"""
        {_ASSIGNMENT_SELECT}
        WHERE ca.item_id = %s
          AND ca.returned_at IS NULL
          AND (
              ca.event_id IS NULL
              OR ca.event_id = %s
              OR EXISTS (
                  SELECT 1
                  FROM events target
                  WHERE target.id = %s
                    AND e.start_date < target.end_date
                    AND e.end_date > target.start_date
              )
          );
        """,
        (item_id, event_id, event_id),
    )
    return [_costume_assignment_row(row) for row in db.fetchall()]


def lock_costume_item(db, item_id: int):
    """Row lock so the overlap check and the insert that follows it are atomic
    against a second admin doing the same thing."""
    db.execute(
        "SELECT id, quantity, condition FROM costume_items WHERE id = %s FOR UPDATE;",
        (item_id,),
    )
    row = db.fetchone()
    if row is None:
        return None
    return {"id": row[0], "quantity": row[1], "condition": row[2]}
