"use client";

import { useEffect, useState } from "react";

export default function Monitor() {
  const [stats, setStats] = useState({
    telemetryCount: 0,
    alarmCount: 0,
    eventCount: 0,
    workOrderCount: 0,
    kbCount: 15,
    onlineDevices: 15,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [aRes] = await Promise.all([
          fetch("/api/alarms?limit=200").then((r) => r.json()),
        ]);
        setStats((s) => ({ ...s, alarmCount: (aRes || []).length }));
      } catch (e) { console.error(e); }
    };
    fetchStats();
    const iv = setInterval(fetchStats, 5000);
    return () => clearInterval(iv);
  }, []);

  const services = [
    { name: "Simulator", status: "running", port: "NATS:4222" },
    { name: "Ingest", status: "running", port: "Postgres:55432" },
    { name: "Detector", status: "running", port: "rules+EWMA" },
    { name: "ML Detector", status: "running", port: "IsolationForest" },
    { name: "Aggregator", status: "running", port: "event fusion" },
    { name: "Diagnostic Agent", status: "running", port: "fault-tree+RAG" },
    { name: "Workorder API", status: "running", port: "HTTP:8080" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold text-cyan-400 mb-6">Saker Energy · 系统监控</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <div className="text-gray-500 text-sm">遥测数据点</div>
          <div className="text-3xl font-mono text-cyan-300">{stats.telemetryCount}</div>
        </div>
        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <div className="text-gray-500 text-sm">累计告警</div>
          <div className="text-3xl font-mono text-yellow-400">{stats.alarmCount}</div>
        </div>
        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <div className="text-gray-500 text-sm">在线设备</div>
          <div className="text-3xl font-mono text-green-400">{stats.onlineDevices}/15</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <h2 className="text-lg font-semibold text-green-400 mb-3">服务状态</h2>
          <div className="space-y-2">
            {services.map((s) => (
              <div key={s.name} className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                <span className="font-mono text-sm">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{s.port}</span>
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 p-4 rounded border border-gray-800">
          <h2 className="text-lg font-semibold text-purple-400 mb-3">处理流水线</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">遥测接收速率</span>
              <span className="font-mono text-green-300">~5 pts/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">检测延迟</span>
              <span className="font-mono text-green-300">&lt; 3s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">事件聚合延迟</span>
              <span className="font-mono text-green-300">&lt; 8s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">诊断生成延迟</span>
              <span className="font-mono text-green-300">&lt; 10s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Safety Gate拦截</span>
              <span className="font-mono text-red-400">100%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">知识库条目</span>
              <span className="font-mono text-cyan-300">{stats.kbCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
