const { test } = require('node:test');
const assert = require('node:assert/strict');
const StackTowerAdapter = require('../../games/stack-tower/StackTowerAdapter');

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

test('StackTowerAdapter: reset() 후 alive=true', () => {
  const game = new StackTowerAdapter();
  game.reset();
  assert.equal(game.isAlive(), true);
  assert.equal(game.getScore(), 0);
});

test('StackTowerAdapter: 인터페이스 smoke test', () => {
  smokeTest(new StackTowerAdapter());
});

test('StackTowerAdapter: botError 설정 반영', () => {
  const game = new StackTowerAdapter({ botError: 25 });
  assert.equal(game.botError, 25);
});
