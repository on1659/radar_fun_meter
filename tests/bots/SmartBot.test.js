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
