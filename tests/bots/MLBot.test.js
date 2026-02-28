'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');

const MLBot = require('../../src/bots/MLBot');
const FunMeter = require('../../src/FunMeter');
const ExampleGame = require('../../games/example/ExampleGame');

// 최소 mock 게임 헬퍼
function makeMockGame(overrides = {}) {
  return {
    score: 0,
    alive: true,
    getScore() { return this.score; },
    isAlive() { return this.alive; },
    getDifficulty() { return 0.5; },
    reset() { this.score = 0; this.alive = true; },
    update() { this.score += 1; },
    getStateVector: null,  // 기본: 미구현
    ...overrides,
  };
}

// ──────────────────────────────────────────
// 시나리오 1: train()이 Q-테이블을 채운다
// ──────────────────────────────────────────
test('train()이 Q-테이블을 채운다', () => {
  const bot = new MLBot({ epsilon: 0.3, buckets: 5 });
  const game = new ExampleGame();

  assert.equal(Object.keys(bot._qTable).length, 0);
  bot.train(game, 50);
  assert.ok(Object.keys(bot._qTable).length > 0, 'Q-테이블에 엔트리가 생겨야 함');
});

// ──────────────────────────────────────────
// 시나리오 2: reset()이 Q-테이블을 보존
// ──────────────────────────────────────────
test('reset()은 Q-테이블을 유지하고 에피소드 상태만 초기화', () => {
  const bot = new MLBot({ epsilon: 0.3, buckets: 5 });
  const game = new ExampleGame();
  bot.train(game, 20);
  const tableSize = Object.keys(bot._qTable).length;

  bot.reset();
  assert.equal(Object.keys(bot._qTable).length, tableSize, 'Q-테이블 보존');
});

// ──────────────────────────────────────────
// 시나리오 3: decide()가 actions 목록 내 값만 반환
// ──────────────────────────────────────────
test('decide()는 actions에 포함된 값만 반환', () => {
  const bot = new MLBot({ actions: ['action', null] });
  const game = makeMockGame();
  for (let i = 0; i < 100; i++) {
    const action = bot.decide(game);
    assert.ok(action === 'action' || action === null,
              `유효하지 않은 action: ${action}`);
  }
});

// ──────────────────────────────────────────
// 시나리오 4: save() / load() 라운드트립
// ──────────────────────────────────────────
test('save/load 후 Q-테이블 동일', () => {
  const bot = new MLBot({ epsilon: 0.3, buckets: 5 });
  const game = new ExampleGame();
  bot.train(game, 30);
  bot.epsilon = 0.0;

  const tmpPath = path.join(os.tmpdir(), `mlbot-test-${Date.now()}.json`);
  bot.save(tmpPath);

  const loaded = MLBot.load(tmpPath);
  assert.deepEqual(loaded._qTable, bot._qTable);
  assert.equal(loaded.epsilon, 0.0);  // load 기본값
  assert.equal(loaded.buckets, bot.buckets);

  fs.unlinkSync(tmpPath);  // 정리
});

// ──────────────────────────────────────────
// 시나리오 5: getStateVector() 훅이 우선 적용됨
// ──────────────────────────────────────────
test('getStateVector()를 구현한 게임은 훅 결과를 상태로 사용', () => {
  const bot = new MLBot({ buckets: 5 });
  let hookCalled = false;
  const game = makeMockGame({
    getStateVector: () => { hookCalled = true; return [0.5, 0.5]; },
  });

  bot.decide(game);
  assert.ok(hookCalled, 'getStateVector() 훅이 호출되어야 함');
});

// ──────────────────────────────────────────
// 시나리오 6: _discretize() 경계값 클램핑
// ──────────────────────────────────────────
test('_discretize()는 [0,1] 범위 초과 값을 안전하게 클램핑', () => {
  const bot = new MLBot({ buckets: 10 });

  // 음수 → 0 버킷
  const low = bot._discretize([-0.5, 0.0]);
  assert.equal(low, '0,0');

  // 1 초과 → 최대 버킷 (buckets-1 = 9)
  const high = bot._discretize([1.5, 2.0]);
  assert.equal(high, '9,9');

  // 경계값 1.0 → 최대 버킷 (Math.floor(1.0 * 10) = 10 → min(10, 9) = 9)
  const boundary = bot._discretize([1.0, 0.5]);
  assert.equal(boundary, '9,5');
});

// ──────────────────────────────────────────
// 시나리오 7: null 행동의 Q-테이블 키 처리
// ──────────────────────────────────────────
test('null 행동이 "null" 문자열 키로 저장/조회됨', () => {
  const bot = new MLBot({ actions: ['action', null], buckets: 5 });

  // null 행동에 Q값 직접 설정
  bot._setQ('2,3', null, 0.42);

  // Q-테이블 내부는 "null" 문자열 키
  assert.ok(bot._qTable['2,3'] !== undefined);
  assert.ok('null' in bot._qTable['2,3'], '"null" 키가 Q-테이블에 존재해야 함');

  // _getQ로 null 행동 조회
  assert.equal(bot._getQ('2,3', null), 0.42, 'null 행동 Q값 조회 정확');

  // _bestAction이 Q값이 높은 null 행동 선택
  bot._setQ('2,3', 'action', -0.5);
  assert.equal(bot._bestAction('2,3'), null, 'Q값이 높은 null 행동 선택');
});

// ──────────────────────────────────────────
// 시나리오 8: FunMeter.run()과 통합 (학습 후 추론)
// ──────────────────────────────────────────
test('학습된 MLBot을 FunMeter로 실행해도 충돌 없음', () => {
  const bot = new MLBot({ epsilon: 0.3, buckets: 5 });
  const game = new ExampleGame();
  bot.train(game, 50);
  bot.epsilon = 0.0;

  const meter = new FunMeter({ maxSeconds: 5 });
  const result = meter.run(new ExampleGame(), bot, 10, { verbose: false });
  assert.ok(/^(FLOW|TOO_HARD|TOO_EASY)$/.test(result.zone));
  assert.equal(result.runs, 10);
});
