# 2026-10-29 真实 API 分支运行汇总

记录时间：2026-10-29 11:15（Asia/Shanghai）。来源：本机 `wanzhi.py --run --input <分支>` 真实调用，配置已持久化（`WANZHI_COMPLETION_EVENT=finish_reason`）。

## 结果（三轮全部 VALIDATED_ADVISORY、completion=true）

| 分支输入 | run_id | session_id | decision.status | abstain | 候选数 | 补证请求 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| no-budget.input.json | `ddcdf391-0ecf-4a99-9d67-c2855870e028` | `b3ed93633ed24106` | NEEDS_HUMAN | true | 2 | 0 | 查询预算 0 → 不再请求补证，直接转人工核验 |
| voltage-sag.input.json | `22e16ea9-b449-42c5-bd3e-729e3eaf4c3f` | `a77b2f735ff44247` | NEEDS_HUMAN | true | 3 | 0 | 含 E04 电压（400→360V）；模型仍 abstain，请求人工核对测点归属/量程/时间同步 |
| voltage-missing.input.json | `7f9e498d-8342-4222-afcc-277ca240dd96` | `cf66bbd4c90c48c5` | NEEDS_HUMAN | true | 3 | 0 | E04 返回 missing → 不编造电压读数，保持候选并转人工说明 Q01 空样本 |

## 结论

- 四个真实会话（首轮 `dfba4f6b…` + 本轮三分支）**全部通过本地 Schema + 语义校验**，`state=VALIDATED_ADVISORY`；
- 模型输出始终遵守合同约束：`abstain` 在证据不足时置 true、不编造缺失读数、候选引用仅限输入证据、补证请求遵守预算、转人工核验列表完整；
- 完整 run 记录（含 decision）已落盘 `backend/.private/wanzhi/runs/<run_id>.json`（gitignore，脱敏）。

## 说明

2026-10-29本机复核修正：原表将 no-budget 与 voltage-missing 的 run_id、session_id 和候选数对调，现已按原始记录 input_revision=2/5 修正；私有原始 run 文件未改写。完整范围以 [里程碑复核](2026-10-29-live-milestone-verified.md) 为准。

- voltage-sag / voltage-missing 两轮模型未请求进一步补证（req_ev=0），判定"证据不足以定论、转人工"——行为符合提示词（电压异常也不能排除测量异常；missing 不编造），且通过本地合同校验；
- 本记录不含任何真实密钥。
