"""
Saker Energy - Anomaly Detection Service
Polls TimescaleDB for telemetry, applies threshold + EWMA rules, writes alarms.
"""
import json
import time
import logging
import numpy as np
import psycopg2
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s [detector] %(message)s")
log = logging.getLogger(__name__)

DB_CONFIG = {
    "host": "localhost",
    "port": 55432,
    "user": "saker",
    "password": "saker_dev_password",
    "dbname": "saker",
}

# Detection rules: (device_type, point, rule_type, threshold, severity, alarm_code)
RULES = [
    # Charger rules (F01-F06)
    ("charger", "module_temp", "upper", 70.0, 3, "F01_MODULE_OVERTEMP"),
    ("charger", "fan_rpm", "lower", 100.0, 2, "F02_FAN_FEEDBACK_FAIL"),
    ("charger", "power_kw", "lower", 5.0, 2, "F03_CHARGE_ABORT"),
    ("charger", "connector_temp", "upper", 75.0, 3, "F05_CONNECTOR_OVERTEMP"),
    ("charger", "quality", "bad", 1.0, 2, "F04_COMM_OFFLINE"),
    # Battery rules (F07-F09)
    ("battery", "temp_spread", "upper", 8.0, 3, "F07_CELL_TEMP_SPREAD"),
    ("battery", "volt_spread", "upper", 0.3, 2, "F08_CELL_VOLT_SPREAD"),
    # PCS rule (F10)
    ("pcs", "temperature", "upper", 60.0, 3, "F10_PCS_ALARM"),
    # Meter / grid rules (F11-F12)
    ("meter", "bus_voltage", "lower", 380.0, 3, "F11_GRID_UNDERVOLTAGE"),
    ("meter", "bus_voltage", "upper", 420.0, 2, "F11_GRID_OVERVOLTAGE"),
]

# EWMA alpha for trend detection
EWMA_ALPHA = 0.3
# How many consecutive ticks above threshold to trigger alarm
CONSECUTIVE_LIMIT = 3

# Track recent readings per device+point for EWMA and consecutive counting
recent_state = {}


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def fetch_recent_telemetry(conn, minutes=2):
    """Fetch telemetry from the last N minutes."""
    cur = conn.cursor()
    cur.execute("""
        SELECT t.device_id, t.point, t.value, t.time, d.device_type
        FROM telemetry t
        JOIN devices d ON t.device_id = d.device_id
        WHERE time > NOW() - INTERVAL '%s minutes'
        ORDER BY time ASC
    """, (minutes,))
    rows = cur.fetchall()
    cur.close()
    return rows


def check_threshold(device_id, point, value, device_type):
    """Check threshold rules. Returns alarm dict or None."""
    for dt, pt, rule_type, threshold, severity, code in RULES:
        if dt == device_type and pt == point:
            if rule_type == "upper" and value > threshold:
                return {"device_id": device_id, "alarm_code": code, "severity": severity,
                        "message": f"{point}={value:.1f} exceeds upper threshold {threshold}"}
            if rule_type == "lower" and value < threshold:
                return {"device_id": device_id, "alarm_code": code, "severity": severity,
                        "message": f"{point}={value:.1f} below lower threshold {threshold}"}
    return None


def check_ewma_trend(device_id, point, value):
    """EWMA trend detection: if current value is significantly above EWMA baseline."""
    key = f"{device_id}:{point}"
    if key not in recent_state:
        recent_state[key] = {"ewma": value, "consecutive": 0, "baseline_count": 0}
        return None

    state = recent_state[key]
    prev_ewma = state["ewma"]
    new_ewma = EWMA_ALPHA * value + (1 - EWMA_ALPHA) * prev_ewma
    state["ewma"] = new_ewma

    # Need enough baseline samples before triggering
    state["baseline_count"] += 1
    if state["baseline_count"] < 10:
        return None

    # Trigger if value is > 30% above EWMA (trend rising)
    if prev_ewma > 0 and value > prev_ewma * 1.3:
        state["consecutive"] += 1
        if state["consecutive"] >= CONSECUTIVE_LIMIT:
            state["consecutive"] = 0
            return {"device_id": device_id, "alarm_code": f"TREND_{point.upper()}",
                    "severity": 2, "message": f"{point} trend rising: value={value:.1f}, ewma={prev_ewma:.1f}"}
    else:
        state["consecutive"] = 0

    return None


def insert_alarm(conn, alarm):
    """Insert alarm if not duplicate (same device+code within 60s)."""
    cur = conn.cursor()
    cur.execute("""
        SELECT alarm_id FROM alarms
        WHERE device_id = %s AND alarm_code = %s AND observed_at > NOW() - INTERVAL '60 seconds'
    """, (alarm["device_id"], alarm["alarm_code"]))
    if cur.fetchone():
        cur.close()
        return False

    cur.execute("""
        INSERT INTO alarms (device_id, alarm_code, severity, observed_at, message, raw_ref)
        VALUES (%s, %s, %s, NOW(), %s, %s)
    """, (alarm["device_id"], alarm["alarm_code"], alarm["severity"],
          alarm["message"], f"detector:{int(time.time())}"))
    conn.commit()
    cur.close()
    log.info(f"ALARM: {alarm['device_id']} | {alarm['alarm_code']} | {alarm['message']}")
    return True


def run_detection_cycle():
    conn = get_conn()
    try:
        rows = fetch_recent_telemetry(conn, minutes=2)
        alarms_found = 0
        for device_id, point, value, ts, device_type in rows:
            # Threshold check
            alarm = check_threshold(device_id, point, value, device_type)
            if alarm:
                if insert_alarm(conn, alarm):
                    alarms_found += 1

            # EWMA trend check (only on key points)
            if point in ("module_temp", "temp_spread", "bus_voltage", "fan_rpm"):
                alarm = check_ewma_trend(device_id, point, value)
                if alarm:
                    if insert_alarm(conn, alarm):
                        alarms_found += 1

        if alarms_found == 0:
            log.debug(f"Cycle OK, no alarms from {len(rows)} readings")
    finally:
        conn.close()


def main():
    log.info("Detection service starting...")
    # Wait for some data to accumulate
    time.sleep(5)
    while True:
        try:
            run_detection_cycle()
        except Exception as e:
            log.error(f"Detection cycle error: {e}")
        time.sleep(5)


if __name__ == "__main__":
    main()
