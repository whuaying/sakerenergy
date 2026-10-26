"use client";

import { useEffect, useState, useRef } from "react";

interface Telemetry {
  device_id: string;
  point: string;
  value: number;
  unit: string;
  time: string;
}

interface Alarm {
  alarm_id: number;
  device_id: string;
  alarm_code: string;
  severity: number;
  message: string;
  observed_at: string;
}

interface WorkOrder {
  work_order_id: number;
  title: string;
  status: string;
  priority: string;
}

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState<Telemetry[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const lastAlarmIdRef = useRef(0);

  // Play alert sound for new critical alarms
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = "square";
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) { /* audio not available */ }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, aRes, wRes] = await Promise.all([
          fetch("/api/telemetry/latest").then((r) => r.json()),
          fetch("/api/alarms?limit=20").then((r) => r.json()),
          fetch("/api/workorders?limit=10").then((r) => r.json()),
        ]);
        setTelemetry(tRes.points || tRes || []);
        setAlarms(aRes || []);
        setWorkOrders(wRes || []);
        setLastUpdate(new Date().toLocaleTimeString());

        // Play sound on new critical alarm
        const newAlarms = (aRes || []) as Alarm[];
        if (newAlarms.length > 0) {
          const maxId = Math.max(...newAlarms.map((a) => a.alarm_id || 0));
          if (maxId > lastAlarmIdRef.current && lastAlarmIdRef.current > 0) {
            const hasCritical = newAlarms.some((a) => a.severity >= 3);
            if (hasCritical) playAlertSound();
          }
          lastAlarmIdRef.current = maxId;
        }
      } catch (e) {
        console.error("Fetch error:", e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const activeAlarms = alarms.filter((a) => a.severity >= 3);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">Saker Energy 充储一体场站</h1>
          <p className="text-gray-400 mt-1">AI 智能运维大屏 · 实时监测</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">最后更新</div>
          <div className="text-lg font-mono text-cyan-300">{lastUpdate}</div>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-gray-500 text-sm">在线设备</div>
          <div className="text-2xl font-bold text-green-400">15 / 15</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-gray-500 text-sm">活跃告警</div>
          <div className="text-2xl font-bold text-red-400">{activeAlarms.length}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-gray-500 text-sm">未处理告警</div>
          <div className="text-2xl font-bold text-yellow-400">{alarms.length}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-gray-500 text-sm">工单总数</div>
          <div className="text-2xl font-bold text-blue-400">{workOrders.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold text-cyan-400 mb-3">实时遥测</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2">设备</th>
                  <th className="text-left py-2">测点</th>
                  <th className="text-right py-2">数值</th>
                  <th className="text-left py-2">单位</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(telemetry) && telemetry.slice(0, 15).map((t, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-1.5 font-mono text-gray-300">{t.device_id}</td>
                    <td className="py-1.5 text-gray-400">{t.point}</td>
                    <td className="py-1.5 text-right font-mono text-cyan-300">{t.value}</td>
                    <td className="py-1.5 text-gray-500">{t.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold text-red-400 mb-3">告警列表</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alarms.length === 0 ? (
              <div className="text-gray-500 text-sm py-4 text-center">暂无告警</div>
            ) : (
              alarms.slice(0, 10).map((a) => (
                <div
                  key={a.alarm_id}
                  className={`p-2 rounded border text-sm ${
                    a.severity >= 3
                      ? "bg-red-950/50 border-red-800 text-red-200"
                      : "bg-yellow-950/50 border-yellow-800 text-yellow-200"
                  }`}
                >
                  <div className="font-mono text-xs">{a.device_id}</div>
                  <div className="font-medium">{a.alarm_code}</div>
                  <div className="text-xs opacity-70">{a.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold text-blue-400 mb-3">工单看板</h2>
        <div className="grid grid-cols-4 gap-2">
          {workOrders.length === 0 ? (
            <div className="col-span-4 text-gray-500 text-sm py-2 text-center">暂无工单</div>
          ) : (
            workOrders.map((w) => (
              <div key={w.work_order_id} className="bg-gray-800/50 p-2 rounded text-sm">
                <div className="font-medium">#{w.work_order_id} {w.title}</div>
                <div className="text-xs text-gray-500">{w.status} · {w.priority}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
