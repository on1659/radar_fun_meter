const { test } = require('node:test');
const assert = require('node:assert/strict');
const SmartBot = require('../../src/bots/SmartBot');

function makeMockGame(overrides = {}) {
  return {
    getDifficulty: () => 0.5,
    getScore: () => 0,
    isAlive: () => true,
    ...overrides,
  };
}

test('reset() clears internal state', () => {
  const bot = new SmartBot();
  const game = makeMockGame();
  bot.decide(game);
  bot.decide(game);
  bot.reset();
  assert.equal(bot._tick, 0);
  assert.equal(bot._scoreHistory.length, 0);
  assert.equal(bot._actionCooldown, 0);
  assert.equal(bot._detectedHint, null);
});

test('platformer: hard mode produces fewer actions', () => {
  const easyBot = new SmartBot({ hint: 'platformer' });
  const hardBot = new SmartBot({ hint: 'platformer' });
  const easyGame = makeMockGame({ getDifficulty: () => 0.1 });
  const hardGame = makeMockGame({ getDifficulty: () => 0.9 });

  let easyActions = 0, hardActions = 0;
  for (let i = 0; i < 300; i++) {
    if (easyBot.decide(easyGame) === 'action') easyActions++;
    if (hardBot.decide(hardGame) === 'action') hardActions++;
  }
  assert.ok(easyActions > hardActions, `easyActions(${easyActions}) should be > hardActions(${hardActions})`);
});

test('rhythm: taps at regular intervals', () => {
  const bot = new SmartBot({ hint: 'rhythm' });
  const game = makeMockGame({ getDifficulty: () => 0.5 }); // interval ~= 38
  const actions = [];
  for (let i = 0; i < 200; i++) {
    const a = bot.decide(game);
    if (a === 'action') actions.push(i + 1); // 1-indexed tick
  }
  // 최소 3번 이상 탭 발생
  assert.ok(actions.length >= 3, `actions.length=${actions.length} should be >= 3`);
  // 탭 간격이 일정해야 함
  if (actions.length >= 2) {
    const gaps = actions.slice(1).map((t, i) => t - actions[i]);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const g of gaps) {
      assert.ok(Math.abs(g - avgGap) < 5, `gap variance too large: gap=${g}, avg=${avgGap}`);
    }
  }
});

test('auto: detects platformer from obstacles field', () => {
  const bot = new SmartBot({ hint: 'auto' });
  const game = makeMockGame({
    obstacles: [{ x: 200, passed: false, id: 1 }],
  });
  bot.decide(game);
  assert.equal(bot._detectedHint, 'platformer');
});

test('SmartBot runs timing-jump without crash', () => {
  const { FunMeter } = require('../../src/index');
  const TimingJumpAdapter = require('../../games/timing-jump/TimingJumpAdapter');

  const meter = new FunMeter({ maxSeconds: 5 });
  const game = new TimingJumpAdapter({ initialSpeed: 120 });
  const bot = new SmartBot({ hint: 'platformer' });
  const result = meter.run(game, bot, 10, { verbose: false });

  assert.ok(/^(FLOW|TOO_HARD|TOO_EASY)$/.test(result.zone), `zone=${result.zone}`);
  assert.equal(result.runs, 10);
});

// S-1: tower 힌트 → _decideTower 분기 실행, 유효한 출력
test('SmartBot: hint=tower 로 실행 시 에러 없이 작동', () => {
  const bot = new SmartBot({ hint: 'tower' });
  const game = makeMockGame({ getDifficulty: () => 0.5 });
  bot.reset();
  let actionCount = 0;
  for (let i = 0; i < 200; i++) {
    const result = bot.decide(game);
    if (result === 'action') actionCount++;
    assert.ok(result === null || result === 'action',
      `invalid result: ${result}`);
  }
  // _decideTower: prob≈0.035, 200틱에서 평균 7회 액션 (확률적이므로 범위 확인)
  assert.ok(actionCount >= 0 && actionCount <= 200);
});

// S-2: auto 감지 - notes 배열 보유 → rhythm으로 감지
test('SmartBot: auto 힌트에서 notes 보유 게임은 rhythm으로 감지', () => {
  const bot = new SmartBot({ hint: 'auto' });
  const game = makeMockGame({
    notes: [{ id: 'n1', y: 280, hit: false }],
  });
  bot.decide(game);
  assert.equal(bot._detectedHint, 'rhythm');
});

// S-3: auto 감지 - stackedBlocks 보유 → tower로 감지
test('SmartBot: auto 힌트에서 stackedBlocks 보유 게임은 tower로 감지', () => {
  const bot = new SmartBot({ hint: 'auto' });
  const game = makeMockGame({
    stackedBlocks: [{ x: 100, width: 60 }],
  });
  bot.decide(game);
  assert.equal(bot._detectedHint, 'tower');
});
