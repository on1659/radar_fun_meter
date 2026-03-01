const { test } = require('node:test');
const assert = require('node:assert/strict');
const FlappyBirdBot = require('../../src/bots/FlappyBirdBot');

// game.tick=10 so ticksSinceLast = 10-0 = 10 >= 5 (cooldown 통과)
function makeGame(overrides = {}) {
  return {
    playerY: 150,
    playerVY: 0,
    speed: 150,
    tick: 10,
    isOnGround: false,
    _cfg: { gravity: 0.4, playerX: 80, playerWidth: 34, margin: 4 },
    obstacles: [],
    ...overrides,
  };
}

function makePipe(x, gapTop = 100, gapBottom = 220) {
  return { id: x, x, gapTop, gapBottom, width: 52, passed: false };
}

// F-1: reset() 상태 초기화
test('FlappyBirdBot: reset() 후 _pendingTick=null, _lastDecision=0', () => {
  const bot = new FlappyBirdBot();
  bot._pendingTick = 5;
  bot._lastDecision = 10;
  bot.reset();
  assert.equal(bot._pendingTick, null);
  assert.equal(bot._lastDecision, 0);
});

// F-2: 기본값 검증
test('FlappyBirdBot: 기본값 accuracy=0.9, reactionMin=100, reactionMax=300', () => {
  const bot = new FlappyBirdBot();
  assert.equal(bot.accuracy, 0.9);
  assert.equal(bot.reactionMin, 100);
  assert.equal(bot.reactionMax, 300);
});

// F-3: 파이프 없을 때 null
test('FlappyBirdBot: 파이프 없을 때 decide() → null', () => {
  const bot = new FlappyBirdBot();
  bot.reset();
  const game = makeGame({ playerY: 300, obstacles: [] });
  const result = bot.decide(game);
  assert.equal(result, null);
});

// F-4: 파이프 감지 시 _pendingTick 예약
// playerY=300 (낮음) → futureY가 targetY(160)+10보다 훨씬 높음 → 위협 감지
test('FlappyBirdBot: 파이프 감지 시 _pendingTick 예약됨', () => {
  const bot = new FlappyBirdBot({ accuracy: 1.0 });
  bot.reset();
  const game = makeGame({
    playerY: 300,
    tick: 10,
    obstacles: [makePipe(200)],
  });
  bot.decide(game);
  assert.ok(bot._pendingTick !== null && bot._pendingTick > 0,
    `_pendingTick should be > 0, got ${bot._pendingTick}`);
});

// F-5: _pendingTick 만료 후 'action' 반환
// reactionMin=reactionMax=100ms → _minTicks=_maxTicks=6 → delay=6 고정
test('FlappyBirdBot: accuracy=1.0이면 pendingTick 만료 시 action 반환', () => {
  const bot = new FlappyBirdBot({ accuracy: 1.0, reactionMin: 100, reactionMax: 100 });
  bot.reset();
  const game = makeGame({
    playerY: 300,
    tick: 10,
    obstacles: [makePipe(200)],
  });

  // 첫 번째 decide: _pendingTick=6 예약
  let result = bot.decide(game);
  assert.equal(result, null);
  assert.equal(bot._pendingTick, 6);

  // 5번 카운트다운: 6→5→4→3→2→1, 모두 null
  for (let i = 0; i < 5; i++) {
    game.tick++;
    result = bot.decide(game);
    assert.equal(result, null);
  }

  // 만료: 1→0 → 'action' 반환
  game.tick++;
  result = bot.decide(game);
  assert.equal(result, 'action');
  assert.equal(bot._pendingTick, null);
});

// F-6: accuracy=0.0이면 만료 후 null
test('FlappyBirdBot: accuracy=0.0이면 pendingTick 만료 후 null 반환', () => {
  const bot = new FlappyBirdBot({ accuracy: 0.0, reactionMin: 100, reactionMax: 100 });
  bot.reset();
  const game = makeGame({
    playerY: 300,
    tick: 10,
    obstacles: [makePipe(200)],
  });

  // 예약
  bot.decide(game);

  // 만료까지 + 추가 호출 → 모두 null
  const results = [];
  for (let i = 0; i < 8; i++) {
    game.tick++;
    results.push(bot.decide(game));
  }
  assert.ok(results.every(r => r === null),
    `accuracy=0이면 action 없어야 함: ${JSON.stringify(results)}`);
});

// F-7: 5틱 이내 재예약 불가 (연속 입력 방지)
test('FlappyBirdBot: 5틱 이내 재예약 시 _pendingTick 설정 안됨', () => {
  const bot = new FlappyBirdBot({ accuracy: 1.0 });
  bot.reset();
  const game = makeGame({
    playerY: 300,
    tick: 10,
    obstacles: [makePipe(200)],
  });

  // 첫 번째 호출: _pendingTick 예약, _lastDecision=10
  bot.decide(game);
  assert.ok(bot._pendingTick !== null);

  // _pendingTick을 수동으로 null로 초기화 (카운트다운 스킵)
  bot._pendingTick = null;

  // tick=11: ticksSinceLast = 11-10 = 1 < 5 → 재예약 불가
  game.tick = 11;
  bot.decide(game);
  assert.equal(bot._pendingTick, null,
    '_pendingTick should not be re-set within 5 ticks of last decision');
});

// F-8: _findNextPipe: 플레이어 뒤 파이프(x < playerX) → null 반환
// playerX=80, pipe.x=50 → dist = 50-80 = -30 < 0 → 무시 → null 반환
test('FlappyBirdBot: _findNextPipe: 플레이어 뒤 파이프는 null 반환', () => {
  const bot = new FlappyBirdBot({ accuracy: 1.0 });
  bot.reset();
  const game = makeGame({
    playerY: 150,
    tick: 10,
    obstacles: [makePipe(50)],  // 플레이어 뒤쪽 파이프 (x=50 < playerX=80)
  });
  const result = bot._findNextPipe(game);
  assert.equal(result, null, '플레이어 뒤 파이프는 null 반환해야 함');
});
