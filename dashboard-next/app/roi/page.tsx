"use client";

import { useState } from "react";

export default function ROICalculator() {
  const [chargers, setChargers] = useState(12);
  const [faultRate, setFaultRate] = useState(2);
  const [techCost, setTechCost] = useState(800);
  const [downTimeCost, setDownTimeCost] = useState(2000);

  const calculate = () => {
    // Monthly faults without AI
    const faultsPerMonth = chargers * faultRate * 0.1; // 10% of chargers have faults per month
    // Current: 4 hours per fault response
    const currentHours = faultsPerMonth * 4;
    const currentCost = currentHours * techCost / 8 + faultsPerMonth * downTimeCost;

    // With AI: response time 30 min
    const aiHours = faultsPerMonth * 0.5;
    const aiCost = aiHours * techCost / 8 + faultsPerMonth * downTimeCost * 0.3;

    const monthlySaving = currentCost - aiCost;
    const yearlySaving = monthlySaving * 12;

    return {
      faultsPerMonth: faultsPerMonth.toFixed(1),
      currentCost: Math.round(currentCost),
      aiCost: Math.round(aiCost),
      monthlySaving: Math.round(monthlySaving),
      yearlySaving: Math.round(yearlySaving),
      responseImprovement: "87.5%",
    };
  };

  const r = calculate();

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold text-cyan-400 mb-6">Saker Energy · ROI 商业测算</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 text-gray-300">场站参数</h2>

          <label className="block mb-4">
            <span className="text-sm text-gray-400">充电桩数量: {chargers}台</span>
            <input type="range" min="4" max="50" value={chargers}
              onChange={(e) => setChargers(+e.target.value)}
              className="w-full mt-2" />
          </label>

          <label className="block mb-4">
            <span className="text-sm text-gray-400">月均故障率: {faultRate}次/台</span>
            <input type="range" min="0.5" max="5" step="0.5" value={faultRate}
              onChange={(e) => setFaultRate(+e.target.value)}
              className="w-full mt-2" />
          </label>

          <label className="block mb-4">
            <span className="text-sm text-gray-400">运维人员日成本: {techCost}元/天</span>
            <input type="range" min="400" max="2000" step="100" value={techCost}
              onChange={(e) => setTechCost(+e.target.value)}
              className="w-full mt-2" />
          </label>

          <label className="block">
            <span className="text-sm text-gray-400">单次停机损失: {downTimeCost}元</span>
            <input type="range" min="500" max="10000" step="500" value={downTimeCost}
              onChange={(e) => setDownTimeCost(+e.target.value)}
              className="w-full mt-2" />
          </label>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
            <div className="text-gray-500 text-sm">月均故障次数</div>
            <div className="text-3xl font-bold text-yellow-400">{r.faultsPerMonth} 次</div>
          </div>

          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
            <div className="text-gray-500 text-sm">传统运维月成本</div>
            <div className="text-3xl font-bold text-red-400">¥{r.currentCost.toLocaleString()}</div>
          </div>

          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
            <div className="text-gray-500 text-sm">Saker AI 运维月成本</div>
            <div className="text-3xl font-bold text-green-400">¥{r.aiCost.toLocaleString()}</div>
          </div>

          <div className="bg-gradient-to-r from-cyan-900 to-blue-900 rounded-lg p-5 border border-cyan-700">
            <div className="text-cyan-200 text-sm">预计年节省</div>
            <div className="text-4xl font-bold text-cyan-300">¥{r.yearlySaving.toLocaleString()}</div>
            <div className="text-cyan-400 text-sm mt-1">故障响应时间缩短 {r.responseImprovement}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
