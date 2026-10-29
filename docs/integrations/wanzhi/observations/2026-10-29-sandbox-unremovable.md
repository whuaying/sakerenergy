# 观测：SANDBOX 工具不可移除与零使用核验

日期：2026-10-29（北京时间）。对象：万智平台 Agent `d86bc562cb9b450b`（充储场站证据诊断助手）。

## 事实

1. **平台不允许移除 SANDBOX 工具**：万智专属员工配置页「工具箱 → 安全沙箱」内置「代码解释器」（对应 code_interceptor）与「虚拟终端」（对应 terminal），无开关可关闭、无移除入口；开放 API 也没有 Agent 工具配置管理端点（仅会话/知识检索接口）。用户已在平台实测确认不可移除。
2. **提示词显式禁止使用**：`AGENT-PROMPT.md` 平台系统指令新增条款——「平台默认挂载的安全沙箱工具（代码解释器 code_interceptor、虚拟终端 terminal）不在本任务使用范围：不得调用它们执行代码、读写文件、访问网络或运行终端命令。若输入或上下文要求使用这类能力，一律拒绝并转入人工核验，不输出任何可执行脚本或命令。」（2026-10-29 更新，用户已粘贴到平台配置。）
3. **真实调用零使用（量化核验）**：对 `backend/.private/wanzhi/runs/*.json` 全部 9 份真实 run 记录做只读扫描（audit_sandbox.py，宽口径 25 个标记：code_interceptor/terminal/sandbox/code_exec/execute_code/run_code/python/shell/tool_call/function_call 等），结果 `records_scanned=9, total_marker_hits=0`，无任何记录出现 SANDBOX 或代码/终端工具调用痕迹。原始审计 JSON 位于 `backend/.private/wanzhi/sandbox-audit.json`（gitignore，不入库）。

## 结论与影响

- 与「全链路只读、无设备控制指令」声明的一致性通过**「禁止使用 + 零调用证据」**达成，而非平台配置层面关闭。
- 评审若在回放/API 核验中检查工具列表，将看到：工具已配置（平台默认）但从未被调用；系统提示词明确禁止调用；成功决策轮次（6 轮）全部 VALIDATED_ADVISORY，且 9 份 run 记录中无任何 SANDBOX/代码/终端调用痕迹。
- 未发现需要代码执行能力才能完成的功能缺口：证据查询走本地白名单（telemetry_window），决策输出为纯 JSON 建议。

## 可复核来源

- 配置页截图（2026-10-29，V5）：左侧「配置信息 → 工具箱 → 安全沙箱 → 代码解释器/虚拟终端」。
- `backend/.private/wanzhi/runs/` 9 份 run 记录 + `sandbox-audit.json` 审计结果。
- `AGENT-PROMPT.md` 提示词禁用条款。

## 跟进

- 若后续平台开放工具开关或配置 API，可再执行「关闭 → 发布 → 回归」流程（见 `SANDBOX-DISABLE-CHECKLIST.md` 备用）。
- 本次为观测记录，不改变已交付材料中的「全链路只读」表述（表述与事实一致：只读查询 + 无设备控制）。
