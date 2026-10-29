# 2026-10-29 真实补证闭环：行业场景双轮验证成功

记录时间：2026-10-29 12:46（Asia/Shanghai）。来源：本机 `wanzhi.py --run --input industry-demo.input.json` + `--followup <run_id>`。

## 首轮（行业场景，INDUSTRY_DEMO_FIXTURE）

- run_id：`6094ff82-25a2-4d2b-a2f4-4c28afe80f17`；session_id：`8f8b1405cefe45c7`
- 输入：充储场站 BUS-B 下 PCS-01（500kW）与 CP-05（120kW）充电功率同窗下降；E01/E02/E03；缺母线电压
- 输出：`VALIDATED_ADVISORY`（1087 帧），NEEDS_EVIDENCE / abstain=true，3 候选（H1 上游供电/电压、H2 站级调度限功率、H3 测量/对时），请求 Q01 读取 METER-01 母线电压，6 项人工核验

## 第二轮（补证闭环，复用同一会话）

- run_id：`c1b6bccc-8d86-46fa-a5e6-8bce42f8fa58`；`followup_of=6094ff82…`；session_id 复用（**未新建会话**）
- 本地只读模拟查询 Q01 → 母线电压 396V（额定 380V±7% 范围内，source=`local_read_only_telemetry_simulation_v1`）→ 回发同会话
- 输出：`VALIDATED_ADVISORY`（1008 帧），NEEDS_HUMAN / abstain=true，input_revision=2
- **关键修订行为（符合合同与提示词约束）**：
  - H1 增加 `against_evidence_ids: ["E04"]`（电压正常削弱"母线电压异常"分支，但保留上游限流/运行方式候选）；
  - H2 未因电压正常而升级——明确"母线电压正常不能直接证明调度限功率"；
  - `requested_evidence=[]`：明确"Q01 已执行、固定窗重复读取无新增区分价值、无其他可用只读证据 → 转人工"（预算与证据价值判断正确）；
  - 7 项人工核验，含"E04 为单一来源模拟读数、需交叉验证"的诚实标注。

## 意义

- 展示完整业务闭环：**证据不足 → 主动请求只读补证 → 本地执行查询 → 回发同会话 → 基于新证据修订候选 → 预算/证据价值评估 → 转人工**；
- 第二轮正确使用反证、不误判因果、诚实标注模拟数据来源——评审可核验；
- 工具链新增 `--followup` 命令（含 4 项离线测试），origin 放行 `INDUSTRY_DEMO_FIXTURE`，50 项测试全通过；
- 完整 run 记录与 decision 全文已落盘 `backend/.private/wanzhi/runs/`（脱敏）。

## 说明

- E04 电压为本地声明 fixture 的模拟读数（`provenance=read_only_query:Q01`），已在 decision 中由模型自行标注"非真实场站遥测"，不作为真实数据主张。
