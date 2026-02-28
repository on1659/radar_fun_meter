const { test } = require('node:test');
const assert = require('node:assert/strict');
const RhythmTapAdapter = require('../../games/rhythm-tap/RhythmTapAdapter');

function smokeTest(adapter) {
  adapter.reset();
  assert.equal(typeof adapter.isAlive(), 'boolean');
  assert.equal(typeof adapter.getScore(), 'number');
  assert.equal(typeof adapter.getDifficulty(), 'number');
  assert.equal(typeof adapter.getName(), 'string');
  adapter.update(null);
  adapter.update('action');
  assert.ok(true);
}

test('RhythmTapAdapter: reset() 후 alive=true', () => {
  const game = new RhythmTapAdapter();
  game.reset();
  assert.equal(game.isAlive(), true);
  assert.equal(game.getScore(), 0);
});

test('RhythmTapAdapter: 인터페이스 smoke test', () => {
  smokeTest(new RhythmTapAdapter());
});

test('RhythmTapAdapter: botAccuracy 설정 반영', () => {
  const game = new RhythmTapAdapter({ botAccuracy: 0.5 });
  assert.equal(game.botAccuracy, 0.5);
});
