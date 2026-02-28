const { test } = require('node:test');
const assert = require('node:assert/strict');
const FlappyBirdAdapter = require('../../games/flappy-bird/FlappyBirdAdapter');

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

test('FlappyBirdAdapter: reset() 후 alive=true', () => {
  const game = new FlappyBirdAdapter();
  game.reset();
  assert.equal(game.isAlive(), true);
  assert.equal(game.getScore(), 0);
});

test('FlappyBirdAdapter: 인터페이스 smoke test', () => {
  smokeTest(new FlappyBirdAdapter());
});

test('FlappyBirdAdapter: obstacles 배열 보유', () => {
  const game = new FlappyBirdAdapter();
  game.reset();
  assert.ok(Array.isArray(game.obstacles));
});
