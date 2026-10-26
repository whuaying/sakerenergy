"use client";

import { useState } from "react";

const FAULTS = [
  { id: "F01", code: "module_over_temperature", name: "模块过温", device: "CP-07", domain: "充电桩" },
  { id: "F02", code: "fan_feedback_failure", name: "风扇反馈故障", device: "CP-05", domain: "充电桩" },
  { id: "F03", code: "unexpected_charge_abort", name: "意外充电中止", device: "CP-03", domain: "充电桩" },
  { id: "F04", code: "communication_offline", name: "通信离线", device: "CP-09", domain: "充电桩" },
  { id: "F05", code: "connector_over_temp", name: "充电枪过温", device: "CP-11", domain: "充电桩" },
  { id: "F06", code: "power_derating", name: "功率降额", device: "CP-05~08", domain: "充电桩" },
  { id: "F07", code: "cell_temperature_spread", name: "电芯温差", device: "BESS-01", domain: "储能" },
  { id: "F08", code: "cell_voltage_spread", name: "电芯压差", device: "BESS-01", domain: "储能" },
  { id: "F09", code: "bms_sampling_anomaly", name: "BMS采样异常", device: "BESS-01", domain: "储能" },
  { id: "F10", code: "pcs_alarm", name: "PCS告警", device: "PCS-01", domain: "储能" },
  { id: "F11", code: "grid_voltage_disturb", name: "母线电压扰动", device: "METER-01", domain: "电网" },
  { id: "F12", code: "sensor_corruption", name: "传感器数据损坏", device: "METER-01", domain: "电网" },
];

export default function InjectConsole() {
  const [activeFault, setActiveFault] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string>("");

  const inject = async (fault: typeof FAULTS[0]) => {
    setActiveFault(fault.id);
    setLastAction(`已注入 ${fault.id} ${fault.name} → ${fault.device}`);
    // In production this calls the backend inject API
    console.log(`Injecting fault: ${fault.code}`);
  };

  const reset = () => {
    setActiveFault(null);
    setLastAction("已重置为正常工况");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold text-red-400 mb-2">Saker Energy · 故障注入控制台</h1>
      <p className="text-gray-500 text-sm mb-6">点击按钮注入故障，观察检测→诊断→工单全流程</p>

      {lastAction && (
        <div className="mb-6 p-4 bg-green-950/50 border border-green-700 rounded-lg">
          <span className="text-green-400 font-medium">✓ {lastAction}</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {FAULTS.map((f) => (
          <button
            key={f.id}
            onClick={() => inject(f)}
            className={`p-4 rounded-lg border text-left transition-all ${
              activeFault === f.id
                ? "bg-red-900 border-red-500 scale-105"
                : "bg-gray-900 border-gray-700 hover:border-red-600 hover:bg-gray-800"
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-mono text-cyan-400 text-sm">{f.id}</span>
              <span className="text-xs text-gray-500">{f.domain}</span>
            </div>
            <div className="font-medium">{f.name}</div>
            <div className="text-xs text-gray-500 mt-1">→ {f.device}</div>
          </button>
        ))}
      </div>

      <button
        onClick={reset}
        className="mt-6 bg-gray-700 px-6 py-3 rounded font-medium"
      >
        重置正常工况
      </button>
    </div>
  );
}
