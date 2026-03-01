const { test } = require('node:test');
const assert = require('node:assert/strict');
const FunMeter = require('../src/FunMeter');
const { generateSuggestions } = require('../src/FunMeter');

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

// ─── 헬퍼: print() 호출에 필요한 전체 필드를 포함하는 fake result 생성 ───
function makeFakePrintResult(overrides = {}) {
  return {
    name: 'TestGame',
    runs: 10,
    levelMode: false,
    mean: 10.0, stddev: 2.0, median: 10.0,
    min: 5.0, max: 15.0,
    p25: 8.0, p75: 12.0, p90: 14.0,
    histogram: [{ from: 0, to: 30, count: 10, bar: '██' }],
    scoreMean: 500, scoreMax: 1000,
    timeoutRate: 0.1,
    zone: 'FLOW',
    emoji: '🎮',
    advice: '적당한 난이도입니다.',
    suggestions: [],
    confidence: null,
    levelStats: null,
    scoreCurve: null,
    ...overrides
  };
}

// ─── 헬퍼: jest.fn() 없이 직접 구현한 MockBrowserAdapter ───
function createMockBrowserAdapter({ survivalSeconds = 2, scorePerTick = 10 } = {}) {
  let elapsed = 0;
  let alive = true;
  const adapter = {
    initCount: 0,
    closeCount: 0,
    init: async () => { adapter.initCount++; },
    close: async () => { adapter.closeCount++; },
    reset: async () => { elapsed = 0; alive = true; },
    update: async () => { elapsed += 0.05; if (elapsed >= survivalSeconds) alive = false; },
    isAlive: async () => alive,
    getScore: async () => elapsed * scorePerTick,
    getName: () => 'MockBrowser',
    getDifficulty: async () => 5,
    getLevel: async () => null,
  };
  return adapter;
}

// FM-SC-1: print() — scoreCurve 있을 때 출력
test('FM-SC-1: print() outputs scoreCurve when present', () => {
  const meter = new FunMeter({ runs: 10, maxSeconds: 30 });
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  const fakeResult = makeFakePrintResult({
    scoreCurve: { pattern: 'ACCELERATING', growth1H: 5.2, growth2H: 9.8 }
  });
  meter.print(fakeResult);

  console.log = origLog;
  const allOutput = logs.join('\n');
  assert.ok(allOutput.includes('ACCELERATING'), '점수 곡선 패턴이 출력되어야 함');
  assert.ok(allOutput.includes('5.2'), '성장률이 출력되어야 함');
});

// FM-SC-2: print() — scoreCurve 없을 때 해당 줄 출력 안 함
test('FM-SC-2: print() skips scoreCurve block when absent', () => {
  const meter = new FunMeter({ runs: 10 });
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  const fakeResult = makeFakePrintResult({ scoreCurve: undefined });
  meter.print(fakeResult);

  console.log = origLog;
  const allOutput = logs.join('\n');
  assert.ok(!allOutput.includes('점수 곡선'), '점수 곡선 블록이 출력되지 않아야 함');
});

// FM-GS-1: generateSuggestions() — TOO_HARD 시 파라미터 감소 제안
test('FM-GS-1: generateSuggestions TOO_HARD higher direction suggests decrease', () => {
  const result = {
    zone: 'TOO_HARD', suggestions: [],
    median: 2, timeoutRate: 0
  };
  const param = { name: 'initialSpeed', min: 80, max: 400, currentValue: 300, hardDirection: 'higher' };
  const suggestions = generateSuggestions(result, param);
  // 어렵다 → speed를 낮춰야 함 → 감소 제안 포함
  assert.ok(suggestions.length > 0, '제안이 있어야 함');
  assert.ok(suggestions.some(s => s.includes('initialSpeed')), '파라미터 이름이 제안에 있어야 함');
});

// FM-GS-2: generateSuggestions() — TOO_EASY 시 반대 방향 제안
test('FM-GS-2: generateSuggestions TOO_EASY suggests opposite direction', () => {
  const result = {
    zone: 'TOO_EASY', suggestions: [],
    median: 30, timeoutRate: 0.8
  };
  const param = { name: 'botAccuracy', min: 0.05, max: 0.9, currentValue: 0.9, hardDirection: 'lower' };
  const suggestions = generateSuggestions(result, param);
  assert.ok(Array.isArray(suggestions), '배열 반환');
  assert.ok(suggestions.length > 0, '제안이 있어야 함');
});

// FM-GS-3: generateSuggestions() — param 없으면 기존 suggestions 그대로 반환
test('FM-GS-3: generateSuggestions returns existing suggestions when no param', () => {
  const result = { zone: 'FLOW', suggestions: ['기존 제안'], median: 15, timeoutRate: 0.1 };
  const suggestions = generateSuggestions(result, null);
  assert.deepEqual(suggestions, ['기존 제안']);
});

// FM-GS-4: generateSuggestions() — TOO_HARD + lower direction → 증가 제안 (line 679-681 커버)
test('FM-GS-4: generateSuggestions TOO_HARD lower direction suggests increase', () => {
  const result = {
    zone: 'TOO_HARD', suggestions: [],
    median: 2, timeoutRate: 0
  };
  const param = { name: 'botAccuracy', min: 0.05, max: 0.9, currentValue: 0.1, hardDirection: 'lower' };
  const suggestions = generateSuggestions(result, param);
  assert.ok(suggestions.length > 0, '제안이 있어야 함');
  assert.ok(suggestions.some(s => s.includes('botAccuracy')), '파라미터 이름이 제안에 있어야 함');
});

// FM-GS-5: generateSuggestions() — TOO_EASY + higher direction → 증가 제안 (line 684-685 커버)
test('FM-GS-5: generateSuggestions TOO_EASY higher direction suggests increase', () => {
  const result = {
    zone: 'TOO_EASY', suggestions: [],
    median: 30, timeoutRate: 0.8
  };
  const param = { name: 'initialSpeed', min: 80, max: 400, currentValue: 100, hardDirection: 'higher' };
  const suggestions = generateSuggestions(result, param);
  assert.ok(Array.isArray(suggestions), '배열 반환');
  assert.ok(suggestions.length > 0, '제안이 있어야 함');
  assert.ok(suggestions.some(s => s.includes('initialSpeed')), '파라미터 이름이 제안에 있어야 함');
});

// FM-BR-1: runBrowser() — 기본 실행 흐름 (608-655 커버)
test('FM-BR-1: runBrowser completes basic run cycle', async () => {
  const meter = new FunMeter({ maxSeconds: 5 });
  const adapter = createMockBrowserAdapter({ survivalSeconds: 0.1 });
  const mockBot = { act: () => 'jump', reset: () => {} };

  const result = await meter.runBrowser(adapter, mockBot, {
    runs: 3, pollInterval: 10, maxSeconds: 0.5
  });

  assert.ok('zone' in result, 'zone 필드 존재');
  assert.ok('median' in result, 'median 필드 존재');
  assert.equal(adapter.initCount, 1, 'init 1회 호출');
  assert.equal(adapter.closeCount, 1, 'close 1회 호출');
});

// FM-BR-2: runBrowser() — timeout 처리 (maxSeconds 초과)
test('FM-BR-2: runBrowser counts timeouts when maxSeconds exceeded', async () => {
  const meter = new FunMeter({ maxSeconds: 1 });
  const adapter = createMockBrowserAdapter({ survivalSeconds: 9999 }); // 절대 사망 안 함
  const mockBot = { act: () => null, reset: () => {} };

  const result = await meter.runBrowser(adapter, mockBot, {
    runs: 3, pollInterval: 10, maxSeconds: 0.05
  });

  // 모든 run이 timeout → timeoutRate > 0
  assert.ok(result.timeoutRate > 0, `timeoutRate가 0보다 커야 함, 실제: ${result.timeoutRate}`);
});

// FM-PP-1: runParallel() — onProgress 콜백 호출 (552-553 커버)
test('FM-PP-1: runParallel calls onProgress callback for each run', async () => {
  const progressEvents = [];
  const meter = new FunMeter({
    onProgress: (ev) => progressEvents.push(ev)
  });

  const gameFile = require.resolve('../games/timing-jump/TimingJumpAdapter');
  const botFile = require.resolve('../src/bots/RandomBot');

  await meter.runParallel(
    gameFile, botFile,
    { initialSpeed: 100 }, { jumpProb: 0.5 },
    10, 2 // 10 runs, 2 workers
  );

  assert.ok(progressEvents.length > 0, 'onProgress가 호출되어야 함');
  assert.ok(progressEvents[0].run >= 1, 'run 번호가 1 이상');
  assert.equal(progressEvents[0].total, 10, 'total이 10');
});
