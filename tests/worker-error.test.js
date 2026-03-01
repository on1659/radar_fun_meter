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
