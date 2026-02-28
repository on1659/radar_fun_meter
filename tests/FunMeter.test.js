const { test } = require('node:test');
const assert = require('node:assert/strict');
const FunMeter = require('../src/FunMeter');

// helper: times 배열로 _analyze 호출
function analyze(meter, times, { levels = [], timeouts = null } = {}) {
  const to = timeouts ?? times.filter(t => t >= meter.maxSeconds).length;
  return meter._analyze('test', times, times.map(() => 0), levels, to, times.length);
}

// T1: 홀수 배열 중앙값
test('_percentile: 홀수 배열 p50', () => {
  const m = new FunMeter();
  assert.equal(m._percentile([1, 2, 3, 4, 5], 50), 3);
});

// T2: 짝수 배열 선형 보간
test('_percentile: 짝수 배열 p50 선형 보간', () => {
  const m = new FunMeter();
  assert.equal(m._percentile([1, 2, 3, 4], 50), 2.5);
});

// T3: 빈 배열
test('_percentile: 빈 배열 → 0', () => {
  const m = new FunMeter();
  assert.equal(m._percentile([], 50), 0);
});

// T4: TOO_HARD (중앙값 2s)
test('_analyze: 중앙값 2s → TOO_HARD', () => {
  const m = new FunMeter({ flowMinMedian: 5 });
  const times = Array(100).fill(2);
  const r = analyze(m, times);
  assert.equal(r.zone, 'TOO_HARD');
});

// T5: TOO_EASY (타임아웃 70%)
test('_analyze: 타임아웃 70% → TOO_EASY', () => {
  const m = new FunMeter({ maxSeconds: 60, flowMaxTimeout: 0.5, flowMinMedian: 5 });
  const times = Array(100).fill(0).map((_, i) => i < 70 ? 60 : 10);
  const r = analyze(m, times, { timeouts: 70 });
  assert.equal(r.zone, 'TOO_EASY');
});

// T6: FLOW
test('_analyze: 중앙값 10s, timeout 20% → FLOW', () => {
  const m = new FunMeter({ flowMinMedian: 5, flowMaxTimeout: 0.5 });
  const times = Array(100).fill(0).map((_, i) => i < 20 ? 60 : 10);
  const r = analyze(m, times, { timeouts: 20 });
  assert.equal(r.zone, 'FLOW');
});

// T7: 레벨 모드 FLOW
test('_analyze: 레벨 모드 중앙값 15 → FLOW', () => {
  const m = new FunMeter({
    levelMode: true,
    levelFlowMinMedian: 5,
    levelFlowMaxMedian: 25,
  });
  const times = Array(100).fill(10);
  const levels = Array(100).fill(15);
  const r = analyze(m, times, { levels });
  assert.equal(r.zone, 'FLOW');
});
