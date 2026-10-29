# 网页平台观察记录

`2026-10-28-web-first-turn.json` 是用户在聊天中提供的万智网页输出，保留原内容，来源标记为 **USER_REPORTED_PLATFORM_OUTPUT**；不是本地API抓取、独立复跑、实测故障标签或比赛成绩。

对应输入为上一级目录的 `evidence-package.example.json`。本地校验：JSON Schema通过；轮次、证据和查询ID均能对齐，但 **H3将E01/E02同时列为支持和反证**，未拆分支持/反证事实，按更新后的应用合同不采纳，错误为 `AMBIGUOUS_SUPPORT_AND_COUNTEREVIDENCE`。

另需人工核对的语义：电压正常不等于存在调度指令；现有两点采样不能证明时间窗内没有短时电压跌落；METER-01与BUS-B的具体测量范围也需明确。这些不能由Schema检查证明。

不得直接修改这份观察记录来伪装平台已纠正；修订提示词后要重新运行并另外保存结果。

## 2026-10-29 修订后首轮回答

新增 [2026-10-29-web-revised-first-turn.json](2026-10-29-web-revised-first-turn.json)，原样保存用户提供的第二份网页回答，仍标记为 `USER_REPORTED_PLATFORM_OUTPUT`。对应输入仍为原始 `evidence-package.example.json`。

执行现有 `backend/wanzhi.py --validate`：JSON Schema及应用语义校验均通过；summary为520个字符，低于600上限；当前事件/输入版本/轮次、候选排名、证据引用、支持/反证分离、Q01白名单及预算均符合当前合同。机器记录见 [validation.json](2026-10-29-web-revised-first-turn.validation.json)。

这说明该输出修正了此前的引用冲突，并保留模拟/候选/人工边界。它没有提供新增电压证据，因此候选顺序不变可接受；尚未验证对新证据的响应、本地真实API、重复运行稳定性或物理诊断正确性。下一步测试 `voltage-normal.input.json`、`voltage-sag.input.json`、`voltage-missing.input.json` 与无预算分支，按相应的新版本/轮次校验，不把重复原输入当补证。

## 2026-10-29 正常电压分支

[原始输出](2026-10-29-web-voltage-normal.json)按 `voltage-normal.input.json` 执行校验：Schema及现有应用规则通过，summary为508个字符，版本3及round_id正确，零预算时requested_evidence为空、状态NEEDS_HUMAN。识别了E04不是BUS-B独立测量，也未直接确认调度。

[验证记录](2026-10-29-web-voltage-normal.validation.json)将机械校验与人工解释审核分开记录。人工审核仍需修订：H3以E01为反证，但E01仅给出功率两个端点及自述质量，不能单独反驳测量链路/时间对齐异常；E04的范围不确定性本身也不证明测量链路故障。两个端点只支持同窗下降，不能证明真实变化同时发生；E02的符号约定不应直接套用其他测点。

系统提示词已增加通用约束。这里没有把新问题硬编码成“E01永远不能作反证”，因为其他输入下E01可能包含真正反证。引用事实的逻辑有效性仍需人工/独立审核，不能把Schema或ID检查当作完整诊断验证。

## 2026-10-29 电压缺失分支

[原始输出](2026-10-29-web-voltage-missing.json)按 `voltage-missing.input.json` 校验，Schema及现有应用规则通过；summary为508个字符，版本5及round_id正确，requested_evidence为空、NEEDS_HUMAN且abstain=true。[记录](2026-10-29-web-voltage-missing.validation.json)保留输入来源和机器检查结果。

本次缺失处理行为符合测试目标：未补造电压、未把missing当正常、未在零预算下再请求查询，明确两个端点不证明同时变化，未把E02的符号约定直接套到E01。这里通过的是这一份输出的缺失处理边界，不是独立根因正确率或全部分支验证。H2合并物理电压异常和测量异常，后续调查仍应区分；E04只能证明缺测，不能单独确认计量链路故障。

首阶段可进入真实API合同联调，电压跌落等剩余分支留待API运行时补测。当前本机配置检查仍显示Key、template ID、公开URL和完成事件未配置，未执行真实付费调用。
