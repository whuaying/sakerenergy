# 观测：V7 提示词 + 知识库绑定后全分支回归

日期：2026-10-29（北京时间）。对象：万智平台 Agent `d86bc562cb9b450b`（已发布 V7）。

## 触发

用户更新平台系统提示词（含 SANDBOX 禁用条款，见 `AGENT-PROMPT.md`），并在知识工厂上传 `data/fault_catalog.csv` 创建知识库并绑定到 Agent。随后在 V7 上执行三分支真实回归。

## 回归结果（V7，全部 VALIDATED_ADVISORY）

| fixture | run_id | session_id | SSE 帧 | 决策要点 |
| --- | --- | --- | --- | --- |
| industry-demo（行业场景） | 9d7be9f1-58f7-43ac-9b52-50473598070e | b0395114cf454bc5 | 959 | NEEDS_EVIDENCE、abstain=true、H1/H2/H3、请求 Q01 只读补证、6 项人工核验 |
| voltage-missing（电压缺失） | d27ba99c-3eb1-42ce-9ad7-59ba337aabfa | f12ccafcc7d4453c | 1368 | NEEDS_HUMAN、abstain=true、E04 quality=missing 正确判定、预算 0 不请求补证 |
| no-budget（预算耗尽） | 59391364-28c2-4c32-b765-b92746b63346 | e4b7773dbf50428e | 888 | NEEDS_HUMAN、abstain=true、budget=0 收敛人工 |

三支决策内容与基线口径一致（候选结构、abstain 规则、Q01 区分逻辑、人工核验清单），新提示词未引入行为回归。

## detail 只读核验（session b0395114cf454bc5）

- `agent_tool_info`：SANDBOX `code_interceptor_196273f346ea2738` / `terminal_196273f346ea2738` 仍为平台内置项（不可移除，符合观测 2026-10-29-sandbox-unremovable）。
- `knowledge_query_request`：**已绑定知识库** `knowledge_ids=["b16a69bb"]`，kb_names=「原始工业产品计划基线文件」，kb_descriptions=「内容为故障目录 fault_id/domain/scenario/expected_hypothesis/human_check 五列」，topK=5、query_type=1、rerank=false——即 `data/fault_catalog.csv` 已建库并绑定到 Agent。
- `version=7`（create 21:38:03，update 21:38:36）；`guardrail_config.enabled=true`。
- 三轮回归会话中未触发 knowledge_query（输入协议未请求知识检索；评审实测时若触发，回放可见知识库检索调用）。

## 结论

- 新提示词 + 知识库绑定后的 V7：三分支真实回归全部 VALIDATED_ADVISORY，无行为回归。
- 评审视角：公开 URL 实测将运行 V7——系统提示词明确禁止 SANDBOX 工具、知识库已绑定（评审可看到知识库名与检索配置）、工具调用记录可回放核验。
- 交付材料（PDF/MP4）冻结口径不受影响（视频基于此前版本行为录制，声明为当时版本演示）。

## 可复核来源

- run 记录：`backend/.private/wanzhi/runs/9d7be9f1…`、`d27ba99c…`、`59391364…`（gitignore）。
- detail 探针脚本：`backend/.private/wanzhi/probe_detail.py`（gitignore）。
- `data/fault_catalog.csv`（787 字节，5 列故障目录）。
