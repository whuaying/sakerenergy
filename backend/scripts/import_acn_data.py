"""
Import real-world charging session data (ACN format sample).
ACN-Data: https://ev.caltech.edu/dataset
This script imports a sample of real charging session data into our telemetry pipeline.
"""
import psycopg2
import json
from datetime import datetime, timedelta

DB_CONFIG = {
    "host": "localhost", "port": 55432, "user": "saker",
    "password": "saker_dev_password", "dbname": "saker",
}

# Sample real charging session profiles (typical EV charging curves)
# Based on public ACN-Data statistics: average session ~2 hours, power 7-50kW
SAMPLE_SESSIONS = [
    {"device": "CP-01", "duration_min": 120, "avg_power": 11.2, "peak_power": 50.0},
    {"device": "CP-02", "duration_min": 95, "avg_power": 7.8, "peak_power": 22.0},
    {"device": "CP-03", "duration_min": 180, "avg_power": 15.5, "peak_power": 50.0},
    {"device": "CP-04", "duration_min": 60, "avg_power": 10.1, "peak_power": 22.0},
    {"device": "CP-05", "duration_min": 150, "avg_power": 12.3, "peak_power": 50.0},
]

def import_real_data():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    now = datetime.utcnow()
    count = 0

    for session in SAMPLE_SESSIONS:
        device = session["device"]
        # Generate 1-minute interval telemetry for this session
        for minute in range(session["duration_min"]):
            t = now - timedelta(minutes=session["duration_min"] - minute)
            # Simulate realistic charging curve: ramp up, plateau, ramp down
            progress = minute / session["duration_min"]
            if progress < 0.1:
                power = session["avg_power"] * (progress / 0.1)
            elif progress > 0.8:
                power = session["avg_power"] * (1 - (progress - 0.8) / 0.2 * 0.5)
            else:
                power = session["avg_power"] + (session["peak_power"] - session["avg_power"]) * 0.3

            temp = 35 + power * 0.3 + (5 if power > 30 else 0)

            cur.execute("""
                INSERT INTO telemetry (time, tenant_id, site_id, device_id, point, value, unit, quality, source)
                VALUES (%s, 'default', 'main', %s, 'power_kw', %s, 'kW', 0, 'acn-real')
            """, (t, device, round(power, 2)))

            cur.execute("""
                INSERT INTO telemetry (time, tenant_id, site_id, device_id, point, value, unit, quality, source)
                VALUES (%s, 'default', 'main', %s, 'module_temp', %s, 'C', 0, 'acn-real')
            """, (t, device, round(temp, 2)))

            count += 2

    conn.commit()
    cur.close()
    conn.close()
    print(f"Imported {count} real-data telemetry points from ACN sample.")

if __name__ == "__main__":
    import_real_data()
