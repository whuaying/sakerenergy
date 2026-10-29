# 2026-10-29 首次真实 API 成功：VALIDATED_ADVISORY

记录时间：2026-10-29 11:13（Asia/Shanghai）。来源：本机 `wanzhi.py --run` 真实调用（`source=LIVE_API_ATTEMPT`）。

## 里程碑

**首个通过全部合同校验的真实万智调用闭环达成**：

| 环节 | 结果 |
| --- | --- |
| `POST /conversation` 创建会话 | ✅ `session_id=d3e07a0294e1430b`（Agent `d86bc562cb9b450b`，version 3） |
| `POST /conversation/{id}/send` | ✅ 携带 `model_api_key`=大赛官方大模型 Key，SSE 流 **1124 帧**，事件 `["text","reasoning","message_result","finish_reason"]` |
| `GET /conversation/{id}/result` | ✅ `select_decision` 找到本轮唯一 assistant JSON |
| 本地校验 | ✅ Schema + 应用语义全部通过（轮次一致、引用 E01–E03、Q01 白名单、支持/反证不重叠、预算约束） |
| 配置 `WANZHI_COMPLETION_EVENT=finish_reason` 后 `--resume` | ✅ `state=VALIDATED_ADVISORY`、`completion_confirmed=true`、退出码 0 |

run_id：`dfba4f6b-d34f-404e-ab38-8cc174532acc`（完整记录与 decision 已落盘 `backend/.private/wanzhi/runs/`）。

## 关键结论

1. **`model_api_key` 的正确取值 = 大赛官方发放的大模型 API Key**（邮件中 `sk-eeaa…`）。万智平台 OpenAPI Key 与 Agent 专属 API Key 均被模型侧拒绝（"无效的 API Key"）；大赛 Key 一次通过。
2. **本次成功流的 SSE 终止事件为 `finish_reason`**。失败响应也曾使用同一事件并带失败状态；事件名称不是成功判据。当前结果合同校验可拒绝无有效当前轮次 JSON 的失败输出，但不能据此断言所有嵌套失败状态都已覆盖；仍需补齐专门回归。
3. 诊断输出质量符合提示词约束：`abstain=true`、候选仅 H1/H2（调度限功率 / 电网侧约束）、仅请求 Q01、人工核验 5 项、明确"两个端点只能表述为同窗下降"与"电压正常不能证明调度"。

## 配置已持久化（本机 DPAPI 加密）

- `key_configured=true`、`template_configured=true`、`model_api_key_configured=true`、`completion_event_configured=true`；
- `public_url` 待用户从平台发布页提供。

## 待办

- 获取并配置 Agent 公开 URL（比赛提交必需）；
- 后续三个分支已完成，2026-10-29复核见 [四轮里程碑记录](2026-10-29-live-milestone-verified.md)；
- 保存真实运行证据（decision JSON 与 SSE 协议观察）供参赛材料；
- 本记录不含任何真实密钥。
