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

// T-DP1: skewness — 초반 집중 분포
test('computeDeathPattern: 초반 집중 → early cluster', () => {
  const m = new FunMeter();
  const times = [...Array(90).fill(2), ...Array(10).fill(40)];
  const dp = m.computeDeathPattern(times);
  assert.equal(dp.cluster, 'early');
  assert.ok(dp.skewness > 1.0);
});

// T-DP2: skewness — 균일 분포
test('computeDeathPattern: 균일 분포 → uniform cluster', () => {
  const m = new FunMeter();
  const times = Array.from({ length: 100 }, (_, i) => 5 + i * 0.5);
  const dp = m.computeDeathPattern(times);
  assert.equal(dp.cluster, 'uniform');
  assert.ok(Math.abs(dp.skewness) <= 1.0);
});

// T-DP3: skewness — 후반 집중 분포
test('computeDeathPattern: 후반 집중 → late cluster', () => {
  const m = new FunMeter();
  const times = [...Array(10).fill(1), ...Array(90).fill(55)];
  const dp = m.computeDeathPattern(times);
  assert.equal(dp.cluster, 'late');
  assert.ok(dp.skewness < -1.0);
});

// T-DP4: 단일 값 → skewness 0, cluster uniform
test('computeDeathPattern: 모두 같은 값 → skewness 0', () => {
  const m = new FunMeter();
  const dp = m.computeDeathPattern(Array(50).fill(10));
  assert.equal(dp.skewness, 0);
  assert.equal(dp.kurtosis, 0);
  assert.equal(dp.cluster, 'uniform');
});

// T-GC1: genre 프리셋 적용
test('genre=rhythm → flowMinMedian 10, flowMaxTimeout 0.4', () => {
  const m = new FunMeter({ genre: 'rhythm' });
  assert.equal(m.flowMinMedian, 10);
  assert.equal(m.flowMaxTimeout, 0.4);
});

// T-GC2: flowCriteria가 genre 프리셋 오버라이드
test('genre=rhythm + flowCriteria.minMedian=12 → 12 사용', () => {
  const m = new FunMeter({ genre: 'rhythm', flowCriteria: { minMedian: 12 } });
  assert.equal(m.flowMinMedian, 12);
  assert.equal(m.flowMaxTimeout, 0.4);
});

// T-GC3: 기존 옵션 하위 호환
test('기존 flowMinMedian 옵션 → 그대로 동작', () => {
  const m = new FunMeter({ flowMinMedian: 7, flowMaxTimeout: 0.35 });
  assert.equal(m.flowMinMedian, 7);
  assert.equal(m.flowMaxTimeout, 0.35);
});

// T-GC4: puzzle 프리셋으로 FLOW 판정 변화
test('puzzle 프리셋: 중앙값 12s, timeout 40% → TOO_HARD (minMedian 15 미달)', () => {
  const m = new FunMeter({ genre: 'puzzle' });
  // 40개 60초 타임아웃 + 60개 12초 사망
  // sorted: [12×60, 60×40] → 중앙값=12, timeoutRate=40%
  // puzzle maxTimeoutRate=0.6이므로 timeout 기준은 통과하지만
  // minMedian=15 미달(12 < 15) → TOO_HARD
  const times = Array(100).fill(0).map((_, i) => i < 40 ? 60 : 12);
  const r = analyze(m, times);
  assert.equal(r.zone, 'TOO_HARD');
});

// T-INT2: deathPattern이 RunResult에 포함됨
test('run() 결과에 deathPattern 필드 존재', () => {
  const m = new FunMeter();
  const result = analyze(m, Array(50).fill(10));
  assert.ok(result.deathPattern);
  assert.ok('skewness' in result.deathPattern);
  assert.ok('kurtosis' in result.deathPattern);
  assert.ok(['early', 'uniform', 'late'].includes(result.deathPattern.cluster));
});

// T-CI1: CI 포함 여부 — runs=100, 두 값의 균일 분포 (50×8s + 50×10s)
// 중앙값=9, CI=[8,10] → ciWidth=2 ≤ 5.0 → adequate
test('confidence: ci95[0] < median < ci95[1], adequate (runs=100)', () => {
  const m = new FunMeter();
  // 8s 50개 + 10s 50개: 중앙값=9, bootstrap CI≈[8,10], ciWidth=2
  const times = Array(50).fill(8).concat(Array(50).fill(10));
  const r = analyze(m, times);
  assert.ok(r.confidence, 'confidence 필드 존재');
  const { ci95, sampleSizeAdequacy } = r.confidence;
  assert.ok(ci95[0] < r.median, `ci95[0](${ci95[0]}) < median(${r.median})`);
  assert.ok(r.median < ci95[1], `median(${r.median}) < ci95[1](${ci95[1]})`);
  assert.equal(sampleSizeAdequacy, 'adequate');
});

// T-CI2: 작은 샘플 경고 — runs=10, 분산 큰 데이터
test('confidence: runs=10 + 분산 큰 데이터 → insufficient, recommendedRuns > 10', () => {
  const m = new FunMeter();
  const times = Array(5).fill(1).concat(Array(5).fill(60));
  const r = analyze(m, times);
  assert.ok(r.confidence, 'confidence 필드 존재');
  assert.equal(r.confidence.sampleSizeAdequacy, 'insufficient');
  assert.ok(r.confidence.recommendedRuns > 10, `recommendedRuns(${r.confidence.recommendedRuns}) > 10`);
});

// T-CI3: CI 단조성 — 분산 작은 A vs 분산 큰 B
test('confidence: 분산 작은 집합의 ciWidth < 분산 큰 집합의 ciWidth', () => {
  const m = new FunMeter();
  const smallVar = Array(50).fill(5);
  const bigVar = Array.from({ length: 50 }, (_, i) => i + 1);
  const rA = analyze(m, smallVar);
  const rB = analyze(m, bigVar);
  assert.ok(
    rA.confidence.ciWidth < rB.confidence.ciWidth,
    `A.ciWidth(${rA.confidence.ciWidth}) < B.ciWidth(${rB.confidence.ciWidth})`
  );
});
