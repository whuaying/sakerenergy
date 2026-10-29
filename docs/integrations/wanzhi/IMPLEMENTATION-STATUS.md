# 万智接入第一阶段实际状态

## 最新状态：2026-10-29 提交前（官方截止 2026-10-30 24:00 北京时间）

以下为本阶段最终状态；下文的较早记录只适用于当时，不再代表当前事实。

- **真实万智 API 补证闭环已实现并验证**：`--run` / `--followup` 双轮（run `6094ff82` / `c1b6bccc`，同一 session `8f8b1405cefe45c7`，SSE 1087 / 1008 帧，input_revision=2），决策均为 `VALIDATED_ADVISORY`；累计 6 轮真实调用全部通过本地 Schema + 语义合同校验（详见 `observations/2026-10-29-live-followup-loop.md` 等）。
- **大屏最小集成 demo 已上线**：`web/pages/evidence-demo.html`（站点 9 页，`npm run check` 通过；`npm test` 7 项通过）。
- **作品材料已交付**：说明书 PDF、演示 MP4（4:25，解码 0 错误，9 帧验收，`submission/VIDEO-DELIVERY.md`）、公开 Agent URL（`d86bc562cb9b450b`，主办方确认口径）。
- **测试**：后端 55 项离线测试通过；交付物（视频/说明书）按分镜冻结保留 50 项口径并注明演进。
- **P0 待办**：SANDBOX 工具（code_interceptor / terminal）禁用 + 禁用后回归，见 [SANDBOX-DISABLE-CHECKLIST.md](SANDBOX-DISABLE-CHECKLIST.md)。


已直接读取本机私有 run 记录并重新执行输入合同、输入哈希、JSON Schema 和应用语义校验：首轮、no-budget、voltage-sag、voltage-missing 四轮均为 `VALIDATED_ADVISORY`。详细非敏感清单见 [verification/live-milestone.json](verification/live-milestone.json)，分支说明见 [observations/2026-10-29-live-milestone-verified.md](observations/2026-10-29-live-milestone-verified.md)。本次复核只读本地文件，没有重复发送或增加付费调用。

本机可解密配置中 OpenAPI Key、Agent ID、模型 Key 和 `completion_event=finish_reason` 均已存在；公开分享 URL 尚未配置。配置存在性工具中的 `live_call_verified=false` 固定表示该工具不验证运行，不能覆盖真实 run 的成功证据。GUI 曾出现知识库接口 401，不能据此推翻后来完成的会话 API 成功，也不能据此认定知识库权限已通过。

这些是**真实平台处理合成开发输入**的工程证据，不是现场测量或根因准确率验证。尚未实现自动执行 Q01、全链路大屏或生产工单。终止事件名称也见于失败响应；仍需补齐失败状态字段的专门回归，不能仅凭事件名称判成功。

## 较早记录：2026-10-29 本机弹窗录入

针对用户反馈隐藏终端粘贴仍不便，新增 `configure-wanzhi.cmd` 双击入口与 Tkinter 本机密码框。粘贴一次即可加密保存并做知识库只读探针，自动保留 Agent 信息，可选模型 Key 留空保留原值；非法输入不覆盖旧配置，不显示详细异常或密钥。后台线程避免界面卡住，并禁止检查过程中的重复提交。没有自动创建 Agent 会话或发送诊断任务。

50 项离线测试通过，新增覆盖假密钥 DPAPI 加密往返、模型密钥保留、非法字符拒绝且旧文件不变、平台失败不泄漏异常、单次粘贴/防重复提交/清空密码框，以及已有坏密钥不阻塞打开窗口。测试中的平台响应均为替身。新的真实 Key 尚待用户在弹窗输入，不能提前宣称真实 API 鉴权或 Agent 对话通过。

以下为此前各阶段记录；较早的“未配置/未调用”描述只适用于当时。本阶段操作入口以 [LOCAL-RUN.md](LOCAL-RUN.md) 的本机弹窗为准。

记录日期：2026-10-28（日本时间）。目标顺序：Agent配置 → 真实API会话 → 本地任务/主动补证 → 大屏。不能将网页预览成功替代API联通。

2026-10-29（北京时间）追加：用户提供的修订网页输出已通过现有Schema及应用语义校验，修复了首份输出的支持/反证引用冲突。原文和校验记录保存在 `observations/2026-10-29-web-revised-first-turn*`。本地真实API状态仍未验证；下一步是新增证据与无预算分支测试。

同日追加：正常电压输出的机械校验通过，但人工反证解释审核仍有保留；电压缺失输出通过机械校验及本次缺失处理行为核对。可推进真实API合同联调，剩余分支不能预先标为通过。本机再次检查：Key、Agent模板ID、公开URL、完成事件均未配置，尚未调用平台。

同日后续联调：用户截图显示发布成功，页面地址为 `https://www.wanzhi.com/studio/agent/d86bc562cb9b450b`。地址标识已填入本机template配置，公开访客可运行性及API接受该ID仍未验证。本机已有Key记录，但安全格式检查发现其中存在控制字符；只读知识库探针无鉴权时401、有鉴权时400（Bad Request），尚不能证明Key有效。工具已增加非法字符拒绝、双次隐藏录入确认和注册信息保留，并将并行代码中的可选模型Key输入改为隐藏。新增检查后45项离线测试通过；需要用户重新在本机录入，再验证真实鉴权，当前没有真实Agent会话成功结论。

## 已完成

- 根据用户的高级创建/对话式创建截图，准备字段内容、完整提示词、测试输入和公开链接核验步骤。
- Python应用OpenAPI客户端：指定Agent创建会话、发送消息、读取结果/历史、停止、知识库只读探针；固定域名，拒绝自动重定向，错误信息脱敏，不盲重试POST。
- 流式边界解析与响应大小/读取超时限制；未确认终止协议时不声称完成。
- JSON Schema与应用语义校验：轮次/事件一致、来源、证据引用、候选排名、预算、查询白名单、支持/反证冲突和辅助判断边界。
- 本机交互配置工具：Key不回显，Windows DPAPI绑定当前用户加密保存；环境变量也可供服务使用。只读检查不泄露Key。
- 私有run_id检查点：调用意图与session_id落盘，同run_id不重复创建，只读resume不会重发。
- 保留用户提供的网页输出为 `USER_REPORTED_PLATFORM_OUTPUT`；原文不改写。其JSON Schema通过，因H3引用冲突被语义校验拒绝。
- 提示词新增支持/反证不重叠、电压证据不能单独证明调度等约束；四个后续测试fixture全部明确标为手工合成。
- 私有目录、隔离环境、Python缓存、环境文件及用户账户网页快照已加入Git忽略。

## 实际验证

41项离线unittest通过，包括本机DPAPI假凭据往返验证。网络与平台响应均为测试替身，不使用真实Key、不产生真实Agent任务。详细机器记录见 [verification/offline-tests.json](verification/offline-tests.json)。

命令：

```powershell
backend/.venv-wanzhi/Scripts/python.exe -m unittest discover -s backend/tests -p "test_wanzhi.py" -v
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --check
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --validate docs/integrations/wanzhi/decision.example.json
```

最后一次配置存在性检查：Key、Agent ID、公开URL、已确认的完成事件均未在本机配置；没有输出或读取用户在聊天中曾展示的旧Key。新版Key由用户保管，工具未获其本机配置。

## 尚未完成

- 用户账户内Agent是否已“完成创建”和公开发布尚未独立核验；已有的是用户贴出的网页回答。
- 无真实会话API鉴权、额度、SSE终止协议和模型版本联调证据。普通网络探针失败也不能认定万智平台本身不可用。
- 尚未向真实平台执行本机 `--probe` 或 `--run`，没有生成实时API成功指标。
- 尚未实现数据库任务队列、Go新增任务路由、自动Q01查询、工单操作和Next.js大屏。按原定顺序，等真实会话合同确认后再推进。
- 本工具不提供多用户/多租户服务；私有文件检查点不是生产级任务编排，也不证明现场根因准确性。
- 未修改或发布Render官网，未上传本次账户网页快照，未推送这一阶段的代码到GitHub。

## 用户下一步

先更新平台提示词并复跑原始输入，再做 [FOLLOWUP-TESTS.md](FOLLOWUP-TESTS.md) 中的无预算/电压分支测试。取得平台真实Agent/工作流ID后，在本机执行 `--configure`，再进行一次真实 `--run`。需要记录的是ID、公开URL与非敏感响应合同，不是密钥内容。
