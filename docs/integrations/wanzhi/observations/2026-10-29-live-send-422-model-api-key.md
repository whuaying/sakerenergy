# 2026-10-29 首次真实 API 调用：send 需要 model_api_key

记录时间：2026-10-29 10:1x（Asia/Shanghai）。来源：本机 `wanzhi.py --run` 首次真实调用（`source=LIVE_API_ATTEMPT`）。

## 结果

| 步骤 | 结果 |
| --- | --- |
| 只读探针 `GET /knowledge` | HTTP 200，code 200，可读 4 个共享知识库（role=READER） |
| 创建会话 `POST /conversation` | 成功，`session_id=5153e8ccd2ee43bb`（已持久化到本机私有 run 检查点） |
| 发送消息 `POST /conversation/{id}/send` | **HTTP 422：`{"detail":"model_api_key is required"}`** |
| 对账 `GET /conversation/{id}/result` + `--resume` | 无本轮 assistant 结果，`CURRENT_ROUND_NOT_CONFIRMED_NO_RESEND`（未重发） |

run_id：`9d7b40f4-e4fa-4c4a-a17c-4d6c791d21ff`（检查点存于被忽略的 `backend/.private/wanzhi/runs/`）。

## 契约发现（与 HTML 文档不一致）

- 用户 HTML 快照中 `/conversation/{conversation_id}/send` 的 `model_api_key` 标注为"可为 null"；
- **万智真实服务端将 `model_api_key` 视为必填**（422 Validation Error），不传则拒绝发送；
- 该 Key 为模型调用凭据，与 Bearer OpenAPI Key 不同；来源需从平台「模型库」/Agent 模型配置处取得，本机未臆造。

## 已做的适配

- `backend/integrations/wanzhi_config.py`：`Settings` 增加 `model_api_key`（repr=False）；`load_settings` 支持 `WANZHI_MODEL_API_KEY` 环境变量与 DPAPI 加密落盘字段 `model_key_protected`；`save_settings` 加密保存。
- `backend/integrations/wanzhi_client.py`：`send_message` 在配置了 `model_api_key` 时将其加入请求体（未配置时不带，保持原行为）。
- `backend/wanzhi.py --configure`：新增 Model API Key 可选输入。
- 41 项离线单元测试修改后复跑通过。

## 待办

- 从万智平台确认 `model_api_key` 的准确来源并取得该 Key（配置为本机 `WANZHI_MODEL_API_KEY` 或 `--configure` 输入）；
- 取得后重跑 `--run`（新 run_id），确认 SSE 事件类型与结果正文关联，再决定 `WANZHI_COMPLETION_EVENT`；
- 本记录不含任何真实密钥。
