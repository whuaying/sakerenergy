"use client";

import { useEffect, useState } from "react";

interface AlarmPoint {
  observed_at: string;
  device_id: string;
  alarm_code: string;
  severity: number;
  message: string;
}

export default function Replay() {
  const [alarms, setAlarms] = useState<AlarmPoint[]>([]);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch("/api/alarms?limit=100")
      .then((r) => r.json())
      .then((data) => setAlarms(data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!playing || alarms.length === 0) return;
    const iv = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { setPlaying(false); return 100; }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [playing, alarms.length]);

  const visibleAlarms = alarms.slice(0, Math.floor(alarms.length * progress / 100));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-cyan-400">Saker Energy · 故障回放</h1>
        <p className="text-gray-500 text-sm mt-1">时间轴拖动，逐步复盘故障从发生到告警的全过程</p>
      </header>

      {/* Controls */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setProgress(0); setPlaying(true); }}
            className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded font-medium"
          >
            {playing ? "回放中..." : "▶ 开始回放"}
          </button>
          <button
            onClick={() => setPlaying(false)}
            className="bg-gray-700 px-4 py-2 rounded"
          >
            ⏸ 暂停
          </button>
          <input
            type="range" min="0" max="100" value={progress}
            onChange={(e) => { setPlaying(false); setProgress(+e.target.value); }}
            className="flex-1"
          />
          <span className="font-mono text-cyan-300 w-12 text-right">{progress}%</span>
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-3 text-cyan-400">事件时间线</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {visibleAlarms.length === 0 ? (
              <div className="text-gray-600 text-sm py-8 text-center">点击"开始回放"加载事件</div>
            ) : (
              visibleAlarms.map((a, i) => (
                <div key={i} className={`flex gap-3 p-2 rounded text-sm ${a.severity >= 3 ? "bg-red-950/50" : "bg-yellow-950/50"}`}>
                  <span className="font-mono text-gray-500 w-24">{a.observed_at?.slice(11, 19) || "-"}</span>
                  <span className="font-mono text-cyan-300 w-20">{a.device_id}</span>
                  <span className={`font-medium ${a.severity >= 3 ? "text-red-300" : "text-yellow-300"}`}>{a.alarm_code}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-3 text-green-400">回放统计</h2>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">已回放告警</span>
              <span className="font-mono">{visibleAlarms.length} / {alarms.length}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">严重告警(≥3级)</span>
              <span className="font-mono text-red-400">{visibleAlarms.filter(a => a.severity >= 3).length}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">涉及设备</span>
              <span className="font-mono text-cyan-300">{new Set(visibleAlarms.map(a => a.device_id)).size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">告警类型</span>
              <span className="font-mono text-blue-300">{new Set(visibleAlarms.map(a => a.alarm_code)).size}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
