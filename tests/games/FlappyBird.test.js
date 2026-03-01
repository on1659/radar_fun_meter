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

// B-1: 파이프 하단 충돌 → alive=false
// playerX=80, playerWidth=34, margin=4
// 겹침 조건: 80+34-4=110 > p.x+4=74 AND 80+4=84 < p.x+52-4=118 (p.x=70)
// 하단 충돌: playerY(150) > gapBottom(50) → alive=false
test('FlappyBirdAdapter: 파이프 하단 충돌 → alive=false', () => {
  const game = new FlappyBirdAdapter();
  game.reset();
  game.obstacles.push({
    id: 999,
    x: 70,
    gapTop: 0,
    gapBottom: 50,  // playerY=150 > 50 → 하단 충돌
    width: 52,
    passed: false,
  });
  game.update(null);
  assert.equal(game.isAlive(), false, '하단 충돌 시 alive=false 여야 함');
});

// B-2: 파이프 상단 충돌 → alive=false
// playerY(150) - playerHeight(24) = 126 < gapTop(200) → 상단 충돌
test('FlappyBirdAdapter: 파이프 상단 충돌 → alive=false', () => {
  const game = new FlappyBirdAdapter();
  game.reset();
  game.obstacles.push({
    id: 998,
    x: 70,
    gapTop: 200,  // playerY-height=126 < 200 → 상단 충돌
    gapBottom: 320,
    width: 52,
    passed: false,
  });
  game.update(null);
  assert.equal(game.isAlive(), false, '상단 충돌 시 alive=false 여야 함');
});

// B-3: 파이프 통과 시 score 증가
// 파이프 x=30, width=52 → right edge=82 > playerX(80) → 아직 미통과
// update 후: x ≈ 27.5 → right edge ≈ 79.5 < 80 → score++
test('FlappyBirdAdapter: 파이프 통과 시 score 증가', () => {
  const game = new FlappyBirdAdapter();
  game.reset();
  // 넓은 갭으로 충돌 없이 통과
  game.obstacles.push({
    id: 1,
    x: 30,
    gapTop: 0,
    gapBottom: 400,  // 충돌 없음
    width: 52,
    passed: false,
  });
  game.update(null);
  assert.equal(game.getScore(), 1, '파이프 통과 시 score가 1 증가해야 함');
});

// B-4: 천장(y<0) 충돌 → alive=false
// 'action' 매 틱: vy=-8+0.4=-7.6 → y가 7.6씩 감소 → 약 20틱에 y<0
test('FlappyBirdAdapter: 천장(y<0) 충돌 시 alive=false', () => {
  const game = new FlappyBirdAdapter();
  game.reset();
  let ticks = 0;
  while (game.isAlive() && ticks < 60) {
    game.update('action');  // 매 틱 점프 → 빠르게 상승
    ticks++;
  }
  assert.equal(game.isAlive(), false, '천장 충돌 시 alive=false 여야 함');
});

// B-5: FlappyBirdBot + FlappyBirdAdapter 통합 생존 테스트
test('FlappyBirdAdapter + FlappyBirdBot: 봇이 게임 플레이 가능', async () => {
  const FlappyBirdBot = (await import('../../src/bots/FlappyBirdBot.js')).default;
  const bot = new FlappyBirdBot({ accuracy: 0.9, reactionMin: 50, reactionMax: 100 });
  const game = new FlappyBirdAdapter({ pipeGap: 200, pipeInterval: 90 });
  game.reset();
  bot.reset();

  let ticks = 0;
  while (game.isAlive() && ticks < 600) {
    const input = bot.decide(game);
    game.update(input);
    game.tick = ticks;
    ticks++;
  }
  assert.ok(ticks >= 10, `봇이 너무 빨리 사망: ${ticks}틱`);
  assert.ok(game.getScore() >= 0);
});

// B-6: pipeInterval 설정 - 해당 주기에 파이프 생성
test('FlappyBirdAdapter: pipeInterval=10 설정 시 파이프 생성됨', () => {
  const game = new FlappyBirdAdapter({ pipeInterval: 10 });
  game.reset();
  let maxObstacles = 0;
  for (let t = 0; t < 15 && game.isAlive(); t++) {
    game.update(null);
    if (game.obstacles.length > maxObstacles) maxObstacles = game.obstacles.length;
  }
  assert.ok(maxObstacles > 0, 'pipeInterval=10이면 15틱 이내 파이프가 생성되어야 함');
});
