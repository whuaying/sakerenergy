# 网页首轮输出之后怎样继续

用户已提供一份平台网页输出，原样记录在 [观察记录](observations/2026-10-28-web-first-turn.json)。本地校验确认：JSON Schema通过，但H3的支持和反证ID重叠，未达到应用语义门槛。它仍是一项有价值的首轮观察，不是API接通或精度证明。

## 先更新平台指令

在“高级创建”的“指令”框末尾加入下面两段，或者用更新后的 [完整提示词](AGENT-PROMPT.md) 替换原指令：

```text
同一候选的support_evidence_ids与against_evidence_ids不得重叠。若同一记录含不同方向的事实，需要先由输入侧拆成独立事实ID；未拆分时将不确定性写入missing_information，不能给同一ID双重标记。没有真正反证时返回空数组，不强行凑反证。

母线电压正常只能削弱部分供电扰动解释，不能直接证明存在EMS或调度限功率指令；电压异常也不能排除测量异常。采样点之间未观察到的瞬态不得自行补造或排除。始终把尚无独立记录支持的原因标记为待核验；第一版abstain始终为true。
```

重新发送原始 `evidence-package.example.json`，检查H3是否不再重复引用。同一ID双重标记是本应用为可审计而采用的限制，不意味着一份复杂记录在科学上永远不能包含不同方向的信息。

## 再做四个独立分支

这些输入中的补证数据全部是手工构造，**不是数据库查询结果、现场电压或诊断真值**。每个分支新开会话并粘贴整个文件；这样不同分支不会互相污染。先跑一组，在真实API接入后再测试同会话追加证据。

| 输入文件 | 所改条件 | 应检查的行为 |
| --- | --- | --- |
| [no-budget.input.json](no-budget.input.json) | 可用查询为空、剩余预算0 | 不再请求Q01，不声称已拿到电压，转人工核验。 |
| [voltage-normal.input.json](voltage-normal.input.json) | 新增E04：两个采样点均400V | 可削弱持续电压异常假设，但不能据此确认调度，也不能排除采样间瞬态。 |
| [voltage-sag.input.json](voltage-sag.input.json) | 新增E04：400V→360V | 应讨论供电扰动和测量异常，引用E04，仍需保护/独立测量等证据。 |
| [voltage-missing.input.json](voltage-missing.input.json) | 新增E04：quality=missing，无数值 | 不编造电压、不把missing当正常，保持候选并请求人工。 |

全部分支保留 `SYNTHETIC_DEVELOPMENT_FIXTURE`，轮次/版本不同，预算为0，不能请求新查询。E04明确是“站级上游电表”的示例；本输入未独立验证它等同于BUS-B支路测点，模型应说明测量范围的局限。

保存每个网页回答的原始JSON，用本机工具配对相应输入：

```powershell
backend/.venv-wanzhi/Scripts/python.exe backend/wanzhi.py --validate "正常电压回答.json" --input docs/integrations/wanzhi/voltage-normal.input.json
```

结构/语义通过也不等于物理根因正确；还需人工检查因果强度、缺失信息、量纲、测量范围和最终建议。保留失败例，不手工编辑模型回答来冒充通过。

## 最后进入真实 API

确认平台“完成创建”并取得真实Agent ID，必要时发布取得公开URL。由用户在本机执行 [LOCAL-RUN.md](LOCAL-RUN.md) 的 `--configure`；再运行只读 `--probe` 与一次 `--run`。Key不需要发给协作方。
