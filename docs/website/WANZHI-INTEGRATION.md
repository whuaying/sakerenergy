# Saker Energy 接入万智大模型一站式平台规划

版本：0.1 · 2026-10-28（北京时间）

> **本文件是接入规划，不是实施完成记录。** 所有接口与示例来自《万智大模型一站式平台.html》中保存的万智开放平台 OpenAPI 文档（v1.0.0，OpenAPI 3.1.0，服务器 `https://www.wanzhi.com/app`，Bearer 认证）。平台侧实际行为以万智平台真实响应为准。

## 0. 一页结论

- **目标**：把 Saker Energy 官网（营销站 + 浏览器仿真演示）升级为带真实 AI 对话能力的站点，通过万智开放平台提供「知识库检索 + 对话交互」能力。
- **默认场景假设**：官网访客 AI 顾问（产品、方案、试点流程咨询），后续扩展内部知识问答与故障诊断辅助。*（决策点，见 §2）*
- **架构**：现有纯静态站不变，新增一个轻量 Node.js 服务端代理层（Render Web Service），浏览器只与服务端通信，服务端持有万智 OpenAPI Key 并转发 SSE 流。
- **核心链路**：万智知识库灌入产品/故障文档 → 创建「专属员工」Agent 模板 → 官网对话入口发消息 → 服务端转发 `POST /conversation/send`（SSE）→ 前端渲染流式回答。
- **必须遵守的仓库边界**（AGENTS.md / CONTENT-AND-SCOPE.md）：
  1. 官网任何功能不得发送设备控制指令；AI 只做咨询/检索，不触碰控制面。
  2. 场站演示、诊断候选、工单仍是浏览器仿真，不得因接入对话而宣称「已接入真实遥测/诊断」。
  3. 对话服务是真实第三方处理，隐私政策与页面文案必须如实更新。

---

## 1. 平台能力与仓库现状对照

### 1.1 万智开放平台能力（来自所附 API 文档）

| 模块 | 能力 | 关键接口 | 本项目用途 |
| --- | --- | --- | --- |
| 知识库管理 | 建库、传文档、解析、检索 | `POST /api/v1/open-api/knowledge`（建库）、`POST /knowledge/{id}/documents/upload-url`（预签名上传）、`POST /knowledge/{id}/documents`（创建解析任务）、`GET /knowledge/{id}/document-tasks/{task_id}`（查解析状态）、`POST /knowledge/{id}/query`（检索/问答） | 灌入产品与故障知识，供 Agent 检索 |
| 对话交互 | 会话创建、SSE 流式对话、附件、停止、历史 | `POST /api/v1/open-api/conversation`、`POST /conversation/send`（自动建会话 + SSE）、`POST /conversation/{id}/send`、`POST /conversation/{id}/stop`、`GET /conversation/{id}/detail` | 官网 AI 顾问的对话引擎 |
| 数据看板 | 用量、模型、Agent 表现 | `GET /api/v1/open-api/dashboard/overview`、`/model_overview`、`/agent_dashboard` | 上线后监控成本与使用量 |
| 通用 Agent | 后台启动任务、查状态 | `POST /api/v1/open-api/default-agent/chat`（HTTP 202）、`GET /default-agent/tasks/{task_id}` | 可选：长耗时问答任务 |

认证方式：全部接口要求请求头 `Authorization: Bearer <OpenAPI Key>`。Key 在平台「API key 管理」页创建并授予权限范围。

### 1.2 仓库现状与缺口

| 维度 | 现状 | 接入缺口 |
| --- | --- | --- |
| 网站形态 | 纯静态多页站，零第三方依赖，`dist/` 发布到 Render Static | 无法安全持有 API Key、无法跨域调用万智 → 必须新增服务端代理 |
| 内容素材 | `docs/01-12`、`data/fault_catalog.csv`、WHITEPAPER、官网文案 | 需要整理成知识库文档（清洗、分段、版本化） |
| 对话入口 | 无任何聊天 UI | 需新增对话组件（浮窗或页面区块） |
| 数据契约 | 浏览器本地仿真（`models.js`），无服务端状态 | 会话状态在服务端（万智侧），需定义前端↔代理↔万智的契约 |
| 隐私文案 | `privacy.html` 按无追踪/本地处理编写 | 需补充「对话内容发送至万智处理」的说明 |

---

## 2. 接入目标与场景定义（决策点 D1）

### 2.1 候选场景与推荐

| 场景 | 知识库素材 | Agent 形态 | 页面入口 | 推荐度 |
| --- | --- | --- | --- | --- |
| A. 官网访客 AI 顾问 | 产品价值、方案、试点流程（docs 摘要 + 官网文案） | 专属员工（咨询型） | contact.html 试点咨询区 + 全站浮窗 | ★ 主场景（默认） |
| B. 内部团队知识问答 | docs/01-12 全文 + 验收/变更记录 | 专属员工（内部版，权限受限） | 内部入口（不对外发布） | 阶段 2 扩展 |
| C. 故障诊断辅助 | fault_catalog.csv + 03/04/05 文档 | 专属员工（诊断问答，明确只读与人工边界） | technology.html 或独立演示 | 阶段 2 扩展 |

**默认按场景 A 规划**（最贴合仓库「商业官网 + 试点转化」定位），B/C 作为后续阶段扩展。若实际目标不同，仅影响 §5 知识库选材与 §6.2 页面入口，架构不变。

### 2.2 场景 A 的对话范围（业务口径）

AI 顾问可以回答：

- 产品是什么、解决什么问题、面向哪些角色（来自官网文案与 PRD 摘要）。
- 三类异常场景的排查思路（**表述为「候选原因与检查方向」**，不声称已确认根因）。
- 试点如何开始：前置条件、只读影子试点流程、单站 4–8 周节奏（来自 contact 页口径）。
- 收益测算的参数口径（S、N、p、t、W、d、L、C 的定义与约束，来自 10-PILOT-ROI.md）。

AI 顾问**不得**：

- 不得给出设备操作、带电检修、参数修改或任何控制指令。
- 不得虚构客户案例、实测成绩、合规认证、价格承诺。
- 不得把仿真数据说成真实遥测。
- 涉及现场操作时统一引导至「由有资质人员按厂家规程执行」，并提示联系人工渠道。

> 该口径需在万智 Agent 提示词（System Prompt）与知识库文档中同时固化，并在对话中提供证据来源引用。

---

## 3. 总体架构

```text
浏览器（官网静态站 dist/）
   │  fetch(SSE 流)
   ▼
Saker 代理服务（新增，Node.js，Render Web Service）
   │  持有 WANZHI_API_KEY，转发请求、白名单校验、限流、审计
   ▼
万智开放平台  https://www.wanzhi.com/app
   ├─ 知识库管理（灌档在实施期由脚本完成）
   ├─ 对话交互  POST /api/v1/open-api/conversation/send  → SSE
   └─ 数据看板  GET /api/v1/open-api/dashboard/overview（监控用）
```

### 3.1 为什么必须新增服务端代理

1. **Key 保护**：OpenAPI Key 放在浏览器会被任何访客抓取并盗用额度，必须只存在于服务端环境变量。
2. **CORS 与转发**：万智服务器与静态站跨域，且不接受浏览器直发（Key 在 Header 中），由代理统一转发。
3. **可控边界**：在代理层做输入长度限制、频率限制、敏感字段过滤（如对话中不收集姓名电话邮箱）、审计日志，符合仓库「不编造收件后端」的谨慎原则。
4. **可观测**：统一记录用量、错误率，对接数据看板与成本监控。

### 3.2 部署形态（决策点 D2）

| 方案 | 说明 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 方案 1（推荐）：新增 Render Web Service `saker-energy-api` | 与现有 Static Site 并存，域名如 `saker-energy-api.onrender.com`；官网静态页通过该域调用 `/api/*` | 不动现有构建与发布流程；服务端独立扩缩 | 多一个部署单元与跨域配置 |
| 方案 2：改为单个 Node Web Service 托管静态 + API | 把 `dist/` 交给 Node 服务托管 | 单一服务、无跨域 | 改动现有 Render 配置与回滚策略，影响面大 |
| 方案 3：Serverless 函数（如 Render Blueprint/边缘函数） | 按请求计费 | 轻量 | 长 SSE 流与超时限制需实测；当前 Render 配置为 Static，改动成本不明 |

> 规划默认 **方案 1**，与现有「Static Site 只发布 dist」的边界完全兼容。

---

## 4. 万智平台侧准备（一次性配置清单）

以下步骤需要万智账号操作权限，规划文档给出操作与对应 API；实际执行由项目负责人登录平台完成。

### 4.1 创建 OpenAPI Key

1. 登录万智平台 → 「API key 管理」→ 新建 Key。
2. 权限范围授予：**知识库管理** + **对话交互**（数据看板可选，用于监控）。
3. 保存 Key 到服务端环境变量 `WANZHI_API_KEY`，**不写入 Git**。
4. 记录 Key 的 `Tracking ID`（用于平台侧审计对账）。

验证：

```bash
curl https://www.wanzhi.com/app/api/v1/open-api/knowledge \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'
# 期望：code=200，data 为知识库列表（初始为空数组）
```

### 4.2 创建知识库

接口：`POST /api/v1/open-api/knowledge`

```json
{
  "name": "saker-energy-public",
  "visible_range": 1,
  "description": "Saker Energy 官网产品、方案与试点知识库",
  "embed_type": "bge-m3"
}
```

- `visible_range`：1=私有（推荐，避免他人可见）。
- `embed_type`：`bge-m3` 或 `qwen3-8b`，省略时使用租户默认嵌入模型。
- 记录返回的 `knowledge_id`，作为后续所有文档/检索调用的路径参数。
- 建议按内容域拆多个库（见 §5.3）：`saker-energy-product`、`saker-energy-fault`、`saker-energy-pilot`，便于分别控制更新与检索权重。

### 4.3 上传文档并创建解析任务（灌档流程）

万智灌档是「预签名上传 → 创建解析任务 → 轮询状态」三步：

1. **获取上传预签名 URL**：`POST /knowledge/{knowledge_id}/documents/upload-url`

```json
{ "file_name": "prd-summary.md", "upload_type": "upload", "slice_size": 1 }
```

2. **使用返回的预签名 URL 直传文件内容**（PUT/POST，按平台返回的 url 与字段为准；小文件 `upload_type=upload`，大文件 `slice_upload` 分片）。
3. **创建文档解析任务**：`POST /knowledge/{knowledge_id}/documents`

```json
{ "obj_key_list": ["<上一步返回的 object key>"] }
```

   - 如需自定义分段：传 `custom_docs_chunk`（`chunk_marker`、`chunk_length`），表格文件传 `custom_tables_chunk`（`sheet_name`、`rows_per_chunk`、`header_row`、`data_start_row`、`columns`）。
4. **轮询解析状态**：`GET /knowledge/{knowledge_id}/document-tasks/{task_id}`，直到 `file_status` 进入终态（成功/失败）。失败时读取 `result` 字段修正文档格式后重传。

> 实施期建议写成脚本 `scripts/seed-knowledge.mjs`（本地执行，非网站运行时），用 API Key 批量灌档并打印每个文件的解析结果，便于重跑。

### 4.4 创建「专属员工」Agent（对话模板）

- 在万智平台「专属员工」/「工作流」中创建咨询型 Agent（对应文档中的 `template_id`，`super_employee_id` 或 `workflow_id`（以 `ab_` 开头））。
- 在 Agent 配置中：
  - 绑定 §4.2 创建的知识库（检索用）。
  - 写入 §2.2 的业务口径（System Prompt）：只读咨询、不控制设备、不虚构成绩、来源引用、人工边界。
  - 配置 Guardrail（文档存在 `guardrail_config`/`GuardrailRule`：敏感词、自定义提示语），拦截控制类/越权问题。
- 记录 `template_id`，供会话创建接口使用。

### 4.5 对话联调验证

用「自动创建会话」接口做最小验证（SSE）：

```bash
curl https://www.wanzhi.com/app/api/v1/open-api/conversation/send \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
  --data '{
    "agent_id": "<template_id>",
    "content": "你们的试点一般需要多长时间？",
    "external_uid": "tester-001"
  }'
```

- 响应为 **SSE 事件流**；首个事件 `type=session_init` 返回 `session_id`，后续请求以此作为 `conversation_id`。
- 未指定 `conversation_id` 时自动建会话；也可先用 `POST /conversation` 显式创建。

---

## 5. 知识库内容设计

### 5.1 素材清单与来源（仓库内已有，可直接引用）

| 素材 | 路径 | 用途 | 处理方式 |
| --- | --- | --- | --- |
| 产品需求摘要 | docs/01-PRD.md | 产品定位、角色、P0/P1 | 清洗为 2–3 页摘要文档 |
| 架构与数据契约 | docs/02-ARCHITECTURE.md | 技术口径（只读、人工门控） | 摘要 + 边界声明 |
| 故障基准与目录 | data/fault_catalog.csv、docs/03-DATA-FAULTBENCH.md | 诊断辅助（阶段 C 主库） | CSV 转结构化 Markdown/表格文档，按 domain（charger/bess/…）分组 |
| 安全与责任 | docs/05-SAFETY-SECURITY.md | AI 边界、人工责任 | 摘录为「安全边界」文档 |
| 试点与 ROI | docs/10-PILOT-ROI.md | 试点流程、测算口径 | 公式与参数定义成文 |
| 验收与状态 | docs/07-ACCEPTANCE.md、ACCEPTANCE-RECORD.md | 当前完成状态口径 | 状态声明文档（避免 AI 声称已验收） |
| 官网文案 | web/pages/*.html | 产品价值、场景、FAQ | 直接抽取正文 |

> **重要**：文档 01–12 是工业产品**规划基线**，不是已实现证明。知识库文档必须保留「规划/目标」与「已实现」的区分措辞，否则 AI 会照搬规划语言造成误导。

### 5.2 建议知识库结构（按域拆分）

| 知识库 | 内容 | 检索场景 |
| --- | --- | --- |
| `saker-energy-product` | 产品定位、价值、角色、场景、FAQ、官网口径 | 访客售前咨询（主） |
| `saker-energy-pilot` | 试点流程、前置条件、收益测算口径 | 试点意向咨询（主） |
| `saker-energy-fault` | 故障目录 + 场景脚本 + 安全边界 | 诊断辅助（阶段 C 扩展） |
| `saker-energy-internal` | docs 全文、验收/变更/发布记录 | 内部问答（阶段 B 扩展，权限受限） |

### 5.3 文档质量与更新机制

- **分段**：单个文档控制篇幅（建议 ≤ 50KB 文本），长文档按章节拆分为多个文件；CSV 转表格文档时用 `custom_tables_chunk` 配置（`header_row=1`、`data_start_row=2`、按 `domain` 列分组）。
- **版本**：文件名带版本或日期（如 `prd-summary-v2026-10.md`）；文档更新时重传并记录 `md5`（文档列表接口返回 `md5` 字段，可用于比对去重）。
- **重跑脚本**：`scripts/seed-knowledge.mjs` 支持幂等灌档（按文件名+md5 判断是否已存在，跳过未变更文件）。
- **检索参数**（`POST /knowledge/{id}/query`）：`query_type` 1=语义 / 2=关键词 / 3=混合；`topK`（默认 10）、`weight`（混合检索语义权重 0.5）、`rerank=true`、`score` 阈值（按实测调节）。初期建议 `query_type=3, rerank=true, topK=8`。

---

## 6. 代码侧落地设计

### 6.1 服务端代理（新增，推荐目录 `server/`）

技术选型：Node.js 22+（与仓库一致），零第三方依赖（用内置 `http`/`fetch`），避免新增依赖面；如确需更顺手可引入极简框架并在 DEVELOPMENT.md 注明。

环境变量：

```text
WANZHI_API_KEY=<万智 OpenAPI Key>
WANZHI_BASE_URL=https://www.wanzhi.com/app
WANZHI_AGENT_ID=<专属员工 template_id>
ALLOWED_ORIGIN=https://saker-energy.onrender.com
RATE_LIMIT_PER_IP=20        # 每分钟每 IP 请求上限
MAX_MESSAGE_LENGTH=2000     # 单条消息字符上限
```

代理接口设计（全部为官网前端专用，路径前缀 `/api/`）：

| 方法/路径 | 功能 | 转发目标 |
| --- | --- | --- |
| `POST /api/chat` | 发送消息（自动建会话或携带 conversation_id），返回 SSE 流 | `POST /api/v1/open-api/conversation/send` |
| `POST /api/chat/stop` | 停止生成 | `POST /api/v1/open-api/conversation/{id}/stop` |
| `GET /api/chat/history` | 会话历史（页面刷新后恢复可选） | `GET /api/v1/open-api/conversation/{id}/detail` |
| `GET /api/health` | 健康检查 | 本地返回（含 Key 存在性检查，不泄露 Key） |
| `GET /api/usage`（可选，管理员） | 用量概览 | `GET /api/v1/open-api/dashboard/overview` |

代理层职责（每项都是硬要求）：

1. **转发映射**：前端参数 → `OpenApiSendRequest`（`content`、`agent_id`、`conversation_id`、`external_uid`、`files`、`knowledge_query_request`、`language`）。其中 `knowledge_query_request` 由代理按知识库配置注入，**前端不可指定任意 knowledge_id**（防越权检索）。
2. **SSE 透传与协议简化**：原样转发万智 SSE 事件（`session_init`、增量、`done`/`error`）；若需要向前端屏蔽内部字段，可在代理层仅透出白名单事件。
3. **校验**：消息长度 ≤ `MAX_MESSAGE_LENGTH`；非法字符（控制字符）剔除；`conversation_id` 仅接受代理签发过的 id（会话归属校验，可配合 `external_uid`）。
4. **限流**：按 IP 每分钟限次；超限返回 429 与友好提示。
5. **审计**：记录时间、来源 IP（脱敏）、会话 id、消息长度、万智返回码；**不记录对话明文正文**（隐私最小化）。
6. **错误降级**：万智 `code != 200`、网络超时（建议 30s）、SSE 中断时，返回统一错误结构，前端显示「暂时无法回答，请稍后重试或联系人工」。

响应结构统一：

```json
{ "ok": true, "data": { "conversation_id": "…", "content": "…", "citations": ["…"] } }
{ "ok": false, "error": { "code": "RATE_LIMITED|UPSTREAM|BAD_REQUEST", "message": "…" } }
```

### 6.2 前端改造

#### 入口与 UI（决策点 D3，默认两处）

- **contact.html**：在「规划试点」区块下新增「AI 顾问」对话卡片——访客可在生成需求摘要前先咨询试点流程、收益口径。
- **全站浮窗**（layout.html 引入，各页右下角，移动端可折叠）：入口按钮 + 对话面板。
- 对话面板要求：流式文本渲染、来源引用链接展示、加载/停止按钮、错误重试、键盘可用、支持减少动效、面板不遮挡关键内容、移动端全屏可关闭。

#### SSE 前端处理

- 用 `fetch` + `ReadableStream` 解析 SSE（或 `EventSource` POST 不可用时用 fetch 流），按事件类型驱动 UI：
  - `session_init` → 保存 `session_id`（存内存/会话级，不持久化到 localStorage，符合现有隐私口径）。
  - 增量文本 → 追加到当前回答气泡。
  - `done` → 结束状态，允许发送下一条。
  - `error` → 展示错误与重试。
- 会话与隐私：对话内容**仅存于万智服务端**（会话历史接口），前端不做本地持久化；刷新页面后提供「继续上次对话」（可选用 history 接口）或「开始新对话」。

#### 文案与声明（必须同步修改）

- contact.html 对话区注明：「对话由万智大模型平台提供，回答基于 Saker Energy 公开资料生成，仅供了解产品与试点，不构成技术承诺或操作指引。」
- privacy.html 新增一节：访客主动发送的对话内容会传输至万智开放平台处理；网站不收集姓名、电话、邮箱；对话不包含设备数据或控制能力。
- FAQ / technology.html 与现有「仿真 ≠ 真实」口径保持一致：AI 对话是**真实服务**，场站数据仍是**浏览器仿真**，二者不得互相背书。

### 6.3 与现有仿真/表单的关系

| 现有能力 | 接入后状态 | 说明 |
| --- | --- | --- |
| 场站演示（experience.html） | 保持不变 | 浏览器本地仿真，不接对话 |
| 需求清单生成（contact.html） | 保持不变 | 仍是本地生成文本，不自动提交；AI 顾问可辅助填答但**不代填不代发** |
| 收益测算 | 保持不变 | 本地公式计算，AI 只解释口径 |
| 新增 AI 顾问 | 真实万智服务 | 通过服务端代理 |

---

## 7. 实施阶段与验收

### 阶段 0：平台侧验证（约 0.5 天）

- [ ] 创建 OpenAPI Key 并授权（§4.1），用 curl 验证 `GET /knowledge`。
- [ ] 创建知识库（§4.2），上传 1 份示例文档并解析成功（§4.3）。
- [ ] 创建专属员工模板（§4.4），SSE 对话联调通过（§4.5）。
- **验收**：curl 完成「传文档 → 解析 → 检索命中示例内容 → 对话返回合理回答」。

### 阶段 1：最小闭环（约 1–2 天）

- [ ] 新增 `server/` 代理，实现 `/api/chat`（SSE 透传）与 `/api/health`。
- [ ] 前端浮窗组件上线（layout.html + 新 CSS/JS），支持流式渲染与停止。
- [ ] 知识库灌入 product 与 pilot 两个库（跑 `seed-knowledge.mjs`）。
- **验收**：在 `localhost` 完成「访客提问 → 流式回答 → 引用来源 → 停止 → 再提问」全流程；`npm run check && npm test` 通过；新代码不破坏现有 8 页。

### 阶段 2：质量与边界（约 2–3 天）

- [ ] 对话口径测试：准备 20 条典型问题（产品、试点、收益、故障边界、攻击性提问），核对回答不越界、引用准确。
- [ ] Guardrail 规则生效；错误/超时/限流降级路径验证。
- [ ] privacy.html 文案更新；contact.html 对话卡片完成。
- [ ] 会话历史恢复（可选）与 `/api/chat/stop` 验证。
- **验收**：20 条测试问题全部符合 §2.2 口径；拒绝类问题不给出操作步骤；无控制类指令输出。

### 阶段 3：部署上线与监控（约 1 天）

- [ ] Render 新增 Web Service `saker-energy-api`（部署方案见 §3.2 决策点 D2），环境变量配置完成。
- [ ] 静态站 `ALLOWED_ORIGIN` 指向正式域；跨域与 HTTPS 验证。
- [ ] 接入数据看板接口做用量/成本监控（每日记录 token 用量与请求量）。
- [ ] 更新 RELEASE.md 记录服务 ID、部署 SHA、验证结果与限制；AGENTS.md / DEVELOPMENT.md 同步补充后端说明。
- **验收**：正式域名完成真实浏览器对话；限流与错误路径线上验证通过；监控可见。

---

## 8. 数据、隐私与合规

1. **Key 与密钥**：只存服务端环境变量，不入 Git，不写日志；定期轮换；权限最小化（仅知识库 + 对话）。
2. **访客数据**：对话内容发往万智（第三方处理），隐私政策如实披露；不收集、不持久化姓名/电话/邮箱；代理日志不存正文。
3. **内容边界**：AI 回答不虚构客户、成绩、认证、价格；仿真数据与真实服务严格区分；不输出任何设备控制、操作步骤或安全绕行内容。
4. **对外声明**：contact/FAQ 文案补充对话来源与局限；不得把「接入 AI 顾问」表述为「已实现智能运维平台」。
5. **AGENTS.md 更新**：新增后端后，仓库「无后端」描述需要同步修订，并明确「AI 对话服务端代理 ≠ 工业平台后端」的边界。

---

## 9. 成本与配额（待平台确认，决策点 D4）

- 万智平台对 OpenAPI 的计费口径（Key 数量、知识库存储、文档解析、模型 token、对话量）在本次文档中无数据，**需向万智确认**。
- 建议上线前获取：模型单价、免费额度、知识库存储上限、解析任务并发限制。
- 成本控制措施（无论计费如何都执行）：限流（§6.1）、对话长度上限、monitor 每日用量（dashboard API）、异常突增告警。

---

## 10. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| API Key 泄露 | 额度被盗、数据泄露 | Key 仅服务端；权限最小化；定期轮换；泄露即吊销重建 |
| SSE 中断/超时 | 回答中断体验差 | 代理超时 30s；前端重试与「稍后再试」降级；停止接口兜底 |
| AI 回答越界（控制指令/虚构成绩） | 合规与误导 | 知识库口径文档 + Agent System Prompt + Guardrail + 20 条测试回归 |
| 检索质量差（答非所问） | 体验差 | 调 `query_type/topK/score`；优化分段；按 FAQ 迭代 |
| 成本失控 | 预算超支 | 限流、长度上限、用量监控、额度告警 |
| 会话越权（他人访问会话） | 隐私风险 | 会话 id 与 `external_uid` 绑定，代理只放行归属一致的会话 |
| 仓库边界被误解 | 误导宣传 | 同步更新 AGENTS.md / README / privacy，声明「对话≠工业平台验收」 |

---

## 11. 决策点清单（需项目负责人确认）

| 编号 | 决策点 | 默认建议 | 备注 |
| --- | --- | --- | --- |
| D1 | 接入场景 | 场景 A 官网访客 AI 顾问，B/C 阶段 2 扩展 | 改动 §5 选材与 §6.2 入口，架构不变 |
| D2 | 部署形态 | 方案 1：新增 Render Web Service `saker-energy-api` | 与现有 Static 并存 |
| D3 | 对话入口 | contact.html 对话卡片 + 全站浮窗 | 也可只做浮窗 |
| D4 | 成本与配额 | 先向万智确认计费后再定线上范围 | 影响是否默认开启全站浮窗 |
| D5 | 会话持久化 | 默认不持久化；刷新即新会话 | 如需恢复再做 history 接口 |
| D6 | 实施范围 | 本次仅规划；实施需另立任务与验收记录 | 阶段 0 可先行验证 |

---

## 附录 A：接口速查表（来自所附 OpenAPI 文档）

服务器：`https://www.wanzhi.com/app`　认证：`Authorization: Bearer <Key>`　响应外层：`{code, message, data}`，`code=200` 为成功。

### 知识库管理

| 方法 | 路径 | 请求要点 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/open-api/knowledge` | — | 知识库列表 |
| POST | `/api/v1/open-api/knowledge` | `{name*, visible_range*:1|2|3, description?, embed_type?:bge-m3\|qwen3-8b, org_ids?}` | 建库 |
| GET | `/api/v1/open-api/knowledge/{knowledge_id}` | — | 详情 |
| PATCH | `/api/v1/open-api/knowledge/{knowledge_id}` | `{visible_range*, name?, description?, org_ids?}` | 更新 |
| DELETE | `/api/v1/open-api/knowledge/{knowledge_id}` | — | 删库 |
| GET | `/api/v1/open-api/knowledge/{knowledge_id}/documents` | — | 文档列表（含 md5/status） |
| POST | `/api/v1/open-api/knowledge/{knowledge_id}/documents/upload-url` | `{file_name*, upload_type*:upload\|slice_upload, slice_size?}` | 预签名上传地址 |
| POST | `/api/v1/open-api/knowledge/{knowledge_id}/documents` | `{obj_key_list*, custom_docs_chunk?, custom_tables_chunk?}` | 创建解析任务 |
| GET | `/api/v1/open-api/knowledge/{knowledge_id}/document-tasks` | — | 解析任务列表 |
| GET | `/api/v1/open-api/knowledge/{knowledge_id}/document-tasks/{task_id}` | — | 解析状态 |
| DELETE | `/api/v1/open-api/knowledge/{knowledge_id}/documents/{doc_id}` | — | 删文档 |
| POST | `/api/v1/open-api/knowledge/{knowledge_id}/query` | `{query*, query_type?:1\|2\|3, rerank?=true, score?, topK?=10, weight?=0.5}` | 检索/问答测试 |

### 对话交互

| 方法 | 路径 | 请求要点 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/v1/open-api/conversation` | `{template_id*(专属员工/工作流 id), external_uid?, title?}` | 显式建会话 |
| POST | `/api/v1/open-api/conversation/send` | `{content*, agent_id?, conversation_id?, external_uid?, title?, files?, knowledge_query_request?, qa_knowledge_query_request?, language?, model_api_key?}` | 发消息，自动建会话，**SSE 响应**（`type=session_init` 返回 `session_id`） |
| POST | `/api/v1/open-api/conversation/{conversation_id}/send` | `{content*, files?, knowledge_query_request?, language?, model_api_key?}` | 向已有会话发消息（SSE） |
| POST | `/api/v1/open-api/conversation/upload` | multipart `file` | 上传对话附件 |
| GET | `/api/v1/open-api/conversation/list` | `limit?=50(1–100), external_uid?` | 会话列表 |
| POST | `/api/v1/open-api/conversation/{conversation_id}/stop` | — | 停止生成 |
| DELETE | `/api/v1/open-api/conversation/{conversation_id}` | — | 删会话 |
| GET | `/api/v1/open-api/conversation/{conversation_id}/detail` | — | 会话详情 + 历史消息 |
| GET | `/api/v1/open-api/conversation/{conversation_id}/result` | — | 公开结果视图（403 无权限/404 不存在） |

### 数据看板与通用 Agent

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/open-api/dashboard/overview` | 用量总览 |
| GET | `/api/v1/open-api/dashboard/model_overview` | 模型用量 |
| GET | `/api/v1/open-api/dashboard/agent_dashboard` | Agent 表现（活跃率/发布率/用户覆盖/复用） |
| POST | `/api/v1/open-api/default-agent/chat` | 启动通用 Agent 任务（HTTP 202，需 `default_agent` 权限） |
| GET | `/api/v1/open-api/default-agent/tasks/{task_id}` | 查任务状态（403 无权限/404 不存在） |

### 关键响应字段

- `KnowledgeInfoSchema`：`knowledge_id`、`name`、`visible_range`、`embed_type`、`doc_cnt`、`task_cnt`、`category`、`is_editable` 等。
- `KnowledgeDocInfoSchema`：`doc_id`、`file_name`、`file_size`、`file_status`、`task_id`、`md5`、`url`、`result`、`is_editable` 等。
- 会话：`session_id`、`title`、`status`、`external_uid`、`template_type`、`guardrail_config`、`knowledge_query_request`、`create_time` 等。
- 消息：`id`、`role`、`type`、`content`、`detail`、`timestamp`、`step_id`、`is_llm_message`、`session_id`、`response_id`、`trace_id`。
- 对话上传文件：`name`、`key`、`url`、`public_url`、`download_url`、`size`、`type`。

---

## 附录 B：与本仓库现有文档的衔接

- 工业 API 草案 `docs/04-AGENT-API.md` 描述的是工业平台内部 Agent 接口；万智接入是**官网侧的对外咨询能力**，二者独立，不互相替代。若未来工业平台也要用万智做诊断服务，需另行设计映射、权限与安全验收，超出本文范围。
- 现有「页面本地演示状态 ≠ 工业 API 状态」的说明（README §文档导航）仍然成立；接入后新增第三类状态：**万智对话会话状态**，三者需在文档中明确区分。
- 发布记录 `docs/website/RELEASE.md`：上线前必须追加本接入的部署与服务记录。

*（本文为规划草案；实施启动前请逐项确认 §11 决策点，并补记平台侧实际返回与计费信息。）*
