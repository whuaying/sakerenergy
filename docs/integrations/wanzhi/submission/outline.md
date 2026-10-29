# 作品说明书 · 内容规划 outline

交付物：`2026云桥杯-SakerEnergy充储场站证据诊断助手-作品说明书.docx`（A4，5–10 页）
写作类型：专业领域文书（工程技术方案 + 项目作品说明）
目标读者：大赛评审（评委/产业专家），需可核验、可运行、边界清晰。

## 章节结构与事实依据

| 章节 | 内容 | 事实依据（项目内材料） |
| --- | --- | --- |
| 封面 | 标题、作品名、Agent ID、日期 | Agent 名/ID（已发布，用户提供） |
| 1 项目概述 | 作品定位：充储场站告警证据诊断智能体；目标、成果一句话 | README §1；真实运行结果 |
| 2 业务场景与问题 | 充储场站多设备功率异常诊断的证据链痛点；诊断合同要求（abstain/只读/人工审批） | README §2/§5；AGENT-PROMPT.md |
| 3 Agent 设计 | 万智专属员工：提示词、证据输入 schema、决策输出 schema、只读查询白名单、预算、人工核验 | AGENT-PROMPT.md、decision.schema.json、evidence-package.example.json |
| 4 系统架构与工程化 | 调用链（Next.js 大屏 → Go 任务 API → Python 适配器 → 万智 API）；SSE；合同校验；密钥管理；任务恢复 | README §3/§7/§9；wanzhi.py 工具链；50 项测试 |
| 5 真实运行证据 | 6 轮真实 API（4 合成 + 2 行业）+ 补证闭环；SSE 帧数；VALIDATED_ADVISORY；修订行为（against 反证/预算评估/转人工） | observations/*.md；backend/.private/wanzhi/runs/ |
| 6 安全与可信设计 | 只读查询、无设备控制指令、人工审批、密钥仅存服务端、数据边界声明 | README §6；AGENTS.md |
| 7 商业价值与前景 | 应用赛业务落地潜力：储能运维/充电场站诊断、跨场站复用 | README §2 |
| 8 边界声明 | 演示数据非真实遥测；万智最低要求满足情况 | 赛事官网规则；observations 记录 |

## 引用核查表

| 引用名称 | 来源 URL / 位置 | 核实状态 | 说明 |
| --- | --- | --- | --- |
| 2026云桥杯大赛官网（评审权重 30/30/25/15、截止 2026-10-30 24:00、万智最低要求） | https://yunqiao.jpx.com/cup/ | 已核实（本会话 fetch） | 应用赛权重：任务解决 30%/工程化落地 30%/实际效果 25%/业务潜力 15% |
| 万智开放 API（Base URL + 调用链） | https://www.wanzhi.com/app/api/v1/open-api | 已核实（真实调用验证） | /conversation、/send、/result、/detail |
| Agent 公开 URL（主办方确认） | https://www.wanzhi.com/studio/agent/d86bc562cb9b450b | 已核实（用户提供+主办方确认） | Agent ID d86bc562cb9b450b |
| 接入实施方案 | docs/integrations/wanzhi/README.md（仓库内） | 已核实 | 方案基线 |
| 真实运行记录（run/session/decision） | backend/.private/wanzhi/runs/（gitignore 本机） | 已核实（本会话真实调用） | 6 轮 VALIDATED_ADVISORY |
| 观察记录（422/无效Key/成功/分支/补证闭环） | docs/integrations/wanzhi/observations/2026-10-29-*.md | 已核实 | 协议与契约证据 |

## 数字口径（必须一致）

- 真实 API 轮次：6 轮全部 VALIDATED_ADVISORY（首轮合成 1 + 分支 3 + 行业首轮 1 + 行业补证第二轮 1）
- SSE 帧数（已观测）：1124 / 1087 / 1008（其余以 run 记录为准，说明书只引用已列数字）
- 本地单元测试：50 项通过
- 输入证据包 data_origin：SYNTHETIC_DEVELOPMENT_FIXTURE（演示）、INDUSTRY_DEMO_FIXTURE（行业演示，参数参照典型充储场站，非真实遥测）

## 格式要求

- A4，页边距 2.5cm；封面/目录/正文分页；正文页码从 1 起
- 动态 TOC（Heading 1–2，最多 2 级）
- 编号体系：阿拉伯小数层级（1 / 1.1 / 1.1.1）
- 字体：Title 黑体 18 加粗居中；H1 黑体 16；H2 黑体 14；H3 黑体 12；Normal 宋体 12、1.5 倍行距、首行缩进 2 字符、两端对齐；表格 10.5pt、表头浅灰 #D9D9D9、垂直居中、cantSplit + tblHeader
- 标题黑色、独立标题无句号、无下划线；表格编号"表1/表2"
- 无 emoji；占位符仅用于确需用户填写的空白
