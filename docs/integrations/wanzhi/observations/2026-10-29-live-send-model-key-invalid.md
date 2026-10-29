# 2026-10-29 真实 API：model_api_key 需要有效模型 Key

记录时间：2026-10-29 10:26（Asia/Shanghai）。来源：本机 `wanzhi.py --run` 真实调用（`source=LIVE_API_ATTEMPT`）。

## 结果

| 步骤 | 结果 |
| --- | --- |
| `POST /conversation` 创建会话 | ✅ session_id=`a0f08eb7e52f4ccd`；detail 显示 `super_employee_id=d86bc562cb9b450b`、`version=3`、`template_type=super_employee` |
| `POST /conversation/{id}/send`（携带 `model_api_key`=OpenAPI Key） | ✅ HTTP 通过校验（不再 422），SSE 事件 `["text","finish_reason"]`，2 帧 |
| 模型实际调用 | ❌ assistant `finish_reason` 事件：`content="无效的 API Key"`，`detail.reason="无效的 API Key"`，`status=failed` |
| `GET /conversation/{id}/detail` | ✅ 200，返回 session_info 与 messages（含 role/type/content/detail/trace_id） |
| 本地 `select_decision` | 无本轮合法 JSON → `NO_UNIQUE_CURRENT_ROUND_RESULT`（符合预期，因模型未产出 JSON） |

run_id：`f4bc2566-3674-4cbf-b16d-2e0adb5517b8`。

## 结论

1. `model_api_key` 字段**必填**（HTTP 422 → 提供字段后通过）；
2. 该字段必须是**有效的模型调用凭据**——使用 OpenAPI Key 作为其值会通过 HTTP 校验，但模型侧返回"无效的 API Key"（`finish_reason` + `status=failed`）；
3. 真正可用的 model_api_key 需来自：万智「模型库」中模型的调用凭据、该 Agent 模型配置处绑定的 Key，或模型供应商（如 DeepSeek）的有效 API Key。

## 已确认的协议观察

- SSE 事件类型实例：`text`（用户消息/回显）、`finish_reason`（assistant 结束，失败时 `detail.status=failed` 且 `content` 为错误信息）；
- `detail` 响应：`session_info` 含 `status`（ACTIVE）、`version`、`agent_tool_info`（当前 Agent 带 SANDBOX 工具 `code_interceptor`/`terminal`，未禁用）、`guardrail_config.enabled=true`；
- 失败时不产生可解析的 assistant JSON，本地以 `NO_UNIQUE_CURRENT_ROUND_RESULT` 收口，未重发。

## 待办

- 从平台「模型库」/Agent 模型配置取得有效模型 Key；
- 配置 `WANZHI_MODEL_API_KEY` 后重跑 `--run`，确认正常完成时的 SSE 结束事件，再决定 `WANZHI_COMPLETION_EVENT`；
- 本记录不含任何真实密钥。
