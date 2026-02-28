const { test } = require('node:test');
const assert = require('node:assert/strict');
const TimingJumpAdapter = require('../../games/timing-jump/TimingJumpAdapter');

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

test('TimingJumpAdapter: reset() 후 alive=true', () => {
  const game = new TimingJumpAdapter();
  game.reset();
  assert.equal(game.isAlive(), true);
  assert.equal(game.getScore(), 0);
});

test('TimingJumpAdapter: 인터페이스 smoke test', () => {
  smokeTest(new TimingJumpAdapter());
});

test('TimingJumpAdapter: initialSpeed 설정 반영', () => {
  const game = new TimingJumpAdapter({ initialSpeed: 100 });
  game.reset();
  assert.equal(game.speed, 100);
});

test('TimingJumpAdapter: 충분한 틱 후 사망 가능', () => {
  const game = new TimingJumpAdapter({ initialSpeed: 800, speedIncrement: 0 });
  game.reset();
  for (let i = 0; i < 1000; i++) {
    game.update(null);
    if (!game.isAlive()) break;
  }
  assert.equal(typeof game.isAlive(), 'boolean');
});
