"use client";

export default function Report() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6 no-print">
          <h1 className="text-2xl font-bold text-cyan-400">故障诊断报告</h1>
          <button
            onClick={handlePrint}
            className="bg-cyan-600 px-4 py-2 rounded font-medium"
          >
            📄 导出PDF
          </button>
        </div>

        {/* Report content (print-friendly) */}
        <div className="bg-white text-black p-8 rounded print:shadow-none">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Saker Energy 故障诊断报告</h2>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div><b>报告编号:</b> RPT-20261025-001</div>
            <div><b>生成时间:</b> 2026-10-25 14:30:00</div>
            <div><b>场站:</b> Main Station</div>
            <div><b>事件等级:</b> 严重</div>
          </div>

          <h3 className="font-bold mb-2">1. 故障概述</h3>
          <p className="text-sm mb-4">
            2026-10-25 14:28:15，系统检测到 CP-07 充电模块温度异常升高，
            同时伴随风扇转速下降。经跨设备关联分析，确认为充电模块散热链路故障。
          </p>

          <h3 className="font-bold mb-2">2. 告警列表</h3>
          <table className="w-full text-sm mb-4 border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">时间</th>
                <th className="border p-2 text-left">设备</th>
                <th className="border p-2 text-left">告警码</th>
                <th className="border p-2 text-left">描述</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2">14:28:15</td>
                <td className="border p-2">CP-07</td>
                <td className="border p-2">MODULE_OVERTEMP</td>
                <td className="border p-2">模块温度72°C超过阈值70°C</td>
              </tr>
              <tr>
                <td className="border p-2">14:28:18</td>
                <td className="border p-2">CP-07</td>
                <td className="border p-2">FAN_SLOW</td>
                <td className="border p-2">风扇转速降至800rpm</td>
              </tr>
            </tbody>
          </table>

          <h3 className="font-bold mb-2">3. 根因分析（Top3候选）</h3>
          <div className="space-y-2 mb-4 text-sm">
            <div className="border p-2">
              <b>候选1: 散热链路故障（风扇或风道）</b><br/>
              支持证据: 模块温度持续升高，同时风扇转速下降<br/>
              反证: 需现场确认风扇本体还是供电问题<br/>
              下一步: 检查风扇供电、转速反馈、风道堵塞
            </div>
            <div className="border p-2">
              <b>候选2: 充电模块过负载</b><br/>
              支持证据: 高功率工况下温度上升<br/>
              反证: 相邻终端未同步温升<br/>
              下一步: 核对功率曲线与模块散热额定值
            </div>
            <div className="border p-2">
              <b>候选3: 温度传感器偏差</b><br/>
              支持证据: 单点温度异常可能是测量问题<br/>
              反证: 温度与风扇同步变化，解释力不足<br/>
              下一步: 用校准测温仪复核模块温度
            </div>
          </div>

          <h3 className="font-bold mb-2">4. 安全声明</h3>
          <p className="text-sm text-red-600">
            ⚠️ 本报告由AI辅助生成，仅供运维参考。系统不直接控制设备，
            任何停机/合闸/复位操作需由有资质人员按现场规程手动执行。
          </p>
        </div>
      </div>
    </div>
  );
}
