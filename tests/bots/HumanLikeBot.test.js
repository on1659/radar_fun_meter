const { test } = require('node:test');
const assert = require('node:assert/strict');
const HumanLikeBot = require('../../src/bots/HumanLikeBot');

test('HumanLikeBot: reset() 후 내부 상태 클리어', () => {
  const bot = new HumanLikeBot();
  bot._pendingTick = 5;
  bot._handledIds.add('obs_1');
  bot.reset();
  assert.equal(bot._pendingTick, null);
  assert.equal(bot._handledIds.size, 0);
});

test('HumanLikeBot: 기본값 accuracy=0.9, reactionMin=100, reactionMax=300', () => {
  const bot = new HumanLikeBot();
  assert.equal(bot.accuracy, 0.9);
  assert.equal(bot.reactionMin, 100);
  assert.equal(bot.reactionMax, 300);
});

test('HumanLikeBot: 위협 없음 → null 반환', () => {
  const bot = new HumanLikeBot();
  const fakeGame = { obstacles: [] };
  const result = bot.decide(fakeGame);
  assert.equal(result, null);
});

test('HumanLikeBot: ms → ticks 변환', () => {
  const bot = new HumanLikeBot({ reactionMin: 100, reactionMax: 300, ticksPerSecond: 60 });
  // 100ms / (1000/60) = 6 ticks, 300ms / (1000/60) = 18 ticks
  assert.equal(bot._minTicks, 6);
  assert.equal(bot._maxTicks, 18);
});
