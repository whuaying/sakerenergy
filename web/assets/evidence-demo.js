// evidence-demo.js — 浏览器本地回放：万智 Agent 真实调用（脱敏）逐步展示。
// 遵守站点约定：无网络请求、尊重减少动效偏好、状态播报可访问。
(function () {
  'use strict';

  const analyzeBtn = document.getElementById('analyze-btn');
  const resetBtn = document.getElementById('reset-btn');
  const statusEl = document.getElementById('demo-status');
  const stepsWrap = document.getElementById('demo-steps');
  if (!analyzeBtn || !resetBtn || !statusEl || !stepsWrap) return;

  const steps = stepsWrap.querySelectorAll('.demo-step');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stepMs = reduced ? 250 : 1500;

  let timer = null;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function showStep(index) {
    steps.forEach((step, i) => {
      step.hidden = i > index;
      if (i === index) {
        step.classList.add('is-live');
      } else {
        step.classList.remove('is-live');
      }
    });
  }

  function reset() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    stepsWrap.hidden = true;
    steps.forEach((step) => { step.hidden = true; step.classList.remove('is-live'); });
    analyzeBtn.hidden = false;
    resetBtn.hidden = true;
    setStatus('');
  }

  function start() {
    if (timer) window.clearTimeout(timer);
    stepsWrap.hidden = false;
    analyzeBtn.hidden = true;
    resetBtn.hidden = false;
    showStep(0);
    setStatus('第 1/3 步：首轮诊断中……');
    timer = window.setTimeout(() => {
      showStep(1);
      setStatus('第 2/3 步：本地只读补证……');
      timer = window.setTimeout(() => {
        showStep(2);
        setStatus('第 3/3 步：第二轮已转人工核验（演示完成）');
        timer = null;
      }, stepMs);
    }, stepMs);
  }

  analyzeBtn.addEventListener('click', start);
  resetBtn.addEventListener('click', reset);
})();
