const { test } = require('node:test');
const assert = require('node:assert/strict');
const RandomBot = require('../../src/bots/RandomBot');

test('RandomBot: jumpProb=0 → 항상 null 반환', () => {
  const bot = new RandomBot({ jumpProb: 0 });
  for (let i = 0; i < 100; i++) {
    assert.equal(bot.decide({}), null);
  }
});

test('RandomBot: jumpProb=1 → 항상 action 반환', () => {
  const bot = new RandomBot({ jumpProb: 1 });
  for (let i = 0; i < 100; i++) {
    assert.equal(bot.decide({}), 'action');
  }
});

test('RandomBot: decide() 반환값은 action 또는 null', () => {
  const bot = new RandomBot({ jumpProb: 0.5 });
  for (let i = 0; i < 200; i++) {
    const result = bot.decide({});
    assert.ok(result === 'action' || result === null);
  }
});

test('RandomBot: 기본 jumpProb = 0.05', () => {
  const bot = new RandomBot();
  assert.equal(bot.jumpProb, 0.05);
});
