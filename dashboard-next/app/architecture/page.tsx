"use client";

export default function Architecture() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold text-cyan-400 mb-8 text-center">Saker Energy · 边云协同架构</h1>

      <div className="max-w-5xl mx-auto">
        {/* Cloud layer */}
        <div className="bg-gradient-to-b from-blue-900/50 to-blue-950/50 border border-blue-600 rounded-lg p-6 mb-4">
          <h2 className="text-blue-300 font-bold mb-4 text-center">☁️ 云端（中心部署）</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-cyan-300 font-medium">LLM诊断引擎</div>
              <div className="text-gray-500 text-xs mt-1">大模型根因分析</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-cyan-300 font-medium">知识库中心</div>
              <div className="text-gray-500 text-xs mt-1">故障树/手册/案例</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-cyan-300 font-medium">全局优化</div>
              <div className="text-gray-500 text-xs mt-1">跨场站调度策略</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-cyan-300 font-medium">数据仓库</div>
              <div className="text-gray-500 text-xs mt-1">历史数据/模型训练</div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="text-center text-gray-500 my-2">↑↓ 加密传输 / 断网自动切换</div>

        {/* Edge layer */}
        <div className="bg-gradient-to-b from-green-900/50 to-green-950/50 border border-green-600 rounded-lg p-6 mb-4">
          <h2 className="text-green-300 font-bold mb-4 text-center">🏭 边缘网关（场站本地）</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-green-300 font-medium">实时检测</div>
              <div className="text-gray-500 text-xs mt-1">规则+ML异常检测</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-green-300 font-medium">Safety Gate</div>
              <div className="text-gray-500 text-xs mt-1">本地硬阻断控制指令</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-green-300 font-medium">事件聚合</div>
              <div className="text-gray-500 text-xs mt-1">跨设备关联分析</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-green-300 font-medium">本地缓存</div>
              <div className="text-gray-500 text-xs mt-1">断网数据暂存</div>
            </div>
          </div>
        </div>

        {/* Field layer */}
        <div className="bg-gradient-to-b from-yellow-900/50 to-yellow-950/50 border border-yellow-600 rounded-lg p-6">
          <h2 className="text-yellow-300 font-bold mb-4 text-center">⚡ 场站设备层</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-yellow-300 font-medium">充电桩 ×12</div>
              <div className="text-gray-500 text-xs mt-1">OCPP/Modbus协议</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-yellow-300 font-medium">储能柜 BESS</div>
              <div className="text-gray-500 text-xs mt-1">BMS数据采集</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-yellow-300 font-medium">PCS</div>
              <div className="text-gray-500 text-xs mt-1">变流器监控</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center text-sm">
              <div className="text-yellow-300 font-medium">电表/母线</div>
              <div className="text-gray-500 text-xs mt-1">电能质量监测</div>
            </div>
          </div>
        </div>

        {/* Key features */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="bg-gray-900 p-4 rounded border border-gray-800">
            <div className="text-cyan-400 font-bold mb-2">🔒 安全优先</div>
            <div className="text-sm text-gray-400">Safety Gate在边缘侧本地执行，不依赖云端连接。任何停机/合闸指令在网关层直接拦截。</div>
          </div>
          <div className="bg-gray-900 p-4 rounded border border-gray-800">
            <div className="text-green-400 font-bold mb-2">📡 断网可用</div>
            <div className="text-sm text-gray-400">网络中断时，边缘网关独立运行检测和告警，数据本地缓存，恢复后自动同步云端。</div>
          </div>
          <div className="bg-gray-900 p-4 rounded border border-gray-800">
            <div className="text-yellow-400 font-bold mb-2">🧠 分层智能</div>
            <div className="text-sm text-gray-400">边缘做实时检测（毫秒级），云端做深度分析（秒级）。实时性和深度智能兼顾。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
