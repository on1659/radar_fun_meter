const { test } = require('node:test');
const assert = require('node:assert/strict');
const BrowserBot = require('../src/bots/BrowserBot');

// T2-2a: jumpProb=0 이면 항상 null 반환
test('act() returns null always with jumpProb=0', () => {
  const bot = new BrowserBot({ actions: ['Space'], jumpProb: 0 });
  for (let i = 0; i < 100; i++) {
    assert.equal(bot.act({ score: 0, elapsed: 0 }), null);
  }
});

// T2-2b: jumpProb=1.0 이면 항상 actions 중 하나 반환
test('act() returns one of allowed actions with jumpProb=1.0', () => {
  const bot = new BrowserBot({ actions: ['Space', 'ArrowLeft'], jumpProb: 1.0 });
  for (let i = 0; i < 20; i++) {
    const action = bot.act({ score: 0, elapsed: 0 });
    assert.ok(['Space', 'ArrowLeft'].includes(action), `Expected Space or ArrowLeft, got ${action}`);
  }
});

// T2-2c: 기본값 확인
test('BrowserBot has correct default values', () => {
  const bot = new BrowserBot();
  assert.deepEqual(bot.actions, ['Space']);
  assert.equal(bot.jumpProb, 0.05);
});

// T2-2d: reset()은 아무것도 안 함 (에러 없음)
test('reset() does not throw', () => {
  const bot = new BrowserBot({ actions: ['Space'], jumpProb: 0.5 });
  assert.doesNotThrow(() => bot.reset());
});

// T2-2e: actions 배열의 각 항목이 반환될 수 있음 (통계적)
test('act() can return each action in the list', () => {
  const bot = new BrowserBot({ actions: ['Space', 'ArrowLeft', 'ArrowRight'], jumpProb: 1.0 });
  const results = new Set();
  for (let i = 0; i < 1000; i++) {
    results.add(bot.act({ score: 0, elapsed: 0 }));
  }
  assert.ok(results.has('Space'), 'Should return Space');
  assert.ok(results.has('ArrowLeft'), 'Should return ArrowLeft');
  assert.ok(results.has('ArrowRight'), 'Should return ArrowRight');
});
