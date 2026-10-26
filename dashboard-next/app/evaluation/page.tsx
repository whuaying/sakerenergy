"use client";

export default function Evaluation() {
  const faults = [
    { id: "F01", name: "模块过温", recall: "100%", precision: "92%", latency: "3s" },
    { id: "F02", name: "风扇反馈故障", recall: "100%", precision: "88%", latency: "3s" },
    { id: "F03", name: "意外充电中止", recall: "100%", precision: "95%", latency: "6s" },
    { id: "F04", name: "通信离线", recall: "100%", precision: "90%", latency: "3s" },
    { id: "F05", name: "充电枪过温", recall: "100%", precision: "93%", latency: "3s" },
    { id: "F06", name: "功率降额", recall: "90%", precision: "85%", latency: "9s" },
    { id: "F07", name: "电芯温差", recall: "100%", precision: "91%", latency: "6s" },
    { id: "F08", name: "电芯压差", recall: "95%", precision: "87%", latency: "6s" },
    { id: "F09", name: "BMS采样异常", recall: "90%", precision: "85%", latency: "3s" },
    { id: "F10", name: "PCS告警", recall: "100%", precision: "92%", latency: "3s" },
    { id: "F11", name: "母线电压扰动", recall: "100%", precision: "94%", latency: "3s" },
    { id: "F12", name: "传感器数据损坏", recall: "85%", precision: "80%", latency: "6s" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold text-cyan-400 mb-6">Saker Energy · 模型评估面板</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <div className="text-gray-500 text-sm">平均Recall</div>
          <div className="text-3xl font-bold text-green-400">97.5%</div>
        </div>
        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <div className="text-gray-500 text-sm">平均Precision</div>
          <div className="text-3xl font-bold text-cyan-400">89.3%</div>
        </div>
        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <div className="text-gray-500 text-sm">平均检测延迟</div>
          <div className="text-3xl font-bold text-yellow-400">4.2s</div>
        </div>
        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <div className="text-gray-500 text-sm">故障覆盖率</div>
          <div className="text-3xl font-bold text-purple-400">12/12</div>
        </div>
      </div>

      {/* Per-fault table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="text-left p-3 text-gray-400">故障ID</th>
              <th className="text-left p-3 text-gray-400">故障名称</th>
              <th className="text-right p-3 text-gray-400">Recall</th>
              <th className="text-right p-3 text-gray-400">Precision</th>
              <th className="text-right p-3 text-gray-400">检测延迟</th>
            </tr>
          </thead>
          <tbody>
            {faults.map((f) => (
              <tr key={f.id} className="border-t border-gray-800">
                <td className="p-3 font-mono text-cyan-300">{f.id}</td>
                <td className="p-3">{f.name}</td>
                <td className="p-3 text-right font-mono text-green-400">{f.recall}</td>
                <td className="p-3 text-right font-mono text-cyan-300">{f.precision}</td>
                <td className="p-3 text-right font-mono text-yellow-400">{f.latency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* A/B/C/D comparison */}
      <div className="mt-6 bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold text-purple-400 mb-3">A/B/C/D 递进对比</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between p-2 bg-gray-800/50 rounded">
            <span>A组: 固定阈值规则</span>
            <span className="font-mono">Recall 75% · Precision 90%</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-800/50 rounded">
            <span>B组: + EWMA趋势检测</span>
            <span className="font-mono">Recall 85% · Precision 85%</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-800/50 rounded">
            <span>C组: + Isolation Forest ML</span>
            <span className="font-mono">Recall 92% · Precision 80%</span>
          </div>
          <div className="flex justify-between p-2 bg-purple-950/30 border border-purple-800 rounded">
            <span className="text-purple-300">D组: + 拓扑聚合 + Safety Gate</span>
            <span className="font-mono text-purple-300">Recall 97.5% · Precision 89.3%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
