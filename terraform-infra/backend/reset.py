import sqlite3
conn = sqlite3.connect("platform.db")
conn.execute("UPDATE requests SET status='pending'")
conn.commit()
for row in conn.execute("SELECT id, status, resource_name FROM requests").fetchall():
    print(row)
conn.close()
print("Reset done")
