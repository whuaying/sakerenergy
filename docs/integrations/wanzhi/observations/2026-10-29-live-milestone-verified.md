# 万智真实调用里程碑：本机文件复核

日期：2026-10-29（北京时间）。来源为本机 `backend/.private/wanzhi/runs/` 运行记录；本次只读复核，没有新增平台调用。非敏感机器清单见 [live-milestone.json](../verification/live-milestone.json)。

| 输入分支 | run_id | SSE 帧数 | 本地状态 | 输出动作 |
| --- | --- | ---: | --- | --- |
| 首轮 | dfba4f6b-d34f-404e-ab38-8cc174532acc | 1124 | VALIDATED_ADVISORY | NEEDS_EVIDENCE；请求 Q01 |
| no-budget | ddcdf391-0ecf-4a99-9d67-c2855870e028 | 698 | VALIDATED_ADVISORY | NEEDS_HUMAN；无补证请求 |
| voltage-sag | 22e16ea9-b449-42c5-bd3e-729e3eaf4c3f | 1289 | VALIDATED_ADVISORY | NEEDS_HUMAN；无补证请求 |
| voltage-missing | 7f9e498d-8342-4222-afcc-277ca240dd96 | 1137 | VALIDATED_ADVISORY | NEEDS_HUMAN；无补证请求 |

四轮均重新通过输入合同、输入 SHA-256、当前轮次 JSON Schema 和应用语义校验；每轮 `abstain=true`，并列出5项人工核验。输入与仓库对应样例除运行时 round_id/trace_id 外一致，来源均为 `SYNTHETIC_DEVELOPMENT_FIXTURE`。

本机可解密配置确认 OpenAPI Key、Agent ID、模型 Key 及 `completion_event=finish_reason` 均存在；没有打印或复制密钥。用户说明模型 Key 来自大赛发放，本次未检查发放邮件。公开分享 URL 尚未配置，编辑页地址不能替代公开分享链接。

首轮原始 receipt 的 completion_confirmed=false，后来配置终止事件后通过只读对账，run 顶层 completion_confirmed=true；清单保留这一区别。其余三轮 receipt 与顶层均为 true。复核没有改写私有原始记录。

## 证据能证明的范围

这些记录支持“真实平台对合成事件证据给出了可解析的结构化建议，本地合同校验通过”。没有运行自动 Q01 执行器，也没有证明真实遥测接入、维修闭环、诊断准确率或一等奖结果。

三个分支均遵守查询预算为零、无需继续请求补证的边界。电压缺失分支没有补造电压；电压下跌分支引用 E04 并保留测点归属与独立验证限制。以上是本轮行为检查，不能外推为模型稳定性或完整科学正确性。

人工内容仍有保留：缺失电压输出把“E02 不构成功率平衡”写为“一致性存疑”，这一推论未得到独立证据支持。非平衡样例不等于计量异常，应在下一轮提示词与内容复核中继续约束。

## 协议与提交待办

`finish_reason` 同时见于正常终止与失败响应，不能仅凭事件名判成功。当前代码没有覆盖所有嵌套失败状态的专门回归，仍需补齐；已有四轮状态仅表示现有校验器的结果。

赛事提交说明本次重新核查：2026-10-30 24:00 北京时间截止。除 PDF 说明书、MP4 视频与可访问运行的 Agent 公开 URL，还需复现补充材料及团队登记信息。来源：[作品提交说明](https://yunqiao.jpx.com/cup/resources/submission.html)、[万智使用与提交要求](https://yunqiao.jpx.com/cup/announcements/wanzhi-submission-20261016.html)。材料尚未制作或提交，公开链接尚未核验。
