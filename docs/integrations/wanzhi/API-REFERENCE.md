# 用户 HTML 中已确认的 API

## 2026-10-29 实测补充

本账户的指定 Agent 会话已通过真实调用：OpenAPI Key 用于 Bearer 鉴权，模型 Key 单独放入 `model_api_key`；用户说明该模型凭据由大赛发放。本机复核确认模型 Key 已加密保存，但未独立检查发放邮件。该账户实测需要有效模型凭据，不能因快照将字段列为可选就断言所有账户可省略，也不能将两类 Key 混用。

成功流观察到 `text / reasoning / message_result / finish_reason`；同名 `finish_reason` 也曾出现在模型鉴权失败响应。它是终止事件观察，不能单靠名称证明生成成功。四轮成功仍依赖当前轮次结果与现有合同校验；嵌套失败状态的专门处理与回归尚需补齐。详细证据见 [真实调用里程碑](observations/2026-10-29-live-milestone-verified.md)。

## 2026-10-28 静态快照摘录

来源：项目根目录 `万智大模型一站式平台.html`，保存于2026-10-28；可见文档标题 `AppDevHub Open API`，版本 v1.0.0、OpenAPI 3.1.0。

页面保存来源为 `https://www.wanzhi.com/studio/settings/keys`，文档服务器是 `https://www.wanzhi.com/app`。以下路径均相对于服务器；所有请求需要 Bearer OpenAPI Key。普通 JSON 响应示例为 `code/message/data`，成功 code=200；HTTP 成功与业务成功分开判定。

| 方法 | 路径 | 可见合同 |
| --- | --- | --- |
| POST | `/api/v1/open-api/conversation` | `template_id` 必填；可选 `title/external_uid`；返回 `data.session_id`。说明：template_id 使用 super_employee_id 或 workflow_id（工作流以 ab_ 开头）。实际 ID 仍需平台核实。 |
| POST | `/api/v1/open-api/conversation/{conversation_id}/send` | `content` 必填；可选 files、knowledge_query_request、qa_knowledge_query_request、language、model_api_key；说明为流式，示例响应 null，未完整定义事件协议。 |
| POST | `/api/v1/open-api/conversation/send` | `content` 必填；无 conversation_id 时需 agent_id；自动建会话，从 type=session_init 的 SSE 消息读取 session_id；后续沿用。 |
| GET | `/api/v1/open-api/conversation/{conversation_id}/result` | 返回 schema_version、session_id、messages；每条含 role/content/type/id/response_id/step_id/detail；不承诺已完成。可能403/404。 |
| GET | `/api/v1/open-api/conversation/{conversation_id}/detail` | 返回 session_info、messages、feedback；消息示例含 timestamp、trace_id、response_id 等；status 未列出枚举。 |
| GET | `/api/v1/open-api/conversation/list` | 当前 Key 创建的会话；limit=1..100（默认50），可筛 external_uid。 |
| POST | `/api/v1/open-api/conversation/{conversation_id}/stop` | 请求停止；不能推定一定撤销已执行工作或费用。 |
| POST | `/api/v1/open-api/conversation/upload` | multipart/form-data，file 必填；返回 name/key/url/public_url/download_url/size/type。 |
| POST | `/api/v1/open-api/default-agent/chat` | message 必填，长度1..20000；可选 conversation_id/external_uid/files/project_id；HTTP202，data含session_id/task_id/status/error；需 default_agent 权限。 |
| GET | `/api/v1/open-api/default-agent/tasks/{task_id}` | 返回同任务视图；无权限403、不属于当前Key/不存在404；status只是string，没有完成枚举。 |
| GET | `/api/v1/open-api/knowledge` | 知识库列表；不等同 Agent 列表。 |
| POST | `/api/v1/open-api/knowledge` | name、visible_range必填；1私有、2公开、3指定组织。embed_type可省略，使用租户默认模型。 |
| POST | `/api/v1/open-api/knowledge/{knowledge_id}/query` | query必填；query_type=1语义/2关键词/3混合；topK默认10、最小1；rerank默认true，weight默认0.5，score默认0。 |
| POST | `/api/v1/open-api/knowledge/{knowledge_id}/documents/upload-url` | file_name、upload_type必填；upload_type为upload/slice_upload，slice_size默认1。响应示例null，不能推断上传方法/地址字段。 |
| POST | `/api/v1/open-api/knowledge/{knowledge_id}/documents` | obj_key_list必填，可配置文档/表格分段；提交的是解析任务，不表示解析已完成。 |
| GET | `/api/v1/open-api/knowledge/{knowledge_id}/document-tasks` | 解析任务列表；响应示例data=null，结构需实测。 |
| GET | `/api/v1/open-api/knowledge/{knowledge_id}/document-tasks/{task_id}` | 解析任务详情；状态/错误细节需实测。 |

这些是摘录而非完整 OpenAPI 导出。快照未证明：原生 response_format/JSON Schema、原生函数调用约束、Agent 公共URL生成规则、完整SSE协议、调用速率/费用、模型上下文限制、知识检索结果结构、权限scope的实际标识、webhook或上游幂等请求支持。实现时不自行补造。

知识库网页中展示的通用示例 `knowledge_query_request` 与独立 `/knowledge/.../query` 不是同一 Schema，不能仅按字段同名推断全部枚举语义一致。
