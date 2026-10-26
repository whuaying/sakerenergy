"""Single-run test for detector logic."""
import psycopg2

DB_CONFIG = {
    "host": "localhost", "port": 55432, "user": "saker",
    "password": "saker_dev_password", "dbname": "saker",
}

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

# Check recent telemetry
cur.execute("""
    SELECT t.device_id, t.point, t.value, d.device_type
    FROM telemetry t
    JOIN devices d ON t.device_id = d.device_id
    WHERE time > NOW() - INTERVAL '2 minutes'
    ORDER BY time DESC LIMIT 20
""")
rows = cur.fetchall()
print(f"Recent telemetry rows: {len(rows)}")
for r in rows[:10]:
    print(f"  {r[0]} | {r[1]} = {r[2]} | type={r[3]}")

# Check if CP-07 temp exceeds threshold
cur.execute("""
    SELECT device_id, point, value FROM telemetry
    WHERE device_id='CP-07' AND point='module_temp' AND value > 70
    ORDER BY time DESC LIMIT 5
""")
hot = cur.fetchall()
print(f"\nCP-07 readings > 70C: {len(hot)}")
for h in hot:
    print(f"  {h[0]} {h[1]} = {h[2]}")

# Check existing alarms
cur.execute("SELECT COUNT(*) FROM alarms")
print(f"\nTotal alarms in DB: {cur.fetchone()[0]}")

cur.close()
conn.close()
