# Saker Energy 充储场站证据诊断助手 · 真实运行证据摘要

整理时间：2026-10-29（Asia/Shanghai）。用途：2026「云桥杯」工业智能体大赛作品说明书引用。

## 作品与平台信息

- Agent 名称：Saker Energy 充储场站证据诊断助手
- Agent ID（template_id）：`d86bc562cb9b450b`（已发布，version 3）
- Agent 公开链接（主办方确认）：`https://www.wanzhi.com/studio/agent/d86bc562cb9b450b`
- 接入方式：万智开放 API（`https://www.wanzhi.com/app/api/v1/open-api`），Bearer OpenAPI Key 鉴权，模型调用使用大赛发放的大模型 API Key
- 调用链：本地任务 → 创建会话（POST /conversation，传 template_id）→ 发送证据包（POST /conversation/{id}/send，SSE 流式）→ 获取结果（GET /conversation/{id}/result）→ 本地 Schema + 语义合同校验

## 真实运行记录（4 轮全部通过校验）

| # | 输入场景 | run_id | session_id | 输出 decision | 校验结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | 多设备功率同期下降（E01/E02/E03，缺电压） | `dfba4f6b-…` | `d3e07a0294e1430b` | NEEDS_EVIDENCE，abstain=true，H1 调度限功率 / H2 电网约束，请求 Q01 母线电压补证，5 项人工核验 | VALIDATED_ADVISORY |
| 2 | 查询预算耗尽（no-budget） | `7f9e498d-…` | `cf66bbd4c90c48c5` | NEEDS_HUMAN，abstain=true，3 候选，不再请求补证，转人工 | VALIDATED_ADVISORY |
| 3 | 补充母线电压 400→360V（voltage-sag） | `22e16ea9-…` | `a77b2f735ff44247` | NEEDS_HUMAN，abstain=true，3 候选，请求人工核对测点归属/量程/时间同步 | VALIDATED_ADVISORY |
| 4 | 电压量测缺失（voltage-missing） | `ddcdf391-…` | `b3ed93633ed24106` | NEEDS_HUMAN，abstain=true，2 候选，不编造读数，转人工 | VALIDATED_ADVISORY |

## 协议与行为证据（真实观测）

- SSE 事件序列（成功轮）：`text → reasoning → message_result → finish_reason`，单轮约 1100+ 帧（首轮 1124 帧）；
- 完成事件：`finish_reason`（本地 `WANZHI_COMPLETION_EVENT=finish_reason` 已配置并验证）；
- 鉴权契约：`model_api_key` 字段必填，取值须为有效模型调用凭据（大赛官方大模型 Key 验证通过；万智平台 Key 与 Agent 专属 Key 均被模型侧拒绝——此过程记录于 observations，含 422 与"无效的 API Key"两次失败排查）；
- 合同约束均被满足：证据不足 abstain、候选引用仅限输入证据、补证遵守查询预算、缺失数据不编造、人工核验清单完整。

## 材料落点

- 完整 run 记录（含 decision 全文）：`backend/.private/wanzhi/runs/<run_id>.json`（gitignore，脱敏）；
- 观察记录：`docs/integrations/wanzhi/observations/2026-10-29-live-send-422-model-api-key.md`、`…-model-key-invalid.md`、`…-first-success.md`、`…-live-branch-runs.md`；
- 输入证据包与返回 Schema：`docs/integrations/wanzhi/evidence-package.example.json`、`decision.schema.json`。

## 边界声明

- 以上输入证据包均为 `data_origin=SYNTHETIC_DEVELOPMENT_FIXTURE` 的手工构造样例（演示数据），不代表真实场站遥测；
- 本摘要不含任何真实密钥；密钥仅存于本机加密配置与后端环境。
