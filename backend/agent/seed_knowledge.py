"""Seed knowledge base with fault tree, manuals, and checklists."""
import psycopg2

DB_CONFIG = {
    "host": "localhost", "port": 55432, "user": "saker",
    "password": "saker_dev_password", "dbname": "saker",
}

KNOWLEDGE = [
    # Fault tree entries
    ("fault_tree", "F01 充电桩模块过温故障树",
     "故障现象：充电模块温度超过70°C且持续上升。可能原因：1)散热风扇故障（转速下降或停转）；2)风道/滤网堵塞导致散热效率降低；3)充电模块过负载运行；4)温度传感器测量偏差。检查顺序：先查风扇转速→再查风道→再核对功率曲线→最后用校准表复核温度。",
     "v1.0", "fault_catalog.csv F01"),
    ("fault_tree", "F02 风扇反馈故障",
     "故障现象：风扇RPM反馈为0或远低于正常值。可能原因：1)风扇供电线断开或松动；2)风扇转速反馈传感器故障；3)风扇本身轴承卡死。注意：RPM=0但模块温度未上升时，优先怀疑反馈传感器而非风扇真的停转。",
     "v1.0", "fault_catalog.csv F02"),
    ("fault_tree", "F03 意外充电中止",
     "故障现象：充电过程中功率突然归零。可能原因：1)车辆BMS发出停止充电指令（电池充满/故障/温度保护）；2)充电桩内部控制板触发保护；3)通信中断导致充电流程异常终止。检查：读取结束原因码，区分车辆侧还是桩侧。",
     "v1.0", "fault_catalog.csv F03"),
    ("fault_tree", "F04 通信离线",
     "故障现象：设备数据质量标记为bad，遥测中断。可能原因：1)网关到交换机网络链路故障；2)设备通信模块死机；3)电源故障导致设备离线。排查：检查其他设备是否在线→检查网络端口→现场确认电源指示灯。",
     "v1.0", "fault_catalog.csv F04"),
    ("fault_tree", "F05 充电枪连接器过温",
     "故障现象：连接器温度超过75°C。可能原因：1)枪头触点接触电阻过大（磨损/烧蚀）；2)连接器未完全插紧；3)线缆破损。注意：连接器过温有起火风险，需立即降功率并现场检查。",
     "v1.0", "fault_catalog.csv F05"),
    ("fault_tree", "F06 功率降额",
     "故障现象：多台充电桩同步降低输出功率。可能原因：1)温度保护触发自动降额；2)调度系统下发限功率指令；3)母线电压异常导致功率限制。区分关键：单台降额多为温度问题，多台同步降额多为调度或电网问题。",
     "v1.0", "fault_catalog.csv F06"),
    ("fault_tree", "F07 储能电芯温差过大",
     "故障现象：模组间温差超过8°C。可能原因：1)局部冷却管路堵塞或冷板不均；2)BMS温度测点接触不良；3)个别电芯老化导致发热差异。排查顺序：查冷却系统→复核测点→对比历史SOH数据。",
     "v1.0", "fault_catalog.csv F07"),
    ("fault_tree", "F08 电芯压差过大",
     "故障现象：模组间电压差超过0.3V。可能原因：1)电芯一致性差异（老化或制造分散）；2)电压采样线束接触电阻不一致；3)个别电芯内部短路前兆。注意：压差持续扩大需警惕热失控风险。",
     "v1.0", "fault_catalog.csv F08"),
    ("fault_tree", "F09 BMS采样异常",
     "故障现象：SOC/电压数据出现随机尖峰跳变，质量标记为bad。可能原因：1)BMS采集板硬件故障；2)电磁干扰导致通信数据错误；3)采样线屏蔽接地不良。排查：重启采集板→对比其他通道→检查EMC接地。",
     "v1.0", "fault_catalog.csv F09"),
    ("fault_tree", "F10 PCS温度告警",
     "故障现象：PCS温度超过60°C。可能原因：1)PCS散热风扇故障或滤网堵塞；2)储能柜环境温度过高（空调失效）；3)长时间满载运行。注意：PCS过热可能导致逆变器停机。",
     "v1.0", "fault_catalog.csv F10"),
    ("fault_tree", "F11 母线电压扰动",
     "故障现象：母线电压下降到380V以下，同时多台设备功率同步下降。可能原因：1)上游电网供电质量问题；2)计划调度限电；3)采集中间设备时间对齐异常。关键判断：电压+功率同步变化支持上游原因，单纯功率变化多为调度问题。",
     "v1.0", "fault_catalog.csv F11"),
    ("fault_tree", "F12 传感器数据损坏",
     "故障现象：电压/功率数据出现随机尖峰，但其他测点正常。可能原因：1)传感器采集干扰；2)通信链路数据包损坏；3)A/D转换器噪声。区分方法：用独立测量表复核实际值。",
     "v1.0", "fault_catalog.csv F12"),
    # Safety rules
    ("safety", "工业安全红线",
     "AI诊断系统严禁下发任何设备控制指令，包括但不限于：停机、合闸、分闸、复位、解锁、断电、送电、充放电使能、接触器闭合。所有控制动作必须由有资质人员按现场规程手动执行。安全保护由BMS/PCS/EMS和硬件联锁独立完成，AI系统不参与控制闭环。",
     "v1.0", "docs/05-SAFETY-SECURITY.md"),
    ("checklist", "充电桩现场检查清单",
     "1.检查充电模块外观有无烧蚀/异味；2.测量风扇供电电压是否正常；3.检查风道滤网是否堵塞；4.核对当前功率与额定功率；5.用红外测温仪复核模块温度；6.检查充电枪头触点有无烧蚀；7.确认急停按钮状态。",
     "v1.0", "现场作业规范"),
    ("checklist", "储能柜现场检查清单",
     "1.检查BMS显示的各模组温度/电压；2.检查冷却管路有无渗漏；3.测量环境温度；4.对比历史温差/压差趋势；5.检查采集线接插件是否牢固；6.确认消防系统状态；7.检查空调运行是否正常。",
     "v1.0", "现场作业规范"),
]

def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Clear existing
    cur.execute("DELETE FROM knowledge_base")

    for doc_type, title, content, version, source in KNOWLEDGE:
        cur.execute("""
            INSERT INTO knowledge_base (doc_type, title, content, version, source)
            VALUES (%s, %s, %s, %s, %s)
        """, (doc_type, title, content, version, source))

    conn.commit()
    cur.execute("SELECT COUNT(*) FROM knowledge_base")
    count = cur.fetchone()[0]
    print(f"Seeded {count} knowledge base entries.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
