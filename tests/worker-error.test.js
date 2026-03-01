const { test } = require('node:test');
const assert = require('node:assert/strict');
const FunMeterModule = require('../src/FunMeter');
const { FunMeter } = { FunMeter: FunMeterModule };

// T-W1: 존재하지 않는 게임 파일 → runParallel이 reject
test('존재하지 않는 게임 파일 → runParallel이 reject', async () => {
  const meter = new FunMeterModule({ ticksPerSecond: 60, maxSeconds: 5 });
  await assert.rejects(
    () => meter.runParallel(
      '/nonexistent/Game.js',
      require.resolve('../src/bots/RandomBot'),
      {}, {}, 4, 2
    ),
    /Worker 에러|MODULE_NOT_FOUND/
  );
});

// T-W2: Worker 타임아웃 → 지정 시간 초과 시 reject
// maxSeconds를 매우 크게 설정해 worker가 timeout 전에 완료되지 못하도록 함
test('Worker 타임아웃 → 지정 시간 초과 시 reject', { timeout: 10000 }, async () => {
  const origTimeout = FunMeterModule.WORKER_TIMEOUT_MS;
  FunMeterModule.WORKER_TIMEOUT_MS = 500;

  try {
    // maxSeconds = 99999999 → maxTicks = 약 6B (500ms 내에 완료 불가)
    const meter = new FunMeterModule({ ticksPerSecond: 60, maxSeconds: 99999999 });
    await assert.rejects(
      () => meter.runParallel(
        require.resolve('./fixtures/InfiniteGame'),
        require.resolve('../src/bots/RandomBot'),
        {}, {}, 2, 1
      ),
      /타임아웃|timeout/i
    );
  } finally {
    FunMeterModule.WORKER_TIMEOUT_MS = origTimeout;
  }
});

// T-W3: runParallel 정상 실행 → 분석 결과 반환
test('runParallel 정상 실행 → 분석 결과 반환', { timeout: 15000 }, async () => {
  const meter = new FunMeterModule({ ticksPerSecond: 60, maxSeconds: 5 });
  const result = await meter.runParallel(
    require.resolve('../games/timing-jump/TimingJumpAdapter'),
    require.resolve('../src/bots/RandomBot'),
    { jumpProb: 0.3 },
    { initialSpeed: 80 },
    4,
    2
  );
  assert.ok(['FLOW', 'TOO_HARD', 'TOO_EASY'].includes(result.zone));
  assert.strictEqual(result.times.length, 4);
});

// T-W4: runParallel 레벨 추적 게임 → levelStats 포함
// stack-tower는 getLevel() 구현됨, jumpProb=0 필수 (내부 auto-drop 봇)
test('runParallel 레벨 추적 게임 → levelStats 포함', { timeout: 15000 }, async () => {
  const meter = new FunMeterModule({ ticksPerSecond: 60, maxSeconds: 5 });
  const result = await meter.runParallel(
    require.resolve('../games/stack-tower/StackTowerAdapter'),
    require.resolve('../src/bots/RandomBot'),
    { jumpProb: 0 },
    { botError: 10 },
    4,
    2
  );
  assert.ok(result.levelStats !== null, 'levelStats가 null이 아니어야 함');
});

// T-W5: runParallel 타임아웃 게임 → timeoutRate > 0
test('runParallel 타임아웃 게임 → timeoutRate > 0', { timeout: 15000 }, async () => {
  const meter = new FunMeterModule({ ticksPerSecond: 60, maxSeconds: 1 });
  const result = await meter.runParallel(
    require.resolve('../examples/heartbeat/HeartBeatAdapter'),
    require.resolve('../src/bots/RandomBot'),
    { jumpProb: 0.01 },
    { drainRate: 0.05 },
    4,
    2
  );
  assert.ok(result.timeoutRate > 0, 'timeoutRate가 0보다 커야 함');
});
