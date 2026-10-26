/**
 * Authored simulation fixtures for the Saker Energy product website.
 * These values do not come from a connected station. They are not equipment
 * limits, manufacturer thresholds, diagnostic results, or control commands.
 */

function freezeDeep(value) {
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') freezeDeep(child);
  });
  return Object.freeze(value);
}

export const SCENARIOS = freezeDeep({
  normal: {
    id: 'normal',
    title: '先看清，整座站的状态',
    eyebrow: 'STATION OVERVIEW',
    summary: '充电、储能与供配电放在同一张图里，沿着设备和时间找到值得关注的变化。',
    device: '充储示例场站',
    metricLabel: '场站总功率',
    metricUnit: 'kW',
    baseline: 612,
    peak: 624,
    series: [612, 614, 610, 616, 620, 624, 621, 618, 616, 619, 620, 618],
    secondarySeries: [400, 401, 400, 399, 400, 401, 400, 400, 399, 400, 401, 400],
    evidence: [
      { label: '充电终端', value: '12 × 120 kW', detail: '示例配置的额定功率；并非当前运行功率。' },
      { label: '储能与 PCS', value: '1 MWh / 500 kW', detail: '分别表示储能容量和 PCS 额定功率。' },
      { label: '供电观察', value: '约 400 V', detail: '本段仿真中母线电压平稳，各设备未呈现关联异常。' },
    ],
    hypotheses: [
      { title: '负载处于平稳区间', support: '总功率变化小，设备间未出现同步突降。', against: '短时间平稳不能代表长期健康，仍需结合历史记录。' },
      { title: '暂未见供电扰动', support: '母线电压保持在本段仿真基线附近。', against: '当前展示没有完整的电能质量采样。' },
      { title: '继续观察设备差异', support: '将模块温度、风扇与电压放在同一时间轴。', against: '局部故障可能未在场站总量上体现。' },
    ],
    nextCheck: '选择一种异常，观察它如何影响设备、证据和检修工单。',
    manualReference: '示例场站观察记录；现场判断需采用对应设备的有效手册与规程。',
  },
  charger: {
    id: 'charger',
    title: '温度在升高，原因在哪里？',
    eyebrow: 'CHARGER · THERMAL ANOMALY',
    summary: '充电模块温度持续上升，风扇转速同时下降。把两条线索放在一起，先排查散热链路。',
    device: '充电终端 CP-07',
    metricLabel: '模块温度',
    metricUnit: '°C',
    baseline: 58,
    peak: 82,
    series: [58, 58, 59, 60, 62, 65, 69, 73, 77, 80, 81, 82],
    secondarySeries: [2400, 2400, 2350, 2200, 1950, 1700, 1400, 1100, 850, 650, 500, 400],
    evidence: [
      { label: '模块温度', value: '58 → 82 °C', detail: '本段仿真温升持续扩大；数值不是厂家告警阈值。' },
      { label: '风扇转速', value: '2400 → 400 rpm', detail: '转速下行与温升同时出现，是关联证据，尚非因果结论。' },
      { label: '相邻终端', value: '未同步温升', detail: '相邻设备保持各自基线，局部散热问题更值得优先排查。' },
    ],
    hypotheses: [
      { title: '风扇或供电链路异常', support: '转速显著下降，模块温度随后持续上升。', against: '转速采样异常也可能产生同样现象，尚未现场确认。' },
      { title: '风道或滤网受阻', support: '散热效率下降可以解释持续温升。', against: '仅凭温度和转速不能确认是否堵塞。' },
      { title: '温度或转速传感异常', support: '单个终端异常需要排除测量问题。', against: '两类指标同步变化使单点测量偏差的解释不充分。' },
    ],
    nextCheck: '由有资质人员按现场规程核查风扇、风道和测点；工单保留检查结果与照片。',
    manualReference: '示例散热检查清单；具体操作以厂家有效手册及现场安全规程为准。',
  },
  battery: {
    id: 'battery',
    title: '同一组电池，温差正在拉大',
    eyebrow: 'STORAGE · TEMPERATURE SPREAD',
    summary: '把模组温差与荷电状态、相邻测点一起观察，为冷却和测量链路排查准备证据。',
    device: '储能柜 BESS-01',
    metricLabel: '模组温差',
    metricUnit: '°C',
    baseline: 3,
    peak: 11,
    series: [3, 3, 3.2, 3.8, 4.5, 5.4, 6.4, 7.5, 8.6, 9.4, 10.2, 11],
    secondarySeries: [62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62],
    evidence: [
      { label: '模组温差', value: '3 → 11 °C', detail: '不同测点间的温差逐渐扩大；不是通用安全阈值。' },
      { label: '荷电状态', value: '62% SOC', detail: '本段仿真中 SOC 保持稳定，帮助排查不同工况的影响。' },
      { label: '异常范围', value: '局部模组', detail: '优先比对相邻温度测点、冷却链路和历史记录。' },
    ],
    hypotheses: [
      { title: '局部冷却不均', support: '局部温差扩大，而 SOC 未发生明显变化。', against: '尚无冷却流量或现场检查结果，不能直接确认。' },
      { title: '测点偏移或接触异常', support: '局部测点偏差可能表现为模组间温差。', against: '需通过经批准的测量手段复核，页面数据无法排除。' },
      { title: '模组状态差异', support: '不同模组的状态差异也可能带来温度分布变化。', against: '缺少足够历史与电芯证据，不能判断具体电池故障。' },
    ],
    nextCheck: '对照 BMS 记录核查测点与冷却状态，由有资质人员决定后续检查。',
    manualReference: '示例温差复核清单；电池安全保护由 BMS、PCS、EMS 与硬件联锁承担。',
  },
  grid: {
    id: 'grid',
    title: '多台设备告警，可能是同一个原因',
    eyebrow: 'GRID · SHARED DISTURBANCE',
    summary: '母线电压和多台设备功率同时下降，沿共同供电路径排查，避免把关联告警拆成孤立问题。',
    device: '场站供配电母线',
    metricLabel: '母线电压',
    metricUnit: 'V',
    baseline: 400,
    peak: 360,
    series: [400, 401, 400, 399, 398, 392, 381, 371, 362, 360, 362, 360],
    secondarySeries: [620, 622, 619, 620, 618, 595, 557, 512, 475, 460, 468, 462],
    evidence: [
      { label: '母线电压', value: '400 → 360 V', detail: '本段仿真电压下行，不能用作真实设备运行限值。' },
      { label: '场站总功率', value: '620 → 462 kW', detail: '多个设备功率在相近时间下降，需核查共同供电路径。' },
      { label: '关联范围', value: '跨设备同步', detail: '时间相关性支持共同来源候选，仍需排除计划调度与采样问题。' },
    ],
    hypotheses: [
      { title: '共同供电扰动', support: '电压变化与多台设备功率下降具有时间一致性。', against: '还需要上游记录和电能质量数据确认来源。' },
      { title: '计划调度或限功率', support: '统一调度可能引起多设备同步功率变化。', against: '还需解释电压变化，并核对实际调度记录。' },
      { title: '网关采样或时间对齐异常', support: '共用采集链路可能制造看似同步的变化。', against: '需要独立设备记录与原始时间戳进行交叉核对。' },
    ],
    nextCheck: '关联上游供电记录、设备时间戳和调度日志，由现场人员按规程复核。',
    manualReference: '示例供电关联检查清单；页面与 AI 均不执行合闸、复位或停机。',
  },
});

export const WORKFLOW_STEPS = freezeDeep([
  { id: 'observe', label: '观察', title: '留下异常发生时的证据', description: '查看本地仿真曲线、设备与时间，建立本次场景记录。' },
  { id: 'correlate', label: '关联', title: '把相关设备放在一起看', description: '比对相邻设备与共同供电路径，整理时间相关的变化。' },
  { id: 'hypothesize', label: '候选', title: '给出有依据的排查方向', description: '同时呈现支持证据与未确认信息，候选原因等待人工复核。' },
  { id: 'human', label: '人工', title: '检查交给现场专业人员', description: '确认已查看示例检查清单后继续。这里仅推进页面流程，不代表现场检修完成。' },
  { id: 'retest', label: '复测', title: '用复测结果决定是否关闭', description: '选择本地模拟复测结果；未通过则重新关联证据，不直接结案。' },
  { id: 'archive', label: '归档', title: '保留这一次处理的来龙去脉', description: '汇总当前页面的仿真审计记录；没有连接真实工单或设备控制系统。' },
]);

/**
 * Annual model from docs/10-PILOT-ROI.md. Monetary values are CNY.
 * `roi` is a ratio (0.25 means 25%), and is null when annualCost is zero.
 * Labor and downtime inputs must represent non-overlapping sources of value.
 */
export function calculateROI(inputs) {
  const names = ['sites', 'incidents', 'improvement', 'hoursSaved', 'hourlyCost', 'downtimeSaved', 'lossPerHour', 'annualCost'];
  if (!inputs || typeof inputs !== 'object') throw new RangeError('ROI inputs are required.');
  for (const key of names) {
    if (typeof inputs[key] !== 'number' || !Number.isFinite(inputs[key]) || inputs[key] < 0) {
      throw new RangeError(`${key} must be a finite non-negative number.`);
    }
  }
  if (inputs.sites < 1) throw new RangeError('sites must be at least one.');
  if (inputs.improvement > 1) throw new RangeError('improvement must be between zero and one.');
  const { sites, incidents, improvement, hoursSaved, hourlyCost, downtimeSaved, lossPerHour, annualCost } = inputs;
  const events = sites * incidents * improvement;
  const labor = events * hoursSaved * hourlyCost;
  const downtime = events * downtimeSaved * lossPerHour;
  const gross = labor + downtime;
  const net = gross - annualCost;
  const roi = annualCost === 0 ? null : net / annualCost;
  if (![labor, downtime, gross, net].every(Number.isFinite) || (roi !== null && !Number.isFinite(roi))) {
    throw new RangeError('ROI inputs exceed the supported numeric range.');
  }
  return { gross, net, roi, labor, downtime };
}

export function createWorkflow(scenarioId) {
  if (!Object.hasOwn(SCENARIOS, scenarioId)) throw new RangeError('Unknown simulation scenario.');
  return { scenarioId, step: 0, observation: false, status: 'NEW', history: [] };
}

/**
 * Pure browser-local state transition. Human observation is accepted only at
 * step 3; reopening clears it so a later attempt requires a fresh confirmation.
 * Nothing here sends a request, controls equipment, or persists a work order.
 */
export function advanceWorkflow(state, { observation = false, passed = true } = {}) {
  if (!state || !Object.hasOwn(SCENARIOS, state.scenarioId) || !Number.isInteger(state.step) || state.step < 0 || state.step > 5 || !Array.isArray(state.history)) {
    throw new RangeError('Invalid simulation workflow state.');
  }
  const next = { ...state, history: state.history.map((event) => ({ ...event })) };
  if (state.step === 5) return next;

  if (state.step === 3) {
    if (observation !== true) {
      next.observation = false;
      next.status = 'AWAITING_HUMAN';
    } else {
      next.step = 4;
      next.observation = true;
      next.status = 'RETEST_PENDING';
    }
  } else if (state.step === 4) {
    if (passed === false) {
      next.step = 1;
      next.observation = false;
      next.status = 'REOPENED';
    } else {
      next.step = 5;
      next.status = 'ARCHIVED';
    }
  } else {
    next.step = state.step + 1;
    next.observation = false;
    next.status = ['NEW', 'CORRELATED', 'CANDIDATES_READY', 'AWAITING_HUMAN'][next.step];
  }
  next.history.push({ step: next.step, status: next.status });
  return next;
}
