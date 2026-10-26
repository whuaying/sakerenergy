"""
Saker Energy - Event Aggregator
Groups raw alarms into correlated events by topology and time window.
"""
import time
import json
import logging
import psycopg2
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [aggregator] %(message)s")
log = logging.getLogger(__name__)

DB_CONFIG = {
    "host": "localhost", "port": 55432, "user": "saker",
    "password": "saker_dev_password", "dbname": "saker",
}

TIME_WINDOW_SEC = 60  # alarms within this window are candidates for correlation


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def find_unassigned_alarms(conn):
    """Find alarms not yet linked to an event."""
    cur = conn.cursor()
    cur.execute("""
        SELECT alarm_id, device_id, alarm_code, severity, observed_at, message
        FROM alarms
        WHERE event_id IS NULL AND observed_at > NOW() - INTERVAL '10 minutes'
        ORDER BY observed_at ASC
    """)
    rows = cur.fetchall()
    cur.close()
    return rows


def get_device_topology(conn, device_ids):
    """Get topology group for a list of devices."""
    if not device_ids:
        return {}
    cur = conn.cursor()
    cur.execute("""
        SELECT device_id, topology_group, device_type FROM devices
        WHERE device_id = ANY(%s)
    """, (list(device_ids),))
    result = {r[0]: {"group": r[1], "type": r[2]} for r in cur.fetchall()}
    cur.close()
    return result


def correlate_and_create_events(conn):
    alarms = find_unassigned_alarms(conn)
    if not alarms:
        return

    log.info(f"Processing {len(alarms)} unassigned alarms")

    # Simple grouping: group alarms that share topology_group and are within time window
    # Group 1: same topology group
    device_ids = list(set(a[1] for a in alarms))
    topo = get_device_topology(conn, device_ids)

    # Build groups
    groups = {}
    for alarm in alarms:
        alarm_id, device_id, code, sev, ts, msg = alarm
        dev_info = topo.get(device_id, {"group": "UNKNOWN", "type": "unknown"})
        group_key = dev_info["group"]
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(alarm)

    cur = conn.cursor()

    for group_key, group_alarms in groups.items():
        # Skip groups with only 1 alarm unless severity >= 3 (critical single device)
        max_sev = max(a[3] for a in group_alarms)
        if len(group_alarms) == 1 and max_sev < 3:
            # Single low-severity alarm: still create a basic event for tracking
            pass

        # Determine event type from alarm codes
        codes = set(a[2] for a in group_alarms)
        event_type = classify_event_type(codes, group_key)

        affected = list(set(a[1] for a in group_alarms))
        first_seen = min(a[4] for a in group_alarms)
        last_seen = max(a[4] for a in group_alarms)

        # Create event
        cur.execute("""
            INSERT INTO events (site_id, event_type, first_seen, last_seen, affected_devices, status)
            VALUES ('main', %s, %s, %s, %s::jsonb, 'OPEN')
            RETURNING event_id
        """, (event_type, first_seen, last_seen, json.dumps(affected)))
        event_id = cur.fetchone()[0]

        # Link alarms to this event
        alarm_ids = [a[0] for a in group_alarms]
        cur.execute("""
            UPDATE alarms SET event_id = %s WHERE alarm_id = ANY(%s)
        """, (event_id, alarm_ids))

        conn.commit()
        log.info(f"Created event #{event_id}: type={event_type}, devices={affected}, alarms={len(alarm_ids)}")

    cur.close()


def classify_event_type(codes, topology_group):
    """Classify event based on alarm codes (12 fault classes)."""
    code_map = {
        "F01_MODULE_OVERTEMP": "F01_module_over_temperature",
        "F02_FAN_FEEDBACK_FAIL": "F02_fan_feedback_failure",
        "F03_CHARGE_ABORT": "F03_unexpected_charge_abort",
        "F04_COMM_OFFLINE": "F04_communication_offline",
        "F05_CONNECTOR_OVERTEMP": "F05_connector_over_temp",
        "F06_POWER_DERATING": "F06_power_derating",
        "F07_CELL_TEMP_SPREAD": "F07_cell_temperature_spread",
        "F08_CELL_VOLT_SPREAD": "F08_cell_voltage_spread",
        "F09_BMS_SAMPLING": "F09_bms_sampling_anomaly",
        "F10_PCS_ALARM": "F10_pcs_alarm",
        "F11_GRID_UNDERVOLTAGE": "F11_grid_voltage_disturb",
        "F11_GRID_OVERVOLTAGE": "F11_grid_voltage_disturb",
        "F12_SENSOR_CORRUPT": "F12_sensor_data_corruption",
    }
    for code in codes:
        if code in code_map:
            return code_map[code]
    return "generic_anomaly"


def main():
    log.info("Event aggregator starting...")
    time.sleep(8)  # wait for alarms to accumulate
    while True:
        try:
            correlate_and_create_events(conn := get_conn())
            conn.close()
        except Exception as e:
            log.error(f"Aggregator error: {e}")
        time.sleep(10)


if __name__ == "__main__":
    main()
