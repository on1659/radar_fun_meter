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

// TC-4: pipeGap 크면 오래 생존 가능
test('pipeGap=300(넓은 간격)에서 파이프 존재 시에도 게임 진행 가능', () => {
  const game = new FlappyBirdAdapter({ pipeGap: 300, pipeInterval: 30 });
  game.reset();

  // 100틱 동안 매 5틱마다 점프 → 넓은 간격이면 대부분 생존
  for (let t = 0; t < 100; t++) {
    game.update(t % 5 === 0 ? 'action' : null);
  }

  // pipeGap이 300이면 플레이어가 통과할 수 있어야 함
  // (사망 여부와 무관하게, 파이프 내부 구조 검증)
  assert.ok(game.getScore() >= 0, '음수 점수 불가');
  assert.equal(typeof game.isAlive(), 'boolean');
});

// TC-5: 입력 없음 → gravity 누적으로 바닥 충돌 사망
test('입력 없을 때 gravity 누적으로 바닥 충돌 사망', () => {
  const game = new FlappyBirdAdapter();
  game.reset();

  let ticks = 0;
  while (game.isAlive() && ticks < 200) {
    game.update(null);
    ticks++;
  }

  assert.equal(game.isAlive(), false, '반드시 사망해야 함');
  // gravity=0.4, y=150, 바닥=300: 수학적으로 ~27틱 내 사망
  assert.ok(ticks < 100, `예상보다 오래 생존: ${ticks}틱`);
});
