"use client";

import { useState } from "react";

export default function MobileWorkOrder() {
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState("");

  const steps = [
    { title: "收到告警", content: "CP-07 模块过温告警，温度72°C" },
    { title: "诊断建议", content: "候选根因: 散热链路故障\n下一步: 检查风扇供电和风道" },
    { title: "现场反馈", content: "风扇供电正常，风道有积尘" },
    { title: "复测归档", content: "清理风道后温度恢复正常，工单关闭" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex justify-center">
      {/* Phone frame */}
      <div className="w-full max-w-sm bg-gray-900 min-h-screen border-x border-gray-800">
        {/* Header */}
        <div className="bg-gray-800 p-4 sticky top-0">
          <div className="text-cyan-400 font-bold text-center">运维工单</div>
          <div className="text-xs text-gray-500 text-center mt-1">#WO-001 · 高优先级</div>
        </div>

        {/* Progress */}
        <div className="p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            {steps.map((s, i) => (
              <span key={i} className={i <= step ? "text-cyan-400" : ""}>
                {i + 1}
              </span>
            ))}
          </div>
          <div className="h-1 bg-gray-800 rounded">
            <div className="h-full bg-cyan-500 rounded transition-all" style={{ width: `${(step / (steps.length - 1)) * 100}%` }}></div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-yellow-400 font-medium mb-2">{steps[step].title}</h3>
            <p className="text-sm text-gray-300 whitespace-pre-line">{steps[step].content}</p>
          </div>

          {step === 2 && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-2">填写现场反馈</h3>
              <textarea
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="记录检查结果..."
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 bg-gray-700 py-3 rounded text-sm"
              >
                上一步
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 bg-cyan-600 py-3 rounded text-sm font-medium"
              >
                下一步
              </button>
            ) : (
              <button className="flex-1 bg-green-600 py-3 rounded text-sm font-medium">
                ✓ 关闭工单
              </button>
            )}
          </div>
        </div>

        {/* Safety note */}
        <div className="p-4 mt-4">
          <div className="bg-red-950/50 border border-red-800 rounded p-3 text-xs text-red-300">
            ⚠️ 安全提示: AI系统不直接控制设备。任何停机/合闸操作需由有资质人员手动执行。
          </div>
        </div>
      </div>
    </div>
  );
}
