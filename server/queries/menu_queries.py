"""Menu catalog and per-event menus.

Two tables on purpose: menu_items is the reusable catalog so the same latte does
not get retyped for every event, and event_menu_items is the selection actually
being served, with the prep assignment and an optional one-off price.
"""

_UPDATABLE_ITEM_COLUMNS = {
    "name",
    "category",
    "description",
    "price",
    "allergens",
    "dietary",
    "active",
    "notes",
}

_UPDATABLE_EVENT_ITEM_COLUMNS = {
    "assigned_to",
    "quantity_planned",
    "price_override",
    "notes",
}

# Whitelist for ORDER BY so the sort parameter never reaches SQL directly.
_SORT_COLUMNS = {
    "name": "m.name ASC",
    "category": "m.category ASC, m.name ASC",
    "price": "m.price ASC NULLS LAST, m.name ASC",
    "created_at": "m.created_at DESC",
}

# Category ordering for a printed menu: food, then drinks, then dessert.
_MENU_ORDER = """
    CASE m.category
        WHEN 'food' THEN 0
        WHEN 'drink' THEN 1
        WHEN 'dessert' THEN 2
        WHEN 'special' THEN 3
        ELSE 4
    END,
    m.name
"""


def _iso(value):
    return value.isoformat() if value else None


def _money(value):
    """NUMERIC comes back as Decimal, which is not JSON-serialisable."""
    return float(value) if value is not None else None


def _item_row(row):
    return {
        "id": row[0],
        "name": row[1],
        "category": row[2],
        "description": row[3],
        "price": _money(row[4]),
        "allergens": row[5],
        "dietary": row[6],
        "active": row[7],
        "notes": row[8],
        "created_at": _iso(row[9]),
        "event_count": row[10],
    }


_ITEM_SELECT = """
    SELECT
        m.id,
        m.name,
        m.category,
        m.description,
        m.price,
        m.allergens,
        m.dietary,
        m.active,
        m.notes,
        m.created_at,
        (SELECT COUNT(*) FROM event_menu_items emi WHERE emi.menu_item_id = m.id)
    FROM menu_items m
"""


def create_menu_item(db, item):
    db.execute(
        """
        INSERT INTO menu_items
            (name, category, description, price, allergens, dietary, active, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            item.name,
            item.category,
            item.description,
            item.price,
            item.allergens,
            item.dietary,
            item.active,
            item.notes,
        ),
    )
    return db.fetchone()[0]


def _menu_filters(category=None, active=None, search=None, dietary=None):
    clause = ""
    params: list = []

    if category:
        clause += " AND m.category = %s"
        params.append(category)

    if active is not None:
        clause += " AND m.active = %s"
        params.append(active)

    if dietary:
        clause += " AND m.dietary ILIKE %s"
        params.append(f"%{dietary}%")

    if search:
        clause += """
            AND (
                m.name ILIKE %s
                OR m.description ILIKE %s
                OR m.allergens ILIKE %s
            )
        """
        like = f"%{search}%"
        params.extend([like] * 3)

    return clause, params


def get_menu_items(
    db,
    limit: int = 100,
    offset: int = 0,
    category: str | None = None,
    active: bool | None = None,
    search: str | None = None,
    dietary: str | None = None,
    sort: str = "category",
):
    clause, params = _menu_filters(category, active, search, dietary)
    order_by = _SORT_COLUMNS.get(sort, _SORT_COLUMNS["category"])

    db.execute(
        f"""
        {_ITEM_SELECT}
        WHERE 1=1 {clause}
        ORDER BY {order_by}, m.id ASC
        LIMIT %s OFFSET %s;
        """,
        tuple(params + [limit, offset]),
    )
    return [_item_row(row) for row in db.fetchall()]


def count_menu_items(
    db,
    category: str | None = None,
    active: bool | None = None,
    search: str | None = None,
    dietary: str | None = None,
):
    clause, params = _menu_filters(category, active, search, dietary)
    db.execute(
        f"SELECT COUNT(*) FROM menu_items m WHERE 1=1 {clause};",
        tuple(params),
    )
    return db.fetchone()[0]


def get_menu_item_by_id(db, item_id: int):
    db.execute(
        f"""
        {_ITEM_SELECT}
        WHERE m.id = %s;
        """,
        (item_id,),
    )
    row = db.fetchone()
    return _item_row(row) if row else None


def update_menu_item(db, item_id: int, item):
    """Partial update driven by exclude_unset, so an explicit null clears a
    nullable column (that is how a price is removed)."""
    payload = item.model_dump(exclude_unset=True)

    fields = []
    values = []
    for column, value in payload.items():
        if column not in _UPDATABLE_ITEM_COLUMNS:
            continue
        fields.append(f"{column} = %s")
        values.append(value)

    if not fields:
        return None

    db.execute(
        f"""
        UPDATE menu_items
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
        """,
        tuple(values + [item_id]),
    )
    row = db.fetchone()
    return row[0] if row else None


def delete_menu_item(db, item_id: int):
    """Deleting a catalog item cascades to every event menu it appears on, so
    the route checks event_count first and requires force."""
    db.execute(
        """
        DELETE FROM menu_items
        WHERE id = %s
        RETURNING id;
        """,
        (item_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def get_menu_stats(db):
    db.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE active) AS active,
            COUNT(*) FILTER (WHERE category = 'food') AS food,
            COUNT(*) FILTER (WHERE category = 'drink') AS drink,
            COUNT(*) FILTER (WHERE category = 'dessert') AS dessert,
            COUNT(*) FILTER (WHERE allergens IS NOT NULL AND allergens <> '')
                AS with_allergens
        FROM menu_items;
        """
    )
    row = db.fetchone()
    return {
        "total": row[0],
        "active": row[1],
        "food": row[2],
        "drink": row[3],
        "dessert": row[4],
        "with_allergens": row[5],
    }


# ── Per-event menus ──────────────────────────────────────────────────────────


_EVENT_ITEM_SELECT = """
    SELECT
        emi.id,
        emi.event_id,
        emi.menu_item_id,
        emi.assigned_to,
        emi.quantity_planned,
        emi.price_override,
        emi.notes,
        m.name,
        m.category,
        m.description,
        m.price,
        m.allergens,
        m.dietary,
        u.first_name,
        u.last_name,
        u.username
    FROM event_menu_items emi
    JOIN menu_items m ON m.id = emi.menu_item_id
    LEFT JOIN users u ON u.id = emi.assigned_to
"""


def _event_item_row(row):
    cook = None
    if row[3] is not None and row[13] is not None:
        cook = {
            "id": row[3],
            "first_name": row[13],
            "last_name": row[14],
            "username": row[15],
        }

    catalog_price = _money(row[10])
    override = _money(row[5])

    return {
        "id": row[0],
        "event_id": row[1],
        "menu_item_id": row[2],
        "assigned_to": row[3],
        "quantity_planned": row[4],
        "price_override": override,
        "notes": row[6],
        "name": row[7],
        "category": row[8],
        "description": row[9],
        "catalog_price": catalog_price,
        # What the guest actually pays, so the client never has to re-apply the
        # override rule and get it wrong in one place.
        "price": override if override is not None else catalog_price,
        "allergens": row[11],
        "dietary": row[12],
        "assignee": cook,
    }


def add_event_menu_item(db, event_id: int, entry):
    """Returns None when the item is already on this event's menu, so the route
    can answer 409 rather than surfacing a UniqueViolation as a 500."""
    db.execute(
        """
        INSERT INTO event_menu_items
            (event_id, menu_item_id, assigned_to, quantity_planned,
             price_override, notes)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (event_id, menu_item_id) DO NOTHING
        RETURNING id;
        """,
        (
            event_id,
            entry.menu_item_id,
            entry.assigned_to,
            entry.quantity_planned,
            entry.price_override,
            entry.notes,
        ),
    )
    row = db.fetchone()
    return row[0] if row else None


def get_event_menu(db, event_id: int):
    db.execute(
        f"""
        {_EVENT_ITEM_SELECT}
        WHERE emi.event_id = %s
        ORDER BY {_MENU_ORDER};
        """,
        (event_id,),
    )
    return [_event_item_row(row) for row in db.fetchall()]


def get_event_menu_item_by_id(db, entry_id: int):
    db.execute(
        f"""
        {_EVENT_ITEM_SELECT}
        WHERE emi.id = %s;
        """,
        (entry_id,),
    )
    row = db.fetchone()
    return _event_item_row(row) if row else None


def update_event_menu_item(db, entry_id: int, entry):
    """Partial update. An explicit null on price_override drops back to the
    catalog price; a null assigned_to un-assigns the prep."""
    payload = entry.model_dump(exclude_unset=True)

    fields = []
    values = []
    for column, value in payload.items():
        if column not in _UPDATABLE_EVENT_ITEM_COLUMNS:
            continue
        fields.append(f"{column} = %s")
        values.append(value)

    if not fields:
        return None

    db.execute(
        f"""
        UPDATE event_menu_items
        SET {", ".join(fields)}
        WHERE id = %s
        RETURNING id;
        """,
        tuple(values + [entry_id]),
    )
    row = db.fetchone()
    return row[0] if row else None


def remove_event_menu_item(db, entry_id: int):
    db.execute(
        """
        DELETE FROM event_menu_items
        WHERE id = %s
        RETURNING id;
        """,
        (entry_id,),
    )
    row = db.fetchone()
    return row[0] if row else None


def get_event_menu_summary(db, event_id: int):
    """Header numbers for one event's menu, including how much of the prep is
    still nobody's job."""
    db.execute(
        """
        SELECT
            COUNT(*) AS items,
            COUNT(*) FILTER (WHERE emi.assigned_to IS NULL) AS unassigned,
            COUNT(*) FILTER (
                WHERE m.allergens IS NOT NULL AND m.allergens <> ''
            ) AS with_allergens,
            COALESCE(SUM(
                COALESCE(emi.price_override, m.price, 0) *
                COALESCE(emi.quantity_planned, 0)
            ), 0) AS projected_revenue
        FROM event_menu_items emi
        JOIN menu_items m ON m.id = emi.menu_item_id
        WHERE emi.event_id = %s;
        """,
        (event_id,),
    )
    row = db.fetchone()
    return {
        "items": row[0],
        "unassigned": row[1],
        "with_allergens": row[2],
        "projected_revenue": _money(row[3]),
    }


def get_menu_item_events(db, item_id: int, limit: int = 50):
    """Which events a catalog item has appeared on, newest first. This is the
    reuse view, and what the delete guard's "on N event menus" refers to."""
    db.execute(
        """
        SELECT
            e.id,
            e.title,
            e.start_date,
            e.end_date,
            e.status,
            emi.id,
            emi.quantity_planned,
            emi.price_override
        FROM event_menu_items emi
        JOIN events e ON e.id = emi.event_id
        WHERE emi.menu_item_id = %s
        ORDER BY e.start_date DESC
        LIMIT %s;
        """,
        (item_id, limit),
    )

    return [
        {
            "event_id": row[0],
            "title": row[1],
            "start_datetime": _iso(row[2]),
            "end_datetime": _iso(row[3]),
            "status": row[4],
            "entry_id": row[5],
            "quantity_planned": row[6],
            "price_override": _money(row[7]),
        }
        for row in db.fetchall()
    ]
