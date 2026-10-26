"use client";

export default function Compare() {
  const dimensions = [
    { dim: "充储一体监控", saker: "✅ 充电桩+储能+PCS统一拓扑", scada: "❌ 仅充电桩", aiops: "⚠️ 通用，需定制" },
    { dim: "可解释诊断", saker: "✅ Top3根因+证据链+检查清单", scada: "❌ 仅告警码", aiops: "⚠️ 黑盒预测" },
    { dim: "多层检测", saker: "✅ 规则+EWMA+Isolation Forest", scada: "❌ 固定阈值", aiops: "✅ ML模型" },
    { dim: "边云协同", saker: "✅ 边缘实时+云端深度分析", scada: "❌ 本地集中式", aiops: "⚠️ 云端为主" },
    { dim: "安全设计", saker: "✅ Safety Gate硬阻断+只读架构", scada: "⚠️ 依赖权限", aiops: "❌ 无专门设计" },
    { dim: "断网可用", saker: "✅ 边缘独立运行+本地缓存", scada: "✅ 本地运行", aiops: "❌ 依赖云端" },
    { dim: "工单闭环", saker: "✅ 状态机+审批+复测+归档", scada: "⚠️ 需第三方", aiops: "❌ 无" },
    { dim: "部署成本", saker: "✅ Docker Compose一键起", scada: "❌ 重型硬件", aiops: "⚠️ 需GPU" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold text-cyan-400 mb-6">Saker Energy · 竞品对比</h1>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="text-left p-3 text-gray-400">对比维度</th>
              <th className="text-left p-3 text-cyan-400">Saker Energy</th>
              <th className="text-left p-3 text-gray-400">传统SCADA</th>
              <th className="text-left p-3 text-gray-400">通用AIOps平台</th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((d, i) => (
              <tr key={i} className="border-t border-gray-800">
                <td className="p-3 font-medium">{d.dim}</td>
                <td className="p-3 text-green-400">{d.saker}</td>
                <td className="p-3 text-gray-400">{d.scada}</td>
                <td className="p-3 text-gray-400">{d.aiops}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-800 rounded-lg p-4">
        <h3 className="text-cyan-300 font-bold mb-2">核心差异化</h3>
        <p className="text-sm text-gray-300">
          Saker Energy 不是通用AIOps套壳，也不是传统SCADA升级。
          我们是<b className="text-cyan-300">面向充储一体场站的专用运维AI</b>：
          懂充电协议、懂BMS、懂PCS，同时保持工业级安全设计和边云协同架构。
        </p>
      </div>
    </div>
  );
}
