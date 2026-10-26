# 03 FaultBench 数据工程与标签

## 数据来源标记
- R0：真实公开充电会话背景，如 ACN-Data（不等同真实故障标签）。
- R1：实验室电池退化数据，如 NASA Battery（不能直接验证场站热安全）。
- S0：正常场站仿真。
- S1：可控故障注入。
- F0：运营商脱敏现场标签，仅获得授权后使用。

## v0.1 规划目标（不是现有成果）
12类故障 × 50 场景 = 600 故障事件，200 个正常及困难负例。按场站拓扑/设备/事件组隔离训练、验证、测试；建议 60/20/20 比例，不得使相邻滑窗跨数据划分。

## 场景 Schema
scenario_id,seed,topology_version,simulation_version,data_origin,label_origin,root_cause,affected_devices,t_inject,earliest_observable_time,normal_context,prohibited_actions,expected_checks,checksum。

## 遥测测点
充电桩：会话功率、电压、电流、充电枪温度、模块温度、风扇状态、错误码、链路状态。
储能：单体/模组电压、最高最低温度及温差、SOC、PCS功率、告警。
场站：母线电压、电表功率、变压器负荷、环境温度、充电需求曲线。

## 故障标签与不可泄漏
评分系统独立持有 root_cause/注入原因，检出服务只能看到截至判断时间的观测序列。每条样本记录故障可观测起点；不以注入时刻冒充可检测起点。

## 数据质量与授权
单位校验、时间排序、缺测标志、异常极值、困难负例、许可证、来源及 checksum 全部纳入 manifest；客户资料不得送往未授权外部模型。危险储能风险单独评估。
