
def get_links_by_category(db,category):
    db.execute(
        """SELECT id, link_url, title FROM links WHERE category = %s""", (category,)
    )
    data = db.fetchall()
    return [{"id": row[0], "link_url": row[1], "title": row[2]} for row in data]
