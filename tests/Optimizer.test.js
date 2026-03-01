const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Optimizer } = require('../src/Optimizer');

// survivalSeconds: 항상 이 값으로 생존 시간 고정하는 Mock 게임 팩토리
function makeMockGame(survivalSeconds, tps = 60) {
  return class MockGame {
    constructor() { this._ticks = 0; this._alive = true; }
    reset() { this._ticks = 0; this._alive = true; }
    update() {
      this._ticks++;
      if (this._ticks >= survivalSeconds * tps) this._alive = false;
    }
    isAlive() { return this._alive; }
    getScore() { return this._ticks; }
    getName() { return 'mock'; }
    getDifficulty() { return 1; }
  };
}

class NopBot {
  reset() {}
  decide() { return false; }
}

const PARAM = { name: 'speed', min: 10, max: 100, hardDirection: 'higher' };

// O1: 항상 TOO_HARD → 탐색이 낮은 방향으로 이동
test('Optimizer: TOO_HARD → param 값이 중간보다 낮아짐', () => {
  const opt = new Optimizer({ maxIterations: 3, runs: 10, verbose: false });
  const Game = makeMockGame(1); // 1초 생존 → TOO_HARD
  const { config } = opt.optimize(Game, NopBot, {}, PARAM);
  // hardDirection=higher + TOO_HARD: high = mid → 다음 탐색이 [10, 55] 범위
  assert.ok(config.speed < 55, `기대: speed < 55, 실제: ${config.speed}`);
});

// O2: 항상 TOO_EASY → 탐색이 높은 방향으로 이동
test('Optimizer: TOO_EASY → param 값이 중간보다 높아짐', () => {
  const opt = new Optimizer({ maxIterations: 3, runs: 10, verbose: false });
  const Game = makeMockGame(60); // 60초 생존 → TOO_EASY (타임아웃)
  const { config } = opt.optimize(Game, NopBot, {}, PARAM);
  // hardDirection=higher + TOO_EASY: low = mid → 다음 탐색이 [55, 100] 범위
  assert.ok(config.speed > 55, `기대: speed > 55, 실제: ${config.speed}`);
});

// O3: FLOW 즉시 발견 → found=true
test('Optimizer: FLOW 판정 시 found=true 반환', () => {
  const opt = new Optimizer({
    maxIterations: 10,
    runs: 10,
    verbose: false,
    flowOptions: { flowMinMedian: 5, flowMaxTimeout: 0.9 }, // 넓은 FLOW 기준
  });
  const Game = makeMockGame(10); // 10초 생존 → FLOW (중앙값 10 ≥ 5, timeout 0%)
  const { found } = opt.optimize(Game, NopBot, {}, PARAM);
  assert.equal(found, true);
});

// OPT-1: optimizeByName() — timing-jump 기본 파라미터 사용
test('OPT-1: optimizeByName timing-jump uses DEFAULT_PARAMS', () => {
  const MockGame = makeMockGame(1); // 1초 생존
  const opt = new Optimizer({ maxIterations: 3, runs: 10, verbose: false });
  const result = opt.optimizeByName('timing-jump', MockGame, NopBot);
  // initialSpeed가 80~400 범위 내에 있어야 함
  assert.ok(result.config.initialSpeed >= 80, `initialSpeed >= 80, 실제: ${result.config.initialSpeed}`);
  assert.ok(result.config.initialSpeed <= 400, `initialSpeed <= 400, 실제: ${result.config.initialSpeed}`);
  assert.ok('found' in result);
});

// OPT-2: optimizeByName() — stack-tower defaultBotOptions 병합
test('OPT-2: optimizeByName stack-tower merges defaultBotOptions', () => {
  let capturedBotOptions;
  class BotCapture {
    constructor(opts) { capturedBotOptions = opts; }
    reset() {}
    decide() { return false; }
  }
  const MockGame = makeMockGame(1);
  const opt = new Optimizer({ maxIterations: 2, runs: 5, verbose: false });
  opt.optimizeByName('stack-tower', MockGame, BotCapture);
  assert.equal(capturedBotOptions.jumpProb, 0);
});

// OPT-3: hardDirection='lower' — rhythm-tap 반전 탐색
test('OPT-3: lower hardDirection inverts search on TOO_HARD', () => {
  const HardGame = makeMockGame(1); // 1초 생존 → TOO_HARD (항상)
  const opt = new Optimizer({ maxIterations: 5, runs: 10, verbose: false });
  const result = opt.optimize(HardGame, NopBot, {}, {
    name: 'botAccuracy', min: 0.05, max: 0.9,
    hardDirection: 'lower'
  });
  // TOO_HARD + lower: low = mid → 탐색이 [0.475, 0.9] 방향으로 이동
  assert.ok(result.config.botAccuracy > 0.475,
    `기대: botAccuracy > 0.475, 실제: ${result.config.botAccuracy}`);
});

// OPT-4: 수렴 threshold — |hi - lo| < 0.001 조기 종료
test('OPT-4: converges early when |hi-lo| < 0.001', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  const HardGame = makeMockGame(1); // 항상 TOO_HARD
  const opt = new Optimizer({ maxIterations: 50, runs: 5, verbose: true });
  opt.optimize(HardGame, NopBot, {}, {
    name: 'speed', min: 100.0, max: 100.0001,
    hardDirection: 'higher'
  });

  console.log = origLog;
  // 수렴 완료 메시지 확인 (Optimizer.js line 141)
  assert.ok(logs.some(l => l.includes('수렴')), `수렴 완료 로그 없음`);
});

// OPT-5: verbose: true — 로그 출력 경로
test('OPT-5: verbose=true logs iteration progress', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  const opt = new Optimizer({ maxIterations: 2, runs: 5, verbose: true });
  opt.optimize(makeMockGame(1), NopBot, {}, {
    name: 'speed', min: 80, max: 400, hardDirection: 'higher'
  });

  console.log = origLog;
  assert.ok(logs.length > 0, 'console.log가 호출되어야 함');
  assert.ok(logs.some(l => l.includes('speed')), '파라미터 이름이 로그에 있어야 함');
});

// OPT-6: optimizeByName() — 알 수 없는 게임명 에러
test('OPT-6: optimizeByName throws on unknown game', () => {
  const opt = new Optimizer({ maxIterations: 2 });
  assert.throws(
    () => opt.optimizeByName('nonexistent-game', makeMockGame(1), NopBot),
    { message: /기본 최적화 파라미터가 없습니다/ }
  );
});

// OPT-7: FLOW 즉시 수렴 — found: true 반환 확인
test('OPT-7: returns found=true on immediate FLOW', () => {
  const opt = new Optimizer({
    maxIterations: 10, runs: 10, verbose: false,
    flowOptions: { flowMinMedian: 5, flowMaxTimeout: 0.9 } // 넓은 FLOW 기준
  });
  const FlowGame = makeMockGame(10); // 10초 생존 → FLOW
  const result = opt.optimize(FlowGame, NopBot, {}, {
    name: 'speed', min: 80, max: 400, hardDirection: 'higher'
  });
  assert.equal(result.found, true);
});

// OPT-8: verbose=true + FLOW 발견 → "Flow Zone 발견!" 로그 출력 (line 148-149 커버)
test('OPT-8: verbose=true logs Flow Zone found on FLOW result', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  const opt = new Optimizer({
    maxIterations: 10, runs: 10, verbose: true,
    flowOptions: { flowMinMedian: 5, flowMaxTimeout: 0.9 }
  });
  opt.optimize(makeMockGame(10), NopBot, {}, {
    name: 'speed', min: 80, max: 400, hardDirection: 'higher'
  });

  console.log = origLog;
  assert.ok(logs.some(l => l.includes('Flow Zone')), 'Flow Zone 발견 로그 있어야 함');
});

// OPT-9: verbose=true + levelMode=true → 레벨 판정 모드 로그 출력 (line 96-97 커버)
test('OPT-9: verbose=true with levelMode logs level-based mode', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  const opt = new Optimizer({
    maxIterations: 2, runs: 5, verbose: true,
    flowOptions: { levelMode: true, levelFlowMinMedian: 5, levelFlowMaxMedian: 25 }
  });
  opt.optimize(makeMockGame(1), NopBot, {}, {
    name: 'speed', min: 80, max: 400, hardDirection: 'higher'
  });

  console.log = origLog;
  assert.ok(logs.some(l => l.includes('레벨 기반')), '레벨 기반 판정 모드 로그 있어야 함');
});
