"""
Saker Energy - ML-based Anomaly Detector
Isolation Forest trained on normal telemetry, scores new data points.
Runs in parallel with rule-based detector.
"""
import json
import time
import logging
import psycopg2
import numpy as np
from sklearn.ensemble import IsolationForest

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ml-detector] %(message)s")
log = logging.getLogger(__name__)

DB_CONFIG = {
    "host": "localhost", "port": 55432, "user": "saker",
    "password": "saker_dev_password", "dbname": "saker",
}

# Points we use as features for the model
FEATURE_POINTS = ["power_kw", "module_temp", "fan_rpm", "connector_temp",
                  "soc", "temp_spread", "volt_spread", "temperature", "bus_voltage"]

model = None
device_models = {}  # per-device models


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def fetch_normal_data():
    """Fetch recent telemetry as training features."""
    conn = get_conn()
    cur = conn.cursor()
    # Pivot: get latest values per device per point
    cur.execute("""
        SELECT DISTINCT ON (device_id, point) device_id, point, value
        FROM telemetry
        WHERE time > NOW() - INTERVAL '30 minutes'
        ORDER BY device_id, point, time DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Organize into feature vectors per timestamp bucket
    # Simplified: aggregate by device
    device_data = {}
    for dev, point, val in rows:
        if dev not in device_data:
            device_data[dev] = {}
        device_data[dev][point] = val

    return device_data


def train_models():
    """Train Isolation Forest per device type on normal data."""
    global device_models
    log.info("Training Isolation Forest on normal telemetry...")

    device_data = fetch_normal_data()
    if len(device_data) < 3:
        log.warning("Not enough data to train, will retry...")
        return False

    # Build feature matrix: sample N recent windows
    conn = get_conn()
    cur = conn.cursor()

    # Get all telemetry in last 10 minutes, windowed
    cur.execute("""
        SELECT device_id, point, value,
               EXTRACT(EPOCH FROM time)::int / 30 as bucket
        FROM telemetry
        WHERE time > NOW() - INTERVAL '10 minutes'
        ORDER BY time
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Group by device+bucket, build feature vectors
    from collections import defaultdict
    buckets = defaultdict(dict)
    for dev, point, val, bucket in rows:
        buckets[(dev, bucket)][point] = val

    # Build feature matrix
    X = []
    for (dev, bucket), feats in buckets.items():
        vec = [feats.get(p, 0) for p in FEATURE_POINTS]
        if any(v != 0 for v in vec):
            X.append(vec)

    if len(X) < 20:
        log.warning(f"Only {len(X)} training samples, need >=20")
        return False

    X = np.array(X)
    # Train one global model (simplified)
    model = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
    model.fit(X)
    log.info(f"Model trained on {len(X)} samples, {X.shape[1]} features")
    return True


def score_latest():
    """Score latest telemetry points, emit ML anomalies."""
    global model
    if model is None:
        return

    conn = get_conn()
    cur = conn.cursor()

    # Get latest reading per device per point
    cur.execute("""
        SELECT DISTINCT ON (device_id, point) device_id, point, value, time
        FROM telemetry
        ORDER BY device_id, point, time DESC
    """)
    rows = cur.fetchall()

    # Build feature vectors per device
    from collections import defaultdict
    latest = defaultdict(dict)
    for dev, point, val, t in rows:
        latest[dev][point] = val

    anomalies = []
    for dev, feats in latest.items():
        vec = np.array([[feats.get(p, 0) for p in FEATURE_POINTS]])
        score = model.decision_function(vec)[0]
        # Negative score = more anomalous
        if score < -0.1:  # threshold
            anomalies.append((dev, score, feats))
            log.warning(f"ML ANOMALY: {dev} score={score:.3f} features={ {k: round(v,1) for k,v in feats.items()} }")

            # Insert into alarms table
            cur.execute("""
                INSERT INTO alarms (device_id, alarm_code, severity, message, rule_version)
                VALUES (%s, %s, %s, %s, %s)
            """, (dev, "ML_ANOMALY", 2,
                  f"IsolationForest异常分数={score:.3f}", "isolation-forest-v1"))

    conn.commit()
    cur.close()
    conn.close()
    return len(anomalies)


def main():
    log.info("ML Detector starting...")
    time.sleep(15)  # wait for data

    # Initial training
    while not train_models():
        time.sleep(10)

    # Continuous scoring loop
    while True:
        try:
            n = score_latest()
            if n:
                log.info(f"Scored cycle: {n} ML anomalies detected")
            # Retrain every 5 minutes
            time.sleep(30)
        except Exception as e:
            log.error(f"ML detector error: {e}")
            time.sleep(10)


if __name__ == "__main__":
    main()
