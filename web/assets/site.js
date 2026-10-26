import { createStationScene } from './station-scene.js';
import { SCENARIOS, WORKFLOW_STEPS, calculateROI, createWorkflow, advanceWorkflow } from './models.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const put = (selector, value) => $$(selector).forEach(node => { node.textContent = value; });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const page = document.body.dataset.page;
let toastTimer;

function toast(message) {
  const element = $('.toast');
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 4000);
}

function download(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Navigation remains a set of ordinary links; mobile menu is progressively enhanced.
const menuButton = $('.menu-toggle');
const mobileNav = $('#mobile-nav');
const closeMenu = () => {
  if (!menuButton || !mobileNav) return;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '打开导航菜单');
  mobileNav.hidden = true;
};
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  mobileNav.hidden = !open;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
$$('a', mobileNav).forEach(link => link.addEventListener('click', closeMenu));
window.matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px 12px 0px' });
  $$('[data-reveal]').forEach(element => {
    element.classList.add('reveal-ready');
    observer.observe(element);
  });
}

// One shared scene and a deterministic set of authored fixtures, with no network requests.
const canvas = $('#energy-scene');
let scene;
let autoRotate = !reducedMotion.matches;
const focusLabels = {
  all: '12 × 120 kW · 1 MWh · 500 kW PCS',
  charging: '充电终端 · 12 台 · 每台额定 120 kW',
  storage: '储能系统 · 1 MWh · PCS 500 kW',
  grid: '供配电 · 共享母线与电气连接',
};
function setFocus(id) {
  if (!Object.hasOwn(focusLabels, id)) return;
  scene?.setFocus(id);
  $$('[data-focus]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.focus === id)));
  put('[data-focus-label]', focusLabels[id]);
}
function syncRotationButton() {
  $$('[data-scene-action="rotate"]').forEach(button => {
    button.setAttribute('aria-pressed', String(autoRotate));
    button.setAttribute('aria-label', autoRotate ? '暂停自动旋转' : '开启自动旋转');
    button.textContent = autoRotate ? 'Ⅱ' : '▷';
  });
}
if (canvas) {
  scene = createStationScene(canvas, { onSelect: id => setFocus(id) });
  scene.setAutoRotate(autoRotate);
  syncRotationButton();
  $$('[data-focus]').forEach(button => button.addEventListener('click', () => setFocus(button.dataset.focus)));
  $$('[data-view]').forEach(button => button.addEventListener('click', () => {
    scene.setView(button.dataset.view);
    $$('[data-view]').forEach(view => view.setAttribute('aria-pressed', String(view === button)));
  }));
  $$('[data-scene-action]').forEach(button => button.addEventListener('click', () => {
    switch (button.dataset.sceneAction) {
      case 'rotate': autoRotate = !autoRotate; scene.setAutoRotate(autoRotate); syncRotationButton(); break;
      case 'in': scene.zoom(0.12); break;
      case 'out': scene.zoom(-0.12); break;
      case 'reset':
        scene.reset();
        setFocus('all');
        $$('[data-view]').forEach(view => view.setAttribute('aria-pressed', String(view.dataset.view === 'iso')));
        break;
    }
  }));
  reducedMotion.addEventListener('change', event => {
    if (event.matches) { autoRotate = false; scene.setAutoRotate(false); syncRotationButton(); }
  });
}

let scenarioId = 'charger';
let workflow;
const statusLabels = { NEW: '待观察', CORRELATED: '已关联证据', CANDIDATES_READY: '候选已整理', AWAITING_HUMAN: '等待人工反馈', RETEST_PENDING: '等待复测', REOPENED: '已重新打开', ARCHIVED: '已归档' };
const params = new URLSearchParams(location.search);
if (page === 'experience' && Object.hasOwn(SCENARIOS, params.get('scenario'))) scenarioId = params.get('scenario');

function chart(element, data, index) {
  const values = data.series;
  const observedMin = Math.min(...values);
  const observedMax = Math.max(...values);
  const margin = Math.max((observedMax - observedMin) * 0.25, 2);
  const min = observedMin - margin;
  const max = observedMax + margin;
  const x = n => 22 + n / (values.length - 1) * 554;
  const y = n => 162 - (n - min) / (max - min) * 142;
  const points = values.map((value, n) => `${x(n).toFixed(1)},${y(value).toFixed(1)}`);
  const path = 'M' + points.join(' L');
  const color = data.id === 'normal' ? '#6d8e51' : '#9b7c43';
  const gradient = `trend-fill-${index}`;
  element.setAttribute('aria-label', `${data.metricLabel}，${data.device}，仿真趋势从 ${values[0]} 到 ${values.at(-1)} ${data.metricUnit}，不代表真实设备数据。`);
  element.innerHTML = `<defs><linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".14"/><stop offset="100%" stop-color="${color}" stop-opacity=".01"/></linearGradient></defs>
    ${[28, 73, 118, 163].map(grid => `<path d="M15 ${grid}H585" stroke="#e7ecde" stroke-width="1" stroke-dasharray="3 5"/>`).join('')}
    <path d="M${x(4.5)} 17V169" stroke="#d2dcc1" stroke-width="1" stroke-dasharray="4 5"/>
    <path d="${path} L576 170 L22 170 Z" fill="url(#${gradient})"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(values.length - 1)}" cy="${y(values.at(-1))}" r="5" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="22" y="12" fill="#82946d" font-size="9" font-family="Arial,sans-serif">${observedMax} ${data.metricUnit}</text>
    <text x="22" y="188" fill="#82946d" font-size="9" font-family="Arial,sans-serif">${observedMin} ${data.metricUnit}</text>`;
}

function renderScenario(id, { syncScene = true, updateURL = false } = {}) {
  const data = SCENARIOS[id];
  if (!data) return;
  scenarioId = id;
  $$('[data-scenario]').forEach(button => {
    if (button.tagName !== 'BUTTON') return;
    const active = button.dataset.scenario === id;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $('#scenario-panel')?.setAttribute('aria-labelledby', `tab-${id}`);
  $('#scenario-panel')?.setAttribute('tabindex', '0');
  if (updateURL) toast(`已切换：${data.device} · ${data.metricLabel}`);
  put('[data-scenario-title]', data.title);
  put('[data-scenario-summary]', data.summary);
  put('[data-primary-hypothesis]', data.hypotheses[0].title);
  put('[data-chart-label]', data.metricLabel);
  put('[data-chart-value]', data.series.at(-1));
  put('[data-chart-unit]', data.metricUnit);
  put('[data-chart-device]', data.device);
  put('[data-manual-reference]', data.manualReference);
  $$('[data-scenario-link]').forEach(anchor => { anchor.href = `/experience.html?scenario=${id}`; });
  $$('[data-trend-chart]').forEach((svg, i) => chart(svg, data, i));
  const evidence = $('[data-evidence-list]');
  if (evidence) evidence.innerHTML = data.evidence.map(item => `<div class="evidence-item"><div><span>${item.label}</span><strong>${item.value}</strong></div><p>${item.detail}</p></div>`).join('');
  const hypotheses = $('[data-hypotheses]');
  if (hypotheses) hypotheses.innerHTML = data.hypotheses.map((item, i) => `<article class="hypothesis-card"><span class="small-label">${id === 'normal' ? '观察' : '候选'} / 0${i + 1}${id === 'normal' ? '' : ' · 待核验'}</span><h3>${item.title}</h3><div class="hypothesis-detail"><span>支持线索</span><p>${item.support}</p></div><div class="hypothesis-detail against"><span>仍需核验</span><p>${item.against}</p></div></article>`).join('');
  if (syncScene && scene) { scene.setScenario(id); setFocus(id === 'charger' ? 'charging' : id === 'battery' ? 'storage' : id === 'grid' ? 'grid' : 'all'); }
  if (page === 'experience') {
    workflow = createWorkflow(id);
    resetWorkflowInputs();
    renderWorkflow();
    if (updateURL) {
      const url = new URL(location.href);
      url.searchParams.set('scenario', id);
      history.replaceState(null, '', url);
    }
  }
}

$$('[data-scenario][role="tab"]').forEach(button => button.addEventListener('click', () => renderScenario(button.dataset.scenario, { updateURL: page === 'experience' })));
$$('[role="tablist"]').forEach(tablist => tablist.addEventListener('keydown', event => {
  const tabs = $$('[role="tab"]', tablist);
  const current = tabs.indexOf(document.activeElement);
  if (current === -1) return;
  let next;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current + tabs.length - 1) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}));

function resetWorkflowInputs() {
  if ($('#human-observation')) $('#human-observation').checked = false;
  if ($('#verification-result')) $('#verification-result').value = 'pass';
  put('[data-workflow-feedback]', '');
}
function renderWorkflow() {
  if (!workflow) return;
  const normal = scenarioId === 'normal';
  const step = WORKFLOW_STEPS[workflow.step];
  $('[data-workflow-steps]').innerHTML = WORKFLOW_STEPS.map((item, i) => `<li class="${i === workflow.step ? 'is-active' : i < workflow.step ? 'is-done' : ''}"${i === workflow.step ? ' aria-current="step"' : ''}><span>${i < workflow.step ? '✓' : `0${i + 1}`}</span>${item.label}</li>`).join('');
  put('[data-workflow-status]', normal ? '正常基线观察' : statusLabels[workflow.status]);
  $('[data-workflow-status]').dataset.status = workflow.status;
  put('[data-workflow-title]', normal ? '当前场景没有待处理异常' : step.title);
  put('[data-workflow-description]', normal ? '选择充电、储能或供电异常，开始一段仿真处理流程。正常基线用于观察，不自动创建检修事件。' : workflow.step === 3 ? `${step.description} ${SCENARIOS[scenarioId].nextCheck}` : step.description);
  put('[data-workflow-scenario]', SCENARIOS[scenarioId].title);
  $('[data-human-gate]').hidden = normal || workflow.step !== 3;
  $('[data-verification-options]').hidden = normal || workflow.step !== 4;
  const advance = $('#advance-workflow');
  const actions = ['查看关联证据', '整理候选原因', '生成模拟检查工单', '记录人工反馈', '执行模拟复测', '本次流程已归档'];
  advance.textContent = normal ? '请选择一个异常场景' : `${actions[workflow.step]}${workflow.step < 5 ? ' →' : ' ✓'}`;
  advance.disabled = normal || workflow.step === 5;
  $('[data-audit-log]').innerHTML = '<li>00 · 仿真场景已载入</li>' + workflow.history.map((entry, i) => `<li>${String(i + 1).padStart(2, '0')} · ${statusLabels[entry.status]}</li>`).join('');
}
$('#advance-workflow')?.addEventListener('click', () => {
  if (!workflow || scenarioId === 'normal' || workflow.step === 5) return;
  if (workflow.step === 3 && !$('#human-observation').checked) {
    put('[data-workflow-feedback]', '请先查看示例检查要求，并勾选人工反馈确认。');
    $('#human-observation').focus();
    return;
  }
  const oldStep = workflow.step;
  const passed = $('#verification-result').value === 'pass';
  workflow = advanceWorkflow(workflow, { observation: $('#human-observation').checked, passed });
  if (oldStep === 4 && !passed) {
    resetWorkflowInputs();
    put('[data-workflow-feedback]', '模拟复测未通过。事件已重新打开，需要再次整理证据并获得人工反馈。');
  } else put('[data-workflow-feedback]', workflow.step === 5 ? '本地仿真记录已归档，可以下载查看。' : '');
  renderWorkflow();
});
$('#reset-workflow')?.addEventListener('click', () => {
  workflow = createWorkflow(scenarioId);
  resetWorkflowInputs();
  renderWorkflow();
  toast('已重置当前仿真流程。');
});
$('#export-audit')?.addEventListener('click', () => {
  if (!workflow) return;
  download(`saker-energy-${scenarioId}-simulation.json`, JSON.stringify({ kind: 'BROWSER_SIMULATION_ONLY', version: '1.0.0', note: '预置脚本与本地流程记录；不代表真实设备、实际诊断、现场检查或服务端工单。', exportedAt: new Date().toISOString(), scenario: SCENARIOS[scenarioId], workflow }, null, 2), 'application/json;charset=utf-8');
  toast('仿真记录已生成下载。');
});
if ($('[data-scenario][role="tab"]')) renderScenario(scenarioId, { syncScene: page === 'experience' });

// Financial assumptions are always visible and remain in memory only.
const roiForm = $('#roi-form');
let lastROI;
const formatMoney = value => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
function roiInputs() {
  const values = Object.fromEntries([...new FormData(roiForm)].map(([key, value]) => [key, Number(value)]));
  values.improvement /= 100;
  return values;
}
function updateROI() {
  if (!roiForm) return;
  const error = $('[data-roi-error]');
  try {
    if (!roiForm.checkValidity()) throw new RangeError('invalid form');
    const inputs = roiInputs();
    const result = calculateROI(inputs);
    lastROI = { inputs, result };
    $('[data-roi-net]').innerHTML = `${formatMoney(result.net)}<small>元</small>`;
    put('[data-roi-labor]', `${formatMoney(result.labor)} 元`);
    put('[data-roi-downtime]', `${formatMoney(result.downtime)} 元`);
    put('[data-roi-gross]', `${formatMoney(result.gross)} 元`);
    put('[data-roi-cost]', `${formatMoney(inputs.annualCost)} 元`);
    put('[data-roi-ratio]', result.roi === null ? '不适用（投入为 0）' : `${(result.roi * 100).toFixed(1)}%`);
    put('[data-roi-status]', result.net > 0 ? '在当前假设下，毛收益高于年度投入。' : result.net === 0 ? '在当前假设下，收益恰好覆盖年度投入。' : '当前假设下，收益尚未覆盖投入。');
    error.hidden = true;
    $('#download-roi').disabled = false;
  } catch {
    lastROI = undefined;
    error.textContent = '请填写有效的非负数值；场站至少 1 个，改善比例应在 0–100% 之间。';
    error.hidden = false;
    $('#download-roi').disabled = true;
    put('[data-roi-net]', '—');
    put('[data-roi-status]', '参数无效，当前结果已清空。');
    ['labor', 'downtime', 'gross', 'cost', 'ratio'].forEach(key => put(`[data-roi-${key}]`, '—'));
  }
}
roiForm?.addEventListener('input', updateROI);
roiForm?.addEventListener('submit', event => { event.preventDefault(); updateROI(); });
roiForm?.addEventListener('reset', () => setTimeout(updateROI, 0));
$('#download-roi')?.addEventListener('click', () => {
  if (!lastROI) return;
  const { inputs, result } = lastROI;
  const text = `Saker Energy · 年度收益假设测算\n\n此文件是基于输入假设的测算，不是实测经营结果或回报承诺。\n金额单位：人民币元\n\n场站数量：${inputs.sites}\n每站年有效故障数：${inputs.incidents}\n有效改善比例：${inputs.improvement * 100}%\n每次节省诊断工时：${inputs.hoursSaved} 小时\n人工成本：${inputs.hourlyCost} 元/小时\n每次减少停机：${inputs.downtimeSaved} 小时\n停机损失率：${inputs.lossPerHour} 元/小时\n年度总投入：${inputs.annualCost} 元\n\n诊断工时价值：${formatMoney(result.labor)} 元\n停机时长价值：${formatMoney(result.downtime)} 元\n年度毛收益：${formatMoney(result.gross)} 元\n年度净收益：${formatMoney(result.net)} 元\n年度ROI：${result.roi === null ? '不适用（投入为0）' : (result.roi * 100).toFixed(1) + '%'}\n\n公式：毛收益 = 场站数 × 年事件数 × 有效改善比例 ×（工时节约 × 人工成本 + 停机节约 × 损失率）；净收益 = 毛收益 − 年度总投入。\n\n人工与停机价值须避免重复计算。年度总投入包含集成、软件、算力和维护。未计入税务、融资、设备折旧和现金流折现。\n`;
  download('saker-energy-roi-assumptions.txt', text);
  toast('测算结果与全部假设已生成下载。');
});
updateROI();

// This form produces a brief locally. It intentionally has no submission endpoint.
const briefForm = $('#brief-form');
let briefText = '';
briefForm?.addEventListener('submit', event => {
  event.preventDefault();
  if (!briefForm.reportValidity()) return;
  const form = new FormData(briefForm);
  const siteName = String(form.get('siteName')).trim();
  const problem = String(form.get('problem')).trim();
  if (!siteName || !problem) { toast('请填写有效的项目名称和希望解决的问题。'); return; }
  briefText = `Saker Energy · 试点需求清单\n本地生成 / 尚未发送\n\n项目名称：${siteName}\n场站类型：${form.get('siteType')}\n设备与规模：${String(form.get('scale')).trim() || '待补充'}\n\n希望解决的问题\n${problem}\n\n可梳理的数据\n${form.getAll('data').join('、') || '待确认'}\n\n效果判断方式\n${String(form.get('goal')).trim() || '待共同定义：诊断耗时、误报与实际业务成本等。'}\n\n建议的下一步\n1. 核实设备、协议与数据读取权限。\n2. 选择单场站，定义基线和可复核的目标。\n3. 规划4–8周只读影子试点，保留既有控制与安全路径。\n4. 结合人工标签、复测记录和成本数据复盘。\n\n说明：此清单不会自动提交或预约。请检查内容后，自行通过已确认的联系渠道沟通。真实设备接入、诊断与工单后台需要进一步实施验证。\n`;
  $('#brief-text').textContent = briefText;
  const output = $('#brief-output');
  output.hidden = false;
  output.setAttribute('tabindex', '-1');
  output.focus({ preventScroll: true });
  output.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
});
$('#download-brief')?.addEventListener('click', () => { if (briefText) download('saker-energy-pilot-brief.txt', briefText); });
$('#copy-brief')?.addEventListener('click', async () => {
  if (!briefText) return;
  try { await navigator.clipboard.writeText(briefText); toast('需求清单已复制。'); }
  catch { toast('浏览器未允许复制，请使用下载或手动选择内容。'); }
});
$('#edit-brief')?.addEventListener('click', () => {
  briefForm.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' });
  $('#site-name').focus({ preventScroll: true });
});
