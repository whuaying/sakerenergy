"""
Saker Energy - FaultBench Evaluation Script
Runs A/B/C/D comparison across 12 fault classes.
"""
import json
import time
import subprocess
import psycopg2

DB_CONFIG = {
    "host": "localhost", "port": 55432, "user": "saker",
    "password": "saker_dev_password", "dbname": "saker",
}

ALL_FAULTS = [
    "F01_module_over_temperature",
    "F02_fan_feedback_failure",
    "F03_unexpected_charge_abort",
    "F04_communication_offline",
    "F05_connector_over_temp",
    "F06_power_derating",
    "F07_cell_temperature_spread",
    "F08_cell_voltage_spread",
    "F09_bms_sampling_anomaly",
    "F10_pcs_alarm",
    "F11_grid_voltage_disturb",
    "F12_sensor_corruption",
]

def reset_db():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    for table in ["diagnoses", "work_orders", "alarms", "events", "telemetry"]:
        cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
    conn.commit()
    cur.close()
    conn.close()
    print("Database reset.")

def run_fault_test(fault_code, duration_sec=60):
    """Run simulator with a specific fault and collect results."""
    # Kill old sim
    subprocess.run(["taskkill", "/f", "/im", "sim.exe"], capture_output=True)
    time.sleep(2)

    # Start sim with fault
    sim_proc = subprocess.Popen([
        r"E:\saker-energy-main\backend\sim\sim.exe",
        "--nats", "nats://localhost:4222",
        "--seed", "42",
        "--interval", "3",
        "--duration", str(duration_sec),
        "--fault", fault_code,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Wait for sim to finish
    sim_proc.wait()
    time.sleep(10)  # let detector/aggregator/agent process

    # Collect results
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Check if alarm was generated for this fault
    cur.execute("""
        SELECT alarm_code, COUNT(*) FROM alarms
        WHERE alarm_code LIKE %s
        GROUP BY alarm_code
    """, (f"{fault_code[:3]}%",))
    alarms = cur.fetchall()

    # Check if event was created
    cur.execute("""
        SELECT event_id, event_type, status FROM events
        WHERE event_type LIKE %s
    """, (f"{fault_code[:3]}%",))
    events = cur.fetchall()

    # Check if diagnosis was created
    cur.execute("""
        SELECT d.diagnosis_id, d.hypotheses FROM diagnoses d
        JOIN events e ON d.event_id = e.event_id
        WHERE e.event_type LIKE %s
    """, (f"{fault_code[:3]}%",))
    diagnoses = cur.fetchall()

    cur.close()
    conn.close()

    detected = len(alarms) > 0
    correlated = len(events) > 0
    diagnosed = len(diagnoses) > 0
    top1_correct = False
    if diagnoses:
        hyps = json.loads(diagnoses[0][1])
        if hyps and fault_code.replace("_", " ")[:4] in hyps[0]["cause"]:
            top1_correct = True

    return {
        "fault": fault_code,
        "detected": detected,
        "correlated": correlated,
        "diagnosed": diagnosed,
        "top1_correct": top1_correct,
        "alarm_codes": [a[0] for a in alarms],
        "event_types": [e[1] for e in events],
    }

def main():
    print("=" * 60)
    print("Saker Energy FaultBench Evaluation")
    print("=" * 60)

    reset_db()

    # Wait for background services to be ready
    print("Waiting 15s for services to warm up...")
    time.sleep(15)

    results = []
    for fault in ALL_FAULTS:
        print(f"\n--- Testing: {fault} ---")
        r = run_fault_test(fault, duration_sec=60)
        results.append(r)
        print(f"  detected={r['detected']} correlated={r['correlated']} diagnosed={r['diagnosed']}")

    # Summary
    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    n = len(results)
    det = sum(1 for r in results if r["detected"])
    corr = sum(1 for r in results if r["correlated"])
    diag = sum(1 for r in results if r["diagnosed"])
    top1 = sum(1 for r in results if r["top1_correct"])

    print(f"Total fault classes: {n}")
    print(f"Detection (alarm generated): {det}/{n} = {det/n*100:.1f}%")
    print(f"Correlation (event created): {corr}/{n} = {corr/n*100:.1f}%")
    print(f"Diagnosis (root cause proposed): {diag}/{n} = {diag/n*100:.1f}%")
    print(f"Top-1 accuracy: {top1}/{n} = {top1/n*100:.1f}%")

    print("\nPer-fault results:")
    for r in results:
        status = "OK" if r["diagnosed"] else "FAIL"
        print(f"  [{status}] {r['fault']}: alarms={r['alarm_codes']}")

    # Save results
    with open("eval_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("\nResults saved to eval_results.json")

if __name__ == "__main__":
    main()
