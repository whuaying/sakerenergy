# 04 Agent 工作流与 API 契约

## Agent 链
event.created→gather telemetry/logs/topology→time-window correlation→read-only manual RAG→rank hypotheses→Safety Gate→draft workorder→WAIT_FOR_HUMAN→human.evidence_received→revise hypotheses→simulated verification→RESOLVED/REOPENED。

Saker 每个步骤持久化 input/output hashes、trace_id、attempt、checkpoint、model/prompt版本；幂等键 tenant_id:event_id:step:version。收到重复人工反馈不重复建单。

## 允许工具
read_telemetry, read_alarm, read_topology, search_manual, search_fault_tree, propose_workorder, submit_human_observation, verify_recovery。**没有任何 real-device-control 工具授权给 LLM**。

## Safety Gate 判定
ALLOW_READ、ALLOW_DRAFT、NEEDS_HUMAN、NEEDS_MORE_EVIDENCE、BLOCKED；硬策略先于自然语言推理。校验身份与租户、证据充足度、检索可信源、不可执行危险动作、Schema与工单人工审批。

## REST草案
GET /api/v1/sites/{site}/overview
GET /api/v1/sites/{site}/telemetry?from=&to=&devices=
GET /api/v1/events?site_id=&status=
GET /api/v1/events/{id}/diagnosis
POST /api/v1/sim/scenarios/{id}/run (simulator role + sandbox only)
POST /api/v1/workorders (draft or approved by human)
POST /api/v1/workorders/{id}/observations
POST /api/v1/events/{id}/verify
GET /api/v1/events/{id}/audit

写请求要求 Idempotency-Key；错误使用 400 INVALID_INPUT、403 FORBIDDEN、409 INVALID_TRANSITION、422 INSUFFICIENT_EVIDENCE、503 DEPENDENCY_UNAVAILABLE。

## 事件推送
SSE: telemetry.update, alarm.created, diagnosis.updated, workorder.updated, safety.denied, verification.finished。支持断线 Last-Event-ID 恢复。

## 失败处理
模型不可用退回规则+人工工单；知识缺失拒绝确定性根因；数据质量差保守标记；等待维修人员数小时或数日后恢复上下文而不占有计算资源。
