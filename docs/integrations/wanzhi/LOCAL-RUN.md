# 本机配置与首轮 API 联调

这是第一阶段联调工具，尚未接大屏、任务队列、真实设备或生产工单。2026-10-29已复核四轮真实 API 记录，输入均为合成开发样例；详见 [里程碑记录](observations/2026-10-29-live-milestone-verified.md)。网页平台成功回答本身不等于本地 API 已接通。

## 1. 准备隔离 Python 环境

在 PowerShell 的 `E:\saker-energy-main` 下执行。当前工作区已安装隔离环境；新机器需要前两条命令：

```powershell
python -m venv backend/.venv-wanzhi
backend/.venv-wanzhi/Scripts/python.exe -m pip install -r backend/integrations/requirements.lock.txt
backend/.venv-wanzhi/Scripts/python.exe -m unittest discover -s backend/tests -p "test_wanzhi*.py" -v
```

测试只使用隔离 fixture 和假传输，不联网、不使用真实 Key，也不证明平台诊断正确。

## 2. 用户在本机输入 Key

### 推荐：本机弹窗，粘贴一次

双击仓库根目录的 [configure-wanzhi.cmd](../../../configure-wanzhi.cmd)，打开本机配置窗口。

1. 从万智 OpenAPI Key 管理页面复制完整 Key，粘贴到密码框。
2. 点击“保存并检查”。Agent ID 与页面地址自动保留；通常无需打开“更多设置”。
3. 查看窗口结果：“已加密保存”表示本机保存完成；“知识库只读接口检查通过”才表示这项接口检查成功。它仍不证明 Agent 会话调用成功。

窗口只显示字符数量和圆点，不打印密钥；保存成功后清空输入框。检查在后台线程运行，窗口不会因网络等待卡住；不自动创建会话、发送证据或执行设备操作。可选 Model API Key 位于“更多设置”，留空保留原值。若平台返回权限或网络错误，窗口会区分说明，不能一概判定 Key 输入错误。

本机窗口使用同一份 Windows DPAPI 加密配置，不通过浏览器上传或另开本机 HTTP 服务。下方隐藏终端方式保留为备用。

### 备用：终端录入

2026-10-29录入修复：工具现在要求两次隐藏输入一致，并拒绝控制字符、空格和非ASCII字符。隐藏输入时不显示星号；若Ctrl+V没有正常粘贴，可用终端右键粘贴。错误输入不保存。Agent ID和页面地址有默认值时可直接回车保留。可选Model API Key也改为隐藏输入，留空保留现有模型Key或跳过，不把它与OpenAPI Key混淆。

先完成 [CREATE-AGENT.md](CREATE-AGENT.md)。然后由你在自己的交互终端执行：

```powershell
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --configure
```

按提示输入新 OpenAPI Key（不回显），Agent/工作流 ID，以及可选公开链接。尚未取得ID时可先留空，稍后重新配置。脚本用 Windows DPAPI 绑定当前用户加密保存到 `backend/.private/wanzhi/config.json`；该路径已被 Git 忽略。加密不防御同一已登录 Windows 用户权限下的恶意程序。

非 Windows 服务可通过 `WANZHI_OPENAPI_KEY`、`WANZHI_TEMPLATE_ID` 和 `WANZHI_AGENT_PUBLIC_URL` 环境变量配置，Key不写在命令参数中。不需要在聊天里提交 Key，也不要用截图证明 Key 已录入。

```powershell
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --check
```

只打印配置存在与否，不打印密钥。`live_call_verified=false` 在这项检查中恒为false，因为配置存在不证明调用成功。

## 3. 先离线验证网页回答

将平台输出的纯JSON保存在本机文件（不要包含密钥），执行：

```powershell
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --validate "回答文件.json" --input docs/integrations/wanzhi/evidence-package.example.json
```

检查JSON Schema、事件与轮次、来源、排名、证据ID、补证白名单/预算，以及同候选的支持/反证引用冲突。不验证自然语言诊断的科学正确性，也不能证明模型没有执行平台默认工具。

## 4. 鉴权与真实会话

可先做只读知识库接口探针（权限错误不等于Key无效，仍需看资源授权）：

```powershell
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --probe
```

取得真实 Agent ID 后，再执行一次真实会话；它会向万智发送手工构造的合成证据包，可能消耗账户额度：

```powershell
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --run
```

每次生成新的round_id/trace_id，创建会话前落盘调用意图，取得session_id后立即保存，发送前再次落盘。记录位于本机私有目录，页面和Git均不读取。控制台显示run_id，后续可只读查询结果：

```powershell
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --resume "控制台返回的run_id"
```

`--resume`只做GET对账，绝不重发创建/对话；创建超时且没有session_id时需要人工查平台对账。可用 `--run --run-id <UUID>` 指定本地幂等标识，重复标识直接拒绝，不再发起远端请求。跨不同run_id的重复提交没有自动去重，本工具不是最终多用户任务队列。

## 5. 平台协议尚待验证

2026-10-29实测补充：本机已保存 `completion_event=finish_reason`，四轮结构化结果已通过现有校验。该事件也见于失败响应，不能只凭名称判成功；嵌套失败状态的专门回归仍待补齐。以下为工具保留的未知协议处理原则。

HTML 未完整定义SSE终止事件。本工具解析事件边界、UTF-8、空行、多行data、错误和截断，输出观察到的event_types；**未知终止协议时即使拿到合法JSON，也只标记 NEEDS_PROTOCOL_CONFIRMATION**。

只有拿到正式文档或实际已确认的终止事件后，才配置 `WANZHI_COMPLETION_EVENT` 为该事件类型（不预填猜测值）。已有一次完整流的receipt可以在配置后用`--resume`对账，不需要重复发送。终止事件本身仍不能替代当前轮次JSON和证据引用校验。

网络采用标准库HTTPS、固定万智域名和证书验证，拒绝自动重定向；请求不盲重试。单次阻塞读/连接超时30秒、流式总期限180秒（检查在读取间进行，最多再受一次30秒阻塞读限制），响应总大小2MiB、单行64KiB。网络超时可能意味着远端已经收到任务，不能立即重新发送。

本阶段CLI只接受合成开发fixture，不自动执行Q01，也不写工单。主动补证执行器、数据库事件快照、身份/租户控制和大屏要在真实API合同确认后进入下一阶段。
