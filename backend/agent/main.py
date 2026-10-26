"""
Saker Energy - Diagnostic Agent
Analyzes correlated events and produces candidate root causes with evidence.
Rule-based fault tree covering all 12 fault classes.
"""
import json
import time
import logging
import psycopg2

logging.basicConfig(level=logging.INFO, format="%(asctime)s [agent] %(message)s")
log = logging.getLogger(__name__)

DB_CONFIG = {
    "host": "localhost", "port": 55432, "user": "saker",
    "password": "saker_dev_password", "dbname": "saker",
}

# 12-class fault tree: event_type -> candidate hypotheses
FAULT_TREE = {
    "F01_module_over_temperature": [
        {"cause": "散热链路故障（风扇或风道）", "support": "模块温度持续升高，风扇转速下降", "against": "需现场确认风扇本体还是供电问题", "next_check": "检查风扇供电、转速反馈、风道堵塞"},
        {"cause": "充电模块过负载", "support": "高功率工况下温度上升", "against": "相邻终端未同步温升", "next_check": "核对功率曲线与模块散热额定值"},
        {"cause": "温度传感器偏差", "support": "单点温度异常可能是测量问题", "against": "温度与风扇同步变化，解释力不足", "next_check": "用校准测温仪复核模块温度"},
    ],
    "F02_fan_feedback_failure": [
        {"cause": "风扇转速反馈传感器故障", "support": "风扇RPM读数为0但模块未过热", "against": "需确认风扇是否真的停转", "next_check": "现场检查风扇实际运转状态"},
        {"cause": "风扇供电线断开", "support": "反馈为0通常意味着无供电", "against": "可能是连接器松动而非断线", "next_check": "测量风扇供电电压，检查接插件"},
    ],
    "F03_unexpected_charge_abort": [
        {"cause": "车辆BMS握手异常", "support": "功率突然归零", "against": "需确认是车辆侧还是桩侧问题", "next_check": "查看充电结束原因码，检查CP/CC信号"},
        {"cause": "桩内部控制板故障", "support": "无预警中断充电", "against": "其他桩未受影响", "next_check": "读取桩控制器日志，检查故障码"},
    ],
    "F04_communication_offline": [
        {"cause": "网关或网络链路故障", "support": "设备离线，数据质量标记为坏", "against": "其他设备在线，排除网关整体问题", "next_check": "检查该设备网络连接、交换机端口"},
        {"cause": "设备通信模块死机", "support": "单设备离线但电源正常", "against": "需现场确认电源指示灯", "next_check": "现场重启设备通信模块"},
    ],
    "F05_connector_over_temp": [
        {"cause": "充电枪接触电阻过大", "support": "连接器温度升高", "against": "需确认是枪头还是线缆问题", "next_check": "检查枪头触点、线缆磨损情况"},
        {"cause": "连接器未完全插紧", "support": "接触不良导致发热", "against": "用户已确认插紧", "next_check": "检查锁止机构，重新插拔测试"},
    ],
    "F06_power_derating": [
        {"cause": "温度保护降额", "support": "BUS-B组充电桩功率下降", "against": "母线电压未变，排除电网问题", "next_check": "检查模块温度是否触发降额阈值"},
        {"cause": "调度限功率指令", "support": "多台设备同步降功率", "against": "需核对调度记录", "next_check": "联系调度确认是否有功率限制指令"},
    ],
    "F07_cell_temperature_spread": [
        {"cause": "局部冷却不均", "support": "模组温差持续扩大，SOC稳定", "against": "尚无冷却流量数据", "next_check": "检查冷却管路、冷板温度、泵运行"},
        {"cause": "测点偏移或接触不良", "support": "局部测点偏差表现为温差", "against": "需独立测量复核", "next_check": "核对BMS采集线、接插件、传感器精度"},
        {"cause": "个别电芯老化差异", "support": "不同模组老化差异导致温度分布不均", "against": "缺少历史容量数据", "next_check": "对比该簇与其他簇的内阻、容量历史"},
    ],
    "F08_cell_voltage_spread": [
        {"cause": "电芯一致性差异", "support": "模组间电压差扩大", "against": "需区分是老化还是制造差异", "next_check": "对比出厂数据和历史SOH记录"},
        {"cause": "采样线接触电阻不一致", "support": "采样回路问题可表现为压差", "against": "需测量验证", "next_check": "检查电压采样线束接插件"},
    ],
    "F09_bms_sampling_anomaly": [
        {"cause": "BMS采集板采样异常", "support": "SOC数据出现异常尖峰，质量标记为坏", "against": "可能是通信干扰而非硬件故障", "next_check": "重启BMS采集板，对比其他采样通道"},
        {"cause": "电磁干扰导致数据跳变", "support": "数据随机跳变", "against": "需排查EMC来源", "next_check": "检查屏蔽接地、动力线与信号线间距"},
    ],
    "F10_pcs_alarm": [
        {"cause": "PCS散热风扇故障", "support": "PCS温度持续升高", "against": "需确认是风扇还是环境温度高", "next_check": "检查PCS风扇运转、滤网堵塞"},
        {"cause": "环境温度过高", "support": "PCS温度随环境上升", "against": "其他设备温度正常", "next_check": "检查储能柜空调、通风情况"},
    ],
    "F11_grid_voltage_disturb": [
        {"cause": "上游供电质量问题", "support": "母线电压下降与多设备功率下降时间一致", "against": "需上游电能质量数据确认", "next_check": "关联上游变电站记录、核对电能质量监测"},
        {"cause": "计划调度或限功率", "support": "统一调度引起多设备同步功率变化", "against": "需解释电压变化", "next_check": "联系调度确认是否有计划限电"},
        {"cause": "采集链路时间对齐异常", "support": "共用采集链路制造看似同步的变化", "against": "需独立设备记录交叉核对", "next_check": "比对网关时间戳与设备本地时钟"},
    ],
    "F12_sensor_data_corruption": [
        {"cause": "传感器采集干扰", "support": "电压数据出现随机尖峰，质量标记为坏", "against": "需区分真实扰动还是采集干扰", "next_check": "用独立测量表复核母线电压"},
        {"cause": "通信链路数据损坏", "support": "数据偶发跳变", "against": "其他测点正常", "next_check": "检查网关数据校验、重传机制"},
    ],
    "generic_anomaly": [
        {"cause": "待进一步调查", "support": "已检测到异常但模式不明确", "against": "证据不足，暂不能锁定方向", "next_check": "扩大时间窗观察，对比相邻设备历史基线"},
    ],
}


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def find_unanalyzed_events(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT e.event_id, e.event_type, e.affected_devices
        FROM events e
        LEFT JOIN diagnoses d ON e.event_id = d.event_id
        WHERE e.status = 'OPEN' AND d.diagnosis_id IS NULL
        ORDER BY e.first_seen ASC LIMIT 10
    """)
    rows = cur.fetchall()
    cur.close()
    return rows


def get_event_alarms(conn, event_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT device_id, alarm_code, severity, message
        FROM alarms WHERE event_id = %s ORDER BY observed_at ASC
    """, (event_id,))
    rows = cur.fetchall()
    cur.close()
    return rows


def search_knowledge(conn, event_type, alarm_codes):
    """Keyword-based retrieval from knowledge_base table."""
    cur = conn.cursor()
    search_terms = list(set([event_type] + alarm_codes + event_type.split("_")))
    results = []
    for term in search_terms:
        if len(term) < 3:
            continue
        cur.execute("""
            SELECT title, content, version, source FROM knowledge_base
            WHERE title ILIKE %s OR content ILIKE %s
            LIMIT 3
        """, (f"%{term}%", f"%{term}%"))
        for row in cur.fetchall():
            entry = {"title": row[0], "source": row[3]}
            if entry not in results:
                results.append(entry)
    cur.close()
    return results[:3]


def diagnose_event(conn, event_id, event_type, devices):
    alarms = get_event_alarms(conn, event_id)
    hypotheses = FAULT_TREE.get(event_type, FAULT_TREE["generic_anomaly"])
    alarm_summary = [{"device": a[0], "code": a[1], "message": a[3]} for a in alarms]

    # RAG: retrieve relevant knowledge base entries
    alarm_codes = [a[1] for a in alarms]
    knowledge_refs = search_knowledge(conn, event_type, alarm_codes)
    # Attach knowledge version
    kb_version = knowledge_refs[0]["version"] if knowledge_refs else "none"

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO diagnoses (event_id, hypotheses, next_checks, abstain, model_version, knowledge_version)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING diagnosis_id
    """, (
        event_id,
        json.dumps({"hypotheses": hypotheses, "alarm_context": alarm_summary, "knowledge_refs": knowledge_refs}),
        json.dumps([h["next_check"] for h in hypotheses]),
        len(hypotheses) <= 1,
        "rule-based+rag-v1",
        kb_version,
    ))
    diag_id = cur.fetchone()[0]

    cur.execute("UPDATE events SET status='INVESTIGATING', updated_at=NOW() WHERE event_id=%s", (event_id,))
    conn.commit()
    cur.close()
    log.info(f"Diagnosis #{diag_id} for event #{event_id} ({event_type}): {len(hypotheses)} hypotheses, {len(knowledge_refs)} KB refs")


def main():
    log.info("Diagnostic agent starting...")
    time.sleep(10)
    while True:
        try:
            conn = get_conn()
            events = find_unanalyzed_events(conn)
            for event_id, event_type, devices_json in events:
                devices = json.loads(devices_json) if isinstance(devices_json, str) else devices_json
                diagnose_event(conn, event_id, event_type, devices)
            conn.close()
        except Exception as e:
            log.error(f"Agent error: {e}")
        time.sleep(8)


if __name__ == "__main__":
    main()
