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

// H-1: TimingJump 지상에서 장애물 접근 → 위협 감지
// detectionDist = (106-80) + (18+18)*4.33 ≈ 26 + 155 = 181
// obstacle at x=200 → dist=120 < 181 → 감지됨
test('HumanLikeBot: TimingJump 장애물 접근 시 _pendingTick 설정', () => {
  const bot = new HumanLikeBot({ accuracy: 1.0 });
  bot.reset();
  const game = {
    isOnGround: true,
    speed: 260,
    _cfg: { playerX: 80, playerWidth: 30, margin: 4 },
    obstacles: [{ id: 'obs1', x: 200, passed: false }],
    tick: 0,
  };
  bot.decide(game);
  assert.ok(bot._pendingTick !== null && bot._pendingTick > 0,
    `_pendingTick should be set, got ${bot._pendingTick}`);
});

// H-2: TimingJump 공중(isOnGround=false) → 감지 안함
test('HumanLikeBot: 공중(isOnGround=false)이면 TimingJump 감지 안함', () => {
  const bot = new HumanLikeBot();
  bot.reset();
  const game = {
    isOnGround: false,  // 공중
    speed: 260,
    _cfg: { playerX: 80, playerWidth: 30, margin: 4 },
    obstacles: [{ id: 'obs1', x: 200, passed: false }],
    tick: 0,
  };
  const result = bot.decide(game);
  assert.equal(result, null);
  assert.equal(bot._pendingTick, null);
});

// H-3: 이미 처리된 장애물 ID는 재감지 안함
test('HumanLikeBot: 이미 처리된 장애물 ID 재감지 안함', () => {
  const bot = new HumanLikeBot({ accuracy: 1.0 });
  bot.reset();
  const game = {
    isOnGround: true,
    speed: 260,
    _cfg: { playerX: 80, playerWidth: 30, margin: 4 },
    obstacles: [{ id: 'obs1', x: 200, passed: false }],
    tick: 0,
  };
  // 첫 번째 decide: 감지, _handledIds에 'obs1' 추가
  bot.decide(game);
  assert.ok(bot._handledIds.has('obs1'));

  // _pendingTick 수동 초기화 (카운트다운 스킵)
  bot._pendingTick = null;

  // 두 번째 decide: 같은 장애물 → 무시
  bot.decide(game);
  assert.equal(bot._pendingTick, null,
    '이미 처리된 ID는 재예약 안됨');
});

// H-4: StackTower 블록 중앙 정렬 시 반응
// currCenter=130, prevCenter=138, dist=8 < threshold(28.8) → 감지
test('HumanLikeBot: StackTower 블록 중앙 정렬 시 _pendingTick 설정', () => {
  const bot = new HumanLikeBot({ accuracy: 1.0 });
  bot.reset();
  const game = {
    currentBlock: { x: 100, width: 60 },
    stackedBlocks: [{ x: 108, width: 60 }],
    speed: 3,
  };
  bot.decide(game);
  assert.ok(bot._pendingTick !== null && bot._pendingTick > 0,
    `StackTower 위협 감지 후 _pendingTick 설정됨, got ${bot._pendingTick}`);
});

// H-5: RhythmTap 타겟 근처 노트 감지
// targetY=320, note.y=280 → dist=40 <= detectionDist(50+36=86) → 감지
test('HumanLikeBot: RhythmTap 타겟 근처 노트 감지 시 _pendingTick 설정', () => {
  const bot = new HumanLikeBot({ accuracy: 1.0 });
  bot.reset();
  const game = {
    notes: [{ id: 'n1', y: 280, hit: false }],
    _cfg: { targetY: 320, goodRange: 50 },
    speed: 3,
  };
  bot.decide(game);
  assert.ok(bot._pendingTick !== null && bot._pendingTick > 0,
    `RhythmTap 위협 감지 후 _pendingTick 설정됨, got ${bot._pendingTick}`);
});

// H-6: 이미 hit된 노트는 무시
test('HumanLikeBot: hit=true인 노트는 RhythmTap 감지 안함', () => {
  const bot = new HumanLikeBot();
  bot.reset();
  const game = {
    notes: [{ id: 'n1', y: 280, hit: true }],  // 이미 hit됨
    _cfg: { targetY: 320, goodRange: 50 },
    speed: 3,
  };
  const result = bot.decide(game);
  assert.equal(result, null);
  assert.equal(bot._pendingTick, null);
});

// H-7: 위협 감지 후 _pendingTick 범위 검증 (6 ≤ _pendingTick ≤ 18)
test('HumanLikeBot: 위협 감지 후 _pendingTick 범위 6~18', () => {
  const bot = new HumanLikeBot({ reactionMin: 100, reactionMax: 300, ticksPerSecond: 60 });
  bot.reset();
  const game = {
    isOnGround: true,
    speed: 260,
    _cfg: { playerX: 80, playerWidth: 30, margin: 4 },
    obstacles: [{ id: 'obs1', x: 200, passed: false }],
    tick: 0,
  };
  bot.decide(game);
  assert.ok(bot._pendingTick !== null, '_pendingTick should be set');
  assert.ok(bot._pendingTick >= 6 && bot._pendingTick <= 18,
    `_pendingTick=${bot._pendingTick} should be in [6, 18]`);
});

// H-8: accuracy=1.0이면 pendingTick 만료 시 항상 'action'
test('HumanLikeBot: accuracy=1.0이면 pendingTick 만료 시 항상 action', () => {
  const bot = new HumanLikeBot({ accuracy: 1.0, reactionMin: 100, reactionMax: 100 });
  bot.reset();
  // _pendingTick 직접 설정 (카운트다운 시작)
  bot._pendingTick = 1;
  const result = bot.decide({ obstacles: [] });
  // _pendingTick=1 → decrement to 0 → return 'action' (accuracy=1.0)
  assert.equal(result, 'action');
  assert.equal(bot._pendingTick, null);
});

// H-9: accuracy=0.0이면 pendingTick 만료 시 항상 null
test('HumanLikeBot: accuracy=0.0이면 pendingTick 만료 시 항상 null', () => {
  const bot = new HumanLikeBot({ accuracy: 0.0, reactionMin: 100, reactionMax: 100 });
  bot.reset();
  // 여러 번 실행해서 항상 null인지 확인
  let allNull = true;
  for (let i = 0; i < 10; i++) {
    bot._pendingTick = 1;
    const result = bot.decide({ obstacles: [] });
    if (result !== null) { allNull = false; break; }
  }
  assert.ok(allNull, 'accuracy=0이면 만료 시 항상 null 반환');
});

// 시나리오 2: TimingJump → reset → StackTower 게임 전환
test('HumanLikeBot: 게임 전환 시 reset() 후 이전 상태 오염 없음', () => {
  const bot = new HumanLikeBot({ accuracy: 1.0 });

  // Phase 1: TimingJump
  bot.reset();
  const timingGame = {
    isOnGround: true,
    speed: 260,
    _cfg: { playerX: 80, playerWidth: 30, margin: 4 },
    obstacles: [{ id: 'obs1', x: 200, passed: false }],
    tick: 0,
  };
  bot.decide(timingGame);
  assert.ok(bot._pendingTick !== null && bot._pendingTick > 0, 'TimingJump 감지됨');

  // Phase 2: reset (게임 전환)
  bot.reset();
  assert.equal(bot._pendingTick, null);
  assert.equal(bot._handledIds.size, 0);

  // Phase 3: StackTower
  const towerGame = {
    currentBlock: { x: 100, width: 60 },
    stackedBlocks: [{ x: 108, width: 60 }],
    speed: 3,
  };
  bot.decide(towerGame);
  assert.ok(bot._pendingTick !== null && bot._pendingTick > 0, 'StackTower 감지됨');
});
