# P0：SANDBOX 工具处置（提交前安全边界）

更新：2026-10-29（北京时间）。**结论：平台不允许移除 SANDBOX 工具（代码解释器 code_interceptor / 虚拟终端 terminal 为内置项，无开关、无移除入口；开放 API 无工具配置端点）。P0 已转为替代方案执行，详见 [observations/2026-10-29-sandbox-unremovable.md](observations/2026-10-29-sandbox-unremovable.md)：提示词显式禁止使用 + 9 份真实 run 记录零调用核验（sandbox-audit.json）。**

本文件以下内容保留为「平台开放关闭能力后的备用流程」。

## 现状证据

`observations/2026-10-29-live-send-model-key-invalid.md` 实测 `detail` 响应：`agent_tool_info` 显示当前 Agent 带 SANDBOX 工具 `code_interceptor` / `terminal`，**未禁用**；`guardrail_config.enabled=true`。

对照项目声明（README / 作品说明书 / 演示视频）：全链路只读、白名单查询 `telemetry_window`、不含设备控制指令。SANDBOX 工具与上述声明矛盾，属评审可见的扣分风险项。

## 平台操作步骤（需在万智平台完成，约 10 分钟）

1. 打开 Agent 配置页：`https://www.wanzhi.com/studio/agent/d86bc562cb9b450b`（当前已发布版本 3）。
2. 进入「高级配置 / 工具」区域，找到内置工具列表中的 **SANDBOX（code_interceptor）** 与 **SANDBOX（terminal）**。
3. 逐个**关闭/移除**这两个工具（不要替换为其他可执行工具；保留只读相关能力即可）。
4. 保存配置，重新**发布**（发布渠道保持「API」开启，否则公开 URL 失效）。
5. 发布成功后，在「发布结果」处确认 API 地址与 Agent ID 未变（应为 `d86bc562cb9b450b`），公开 URL 仍为 `https://www.wanzhi.com/studio/agent/d86bc562cb9b450b`。

> 若页面未直接展示工具开关，请在该 Agent 详情页的「工具」或「高级设置」下查找；禁用选项名称以平台实际页面为准。禁用后无需改动本地代码。

## 回归验证（禁用后执行，本机）

在项目根执行（一次性真实调用，会消耗一次模型配额）：

```powershell
E:\saker-energy-main\backend\.venv-wanzhi\Scripts\python.exe E:\saker-energy-main\backend\wanzhi.py --run --input docs/integrations/wanzhi/industry-demo.input.json
```

验证标准：

1. 退出码 0，输出 `VALIDATED_ADVISORY`（决策通过 Schema + 语义校验）。
2. 新 run 记录写入 `backend/.private/wanzhi/runs/<uuid>.json`，`agent_tool_info` 中 **SANDBOX 工具不再出现**（或状态为已禁用）。
3. 决策内容与基线可比：候选结构（H1/H2/H3）、`abstain=true`、请求 Q01 补证——与 `6094ff82`（行业首轮，1087 帧）口径一致；不应出现引用不存在的证据或越权查询。
4. 将本次回归结果追加到 `observations/`，注明「SANDBOX 已禁用后的回归」。

## 回滚

若回归异常（决策不合格 / 校验失败 / 工具仍显示启用）：

1. 在平台恢复这两个工具并重新发布；
2. 用 `--resume <run_id>` 对账（只读，不重发）；
3. 在观测记录中如实说明失败与恢复，不隐藏。

## 完成后更新

- 本文件标记「已执行」并记录回归 run_id；
- `README.md` 页首状态补一句「SANDBOX 已禁用，回归 VALIDATED_ADVISORY」；
- GitHub 提交推送。
