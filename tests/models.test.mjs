import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, WORKFLOW_STEPS, calculateROI, createWorkflow, advanceWorkflow } from '../web/assets/models.js';

const roiInputs = {
  sites: 10,
  incidents: 12,
  improvement: 0.5,
  hoursSaved: 2,
  hourlyCost: 100,
  downtimeSaved: 1,
  lossPerHour: 300,
  annualCost: 20000,
};

test('ROI matches the documented annual value formula and keeps components separate', () => {
  assert.deepEqual(calculateROI(roiInputs), { labor: 12000, downtime: 18000, gross: 30000, net: 10000, roi: 0.5 });
  assert.deepEqual(calculateROI({ ...roiInputs, improvement: 0 }), { labor: 0, downtime: 0, gross: 0, net: -20000, roi: -1 });
});

test('ROI preserves negative net value and does not divide by zero', () => {
  assert.equal(calculateROI({ ...roiInputs, annualCost: 40000 }).net, -10000);
  assert.equal(calculateROI({ ...roiInputs, annualCost: 40000 }).roi, -0.25);
  assert.equal(calculateROI({ ...roiInputs, annualCost: 0 }).roi, null);
  assert.equal(calculateROI({ ...roiInputs, annualCost: 0 }).net, 30000);
});

test('ROI rejects invalid, incomplete, non-numeric and overflowing input', () => {
  for (const value of [-1, Infinity, NaN, '12', null, undefined]) {
    assert.throws(() => calculateROI({ ...roiInputs, incidents: value }), RangeError);
  }
  for (const sites of [0, -1]) assert.throws(() => calculateROI({ ...roiInputs, sites }), RangeError);
  assert.throws(() => calculateROI({ ...roiInputs, improvement: 1.01 }), RangeError);
  assert.throws(() => calculateROI({ ...roiInputs, sites: Number.MAX_VALUE }), RangeError);
  assert.throws(() => calculateROI({}), RangeError);
  assert.throws(() => calculateROI(null), RangeError);
});

function reachHuman(scenario = 'charger') {
  let state = createWorkflow(scenario);
  for (let i = 0; i < 3; i++) state = advanceWorkflow(state, { observation: true });
  return state;
}

test('human gate cannot be pre-authorized or bypassed by progression', () => {
  const human = reachHuman();
  assert.equal(human.step, 3);
  assert.equal(human.status, 'AWAITING_HUMAN');
  assert.equal(human.observation, false);
  const held = advanceWorkflow(human);
  assert.equal(held.step, 3);
  assert.equal(held.status, 'AWAITING_HUMAN');
  assert.equal(advanceWorkflow(held, { observation: 'true' }).step, 3);
  const confirmed = advanceWorkflow(held, { observation: true });
  assert.equal(confirmed.step, 4);
  assert.equal(confirmed.observation, true);
  assert.equal(confirmed.status, 'RETEST_PENDING');
  assert.equal(human.history.length, 3, 'transitions must not mutate previous history');
});

test('failed retest reopens evidence gathering and requires fresh human confirmation', () => {
  const pending = advanceWorkflow(reachHuman('battery'), { observation: true });
  const reopened = advanceWorkflow(pending, { passed: false });
  assert.equal(reopened.step, 1);
  assert.equal(reopened.status, 'REOPENED');
  assert.equal(reopened.observation, false);
  assert.deepEqual(reopened.history.at(-1), { step: 1, status: 'REOPENED' });
  const again = advanceWorkflow(advanceWorkflow(reopened));
  assert.equal(again.step, 3);
  assert.equal(advanceWorkflow(again).step, 3);
  const completed = advanceWorkflow(advanceWorkflow(again, { observation: true }), { passed: true });
  assert.equal(completed.step, 5);
  assert.equal(completed.status, 'ARCHIVED');
  assert.deepEqual(advanceWorkflow(completed), completed);
});

test('new workflow isolates scenario resets and audit state', () => {
  const existing = reachHuman('grid');
  const reset = createWorkflow('charger');
  assert.deepEqual(reset, { scenarioId: 'charger', step: 0, observation: false, status: 'NEW', history: [] });
  const next = advanceWorkflow(existing);
  next.history[0].status = 'changed locally';
  assert.equal(existing.history[0].status, 'CORRELATED');
  assert.equal(reset.history.length, 0);
  assert.throws(() => createWorkflow('unknown'), RangeError);
});

test('simulation scenarios provide coherent twelve-point trends and complete evidence', () => {
  assert.equal(WORKFLOW_STEPS.length, 6);
  for (const scenario of Object.values(SCENARIOS)) {
    assert.equal(scenario.series.length, 12);
    assert.equal(scenario.secondarySeries.length, 12);
    assert.equal(scenario.series[0], scenario.baseline);
    assert.ok(scenario.series.includes(scenario.peak));
    assert.ok([...scenario.series, ...scenario.secondarySeries].every(Number.isFinite));
    assert.equal(scenario.evidence.length, 3);
    assert.equal(scenario.hypotheses.length, 3);
    assert.ok(scenario.hypotheses.every((item) => item.support && item.against));
    assert.ok(Object.isFrozen(scenario.series));
  }
});
