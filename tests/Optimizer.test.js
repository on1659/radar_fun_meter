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
