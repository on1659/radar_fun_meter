const { test } = require('node:test');
const assert = require('node:assert/strict');

test('index.js exports 6개 핵심 심볼', () => {
  const lib = require('../src/index');
  assert.ok(typeof lib.FunMeter === 'function');
  assert.ok(typeof lib.GameAdapter === 'function');
  assert.ok(typeof lib.Optimizer === 'function');
  assert.ok(typeof lib.RandomBot === 'function');
  assert.ok(typeof lib.HumanLikeBot === 'function');
  assert.ok(typeof lib.DEFAULT_PARAMS === 'object');
});

test('기존 직접 경로 import 여전히 동작', () => {
  const FunMeter = require('../src/FunMeter');
  const RandomBot = require('../src/bots/RandomBot');
  assert.ok(typeof FunMeter === 'function');
  assert.ok(typeof RandomBot === 'function');
});

test('index.js로 FunMeter + RandomBot 정상 실행', () => {
  const { FunMeter, RandomBot, GameAdapter } = require('../src/index');

  class TrivialGame extends GameAdapter {
    reset() { this._t = 0; }
    update() { this._t++; }
    isAlive() { return this._t < 30; }
    getScore() { return this._t; }
    getDifficulty() { return 0.5; }
    getName() { return 'trivial'; }
  }

  const meter = new FunMeter({ ticksPerSecond: 60, maxSeconds: 10 });
  const bot = new RandomBot({ jumpProb: 0 });
  const result = meter.run(new TrivialGame(), bot, 5, { verbose: false });

  assert.equal(result.zone, 'TOO_HARD'); // 0.5초 생존 → TOO_HARD
  assert.ok(Array.isArray(result.times));
  assert.equal(result.runs, 5);
});
