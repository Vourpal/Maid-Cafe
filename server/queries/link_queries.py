#TODO: add pydantic models later
def get_links_by_category(db,category):
    db.execute(
        """SELECT id, link_url, title FROM links WHERE category = %s""", (category,)
    )
    data = db.fetchall()
    return [{"id": row[0], "link_url": row[1], "title": row[2]} for row in data]

def create_link(db, category, link_url, title):
    db.execute(
        """
        INSERT INTO links (category, link_url, title)
        VALUES (%s, %s, %s)
        RETURNING id, link_url, title
        """,
        (category, link_url, title),
    )
    new_link = db.fetchone()
    return {"id": new_link[0], "link_url": new_link[1], "title": new_link[2]}

def update_link(db, link_id, category, link_url, title):
    db.execute(
        """
        UPDATE links
        SET category = %s,
            link_url = %s,
            title = %s
        WHERE id = %s
        RETURNING id, link_url, title
        """,
        (category, link_url, title, link_id),
    )
    updated = db.fetchone()

    if not updated:
        return None

    return {"id": updated[0], "link_url": updated[1], "title": updated[2]}