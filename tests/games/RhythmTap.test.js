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

// R-1: 충분한 틱 후 notes 배열에 노트 존재
// nextNoteIn=10 → 10틱 후 첫 노트 스폰
test('RhythmTapAdapter: 100틱 동안 notes 생성됨', () => {
  const game = new RhythmTapAdapter();
  game.reset();
  let maxNotes = 0;
  for (let i = 0; i < 100; i++) {
    game.update(null);
    if (game.notes.length > maxNotes) maxNotes = game.notes.length;
  }
  assert.ok(maxNotes > 0, `100틱 동안 notes가 생성되어야 함 (max=${maxNotes})`);
});

// R-2: botAccuracy=0 (완벽 정확도) → missCount 낮음
test('RhythmTapAdapter: botAccuracy=0이면 300틱 후 missCount 낮음', () => {
  const game = new RhythmTapAdapter({ botAccuracy: 0 });
  game.reset();
  for (let i = 0; i < 300 && game.isAlive(); i++) game.update(null);
  assert.ok(game.missCount < 5,
    `botAccuracy=0이면 missCount 낮아야 함 (got ${game.missCount})`);
});

// R-3: botAccuracy=0이면 스코어 증가
test('RhythmTapAdapter: botAccuracy=0이면 200틱 후 score > 0', () => {
  const game = new RhythmTapAdapter({ botAccuracy: 0 });
  game.reset();
  for (let i = 0; i < 200 && game.isAlive(); i++) game.update(null);
  assert.ok(game.getScore() > 0,
    `botAccuracy=0이면 스코어가 증가해야 함 (got ${game.getScore()})`);
});

// R-4: missCount >= 20 → alive=false
test('RhythmTapAdapter: missCount >= 20 → alive=false', () => {
  const game = new RhythmTapAdapter();
  game.reset();
  game.missCount = 19;
  // y=400 노트: targetY(320)+goodRange(50)=370 → 400>370 → 한 틱 후 miss 발생
  game.notes.push({ id: 'miss_test', lane: 0, y: 400, hit: false });
  game.update(null);
  assert.equal(game.isAlive(), false,
    `missCount가 20이 되면 alive=false 여야 함 (missCount=${game.missCount})`);
});

// R-5: frameCount >= 3600 → alive=false (60초 초과)
test('RhythmTapAdapter: frameCount=3600 후 update() → alive=false', () => {
  const game = new RhythmTapAdapter();
  game.reset();
  game.frameCount = 3600;  // 다음 update()에서 3601이 됨 → 3601 >= 3600 → dead
  game.update(null);
  assert.equal(game.isAlive(), false,
    '60초 초과 시 alive=false 여야 함');
});

// R-6: 속도 증가 확인 (speedIncrement=0.0005)
test('RhythmTapAdapter: 300틱 후 speed가 초기값보다 증가', () => {
  const game = new RhythmTapAdapter();
  game.reset();
  const initialSpeed = game.speed;
  for (let i = 0; i < 300 && game.isAlive(); i++) game.update(null);
  assert.ok(game.speed > initialSpeed,
    `speed 증가해야 함: initial=${initialSpeed}, current=${game.speed}`);
});

// R-7: getDifficulty() 0~1 범위
test('RhythmTapAdapter: getDifficulty() 항상 0~1 범위', () => {
  const game = new RhythmTapAdapter();
  game.reset();
  for (let i = 0; i < 200 && game.isAlive(); i++) game.update(null);
  const d = game.getDifficulty();
  assert.ok(d >= 0 && d <= 1, `getDifficulty()=${d} 범위 초과`);
});

// R-8: 강제 miss 삽입 → missCount 증가 확인
test('RhythmTapAdapter: 범위 밖 노트 → missCount 증가', () => {
  const game = new RhythmTapAdapter();
  game.reset();
  const prevMiss = game.missCount;
  // y=380: 380 > targetY(320)+goodRange(50)=370 → 한 틱 후 miss
  game.notes.push({ id: 'force_miss', lane: 1, y: 380, hit: false });
  game.update(null);
  assert.ok(game.missCount > prevMiss,
    `missCount 증가해야 함 (before=${prevMiss}, after=${game.missCount})`);
});
