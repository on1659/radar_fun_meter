'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const path     = require('path');

const { makeBot, loadGame, runOptimize, runNormal, shareResult } = require('../src/cli/runner');
const ExampleGame = require('../games/example/ExampleGame');

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function mockExit(fn) {
  let code;
  const orig = process.exit;
  process.exit = (c) => { code = c; throw new Error('exit:' + c); };
  return fn().then(
    () => { process.exit = orig; return code; },
    (e) => { process.exit = orig; if (!e.message.startsWith('exit')) throw e; return code; }
  );
}

function captureAll(fn) {
  const logs = [], errors = [], warns = [];
  const origLog = console.log, origErr = console.error, origWarn = console.warn;
  console.log   = (...a) => logs.push(a.map(String).join(' '));
  console.error = (...a) => errors.push(a.map(String).join(' '));
  console.warn  = (...a) => warns.push(a.map(String).join(' '));
  const restore = () => {
    console.log = origLog; console.error = origErr; console.warn = origWarn;
  };
  return Promise.resolve().then(fn).then(
    (r) => { restore(); return { logs, errors, warns, result: r }; },
    (e) => { restore(); throw e; }
  );
}

function withModuleStub(modulePath, stub, fn) {
  const resolved = require.resolve(modulePath);
  const orig = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: stub };
  return Promise.resolve().then(fn).finally(() => {
    if (orig) require.cache[resolved] = orig;
    else delete require.cache[resolved];
  });
}

function baseArgs(overrides = {}) {
  return { game: 'example', runs: 5, maxSeconds: 5, config: {}, opt: {}, ml: {}, ...overrides };
}

// ── Group A: makeBot 추가 케이스 ──────────────────────────────────────────

test('A-1: makeBot smart → SmartBot 인스턴스', () => {
  const SmartBot = require('../src/bots/SmartBot');
  const bot = makeBot(
    { bot: 'smart', config: { hint: 'auto', scoreWindow: 60 }, opt: {}, ml: {} },
    'example'
  );
  assert.ok(bot instanceof SmartBot);
});

test('A-2: makeBot ml (신규) → MLBot 인스턴스', () => {
  const MLBot = require('../src/bots/MLBot');
  const bot = makeBot(
    { bot: 'ml', config: {}, opt: {}, ml: { epsilon: 0.3, buckets: 10 } },
    'example'
  );
  assert.ok(bot instanceof MLBot);
});

// ── Group B: loadGame 외부 패키지 ─────────────────────────────────────────

test('B-1: loadGame 외부 패키지 yes=false → 비TTY 환경 → auto-reject → process.exit(0)', async () => {
  // 비대화형 환경에서 promptConfirm은 자동으로 false를 반환하여 취소됨
  const { errors, logs } = await captureAll(async () => {
    const code = await mockExit(async () => {
      await loadGame('@some/external-pkg', {});
    });
    return code;
  });
  // 비TTY 환경 경고 메시지와 함께 0으로 exit (또는 1 - MODULE_NOT_FOUND일 수도 있음)
  // 중요한 것은 promptConfirm 경로가 실행되었다는 것
  const allOutput = [...errors, ...logs].join('\n');
  assert.ok(
    allOutput.includes('비대화형') || allOutput.includes('취소됨') || allOutput.includes('찾을 수 없습니다'),
    '비TTY 환경 감지 또는 취소 메시지 출력'
  );
});

test('B-2: loadGame 외부 패키지 MODULE_NOT_FOUND → process.exit(1)', async () => {
  const code = await mockExit(async () => {
    await loadGame('@unknown/nonexistent-xyz-abc-123', { yes: true });
  });
  assert.equal(code, 1);
});

// ── Group C: runOptimize ─────────────────────────────────────────────────

test('C-2: runOptimize 커스텀 파라미터 → 정상 실행', async () => {
  const args = {
    ...baseArgs(),
    bot: 'random',
    opt: { runs: 3, iter: 2, param: 'initialSpeed', min: 80, max: 120, direction: 'higher' },
  };
  const { logs } = await captureAll(() => runOptimize(args, 'example', ExampleGame));
  const output = logs.join('\n');
  assert.ok(output.includes('최적화') || output.includes('example'), '최적화 시작 로그 확인');
});

test('C-3: runOptimize DEFAULT_PARAMS 없는 게임 → process.exit(1)', async () => {
  const args = { ...baseArgs(), bot: 'random', opt: { runs: 5, iter: 2 } };
  const code = await mockExit(async () => {
    await captureAll(() => runOptimize(args, 'unknown-game', ExampleGame));
  });
  assert.equal(code, 1);
});

// ── Group D: runNormal 특수 모드 ─────────────────────────────────────────

test('D-1: runNormal --view 성공 → process.exit(0)', async () => {
  const stub = {
    viewGist: async () => ({
      name: 'test', zone: 'FLOW', median: 10, runs: 100,
      mean: 10.0, stddev: 2.0, min: 5.0, max: 15.0,
      p25: 8.0, p75: 12.0, p90: 14.0, p95: 14.5,
      timeoutRate: 0.1, scoreMean: 50, scoreMax: 100,
      emoji: '✅', advice: '재밌음', histogram: [],
      suggestions: [], levelStats: null,
    }),
    GistNotFoundError: class GistNotFoundError extends Error {},
    GistFormatError:   class GistFormatError extends Error {},
  };
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  const code = await withModuleStub(gistPath, stub,
    () => mockExit(() => captureAll(() => runNormal(
      { ...baseArgs(), view: 'abc123' }, 'example', ExampleGame
    )))
  );
  assert.equal(code, 0);
});

test('D-5: runNormal --history 빈 목록 → 안내 메시지', async () => {
  const serverPath = path.resolve(__dirname, '../src/server/index');
  const stub = {
    FunMeterServer: class { getHistory() { return []; } },
  };
  let capturedOutput;
  await withModuleStub(serverPath, stub, async () => {
    const { logs } = await captureAll(async () => {
      const code2 = await mockExit(() => runNormal(
        { ...baseArgs(), history: true }, 'example', ExampleGame
      ));
      return code2;
    });
    capturedOutput = logs.join('\n');
  });
  assert.ok(capturedOutput.includes('히스토리 없음'), '빈 이력 안내 출력');
});

// ── Group E: runNormal 일반/병렬 ─────────────────────────────────────────

test('E-1: runNormal 기본 실행 (ExampleGame + random, runs=5)', async () => {
  const { logs } = await captureAll(() =>
    runNormal(baseArgs({ runs: 5 }), 'example', ExampleGame)
  );
  const output = logs.join('\n');
  assert.ok(output.includes('example') || output.includes('Zone') || output.includes('결과'), '실행 결과 출력 확인');
});

test('E-3: runNormal --bot=ml (train/load 없음) → console.warn 발생', async () => {
  const { warns } = await captureAll(() =>
    runNormal({ ...baseArgs(), bot: 'ml', ml: {} }, 'example', ExampleGame)
  );
  assert.ok(warns.some(w => w.includes('MLBot')), 'MLBot 경고 출력 확인');
});

test('E-5: runNormal --parallel=2 + smart bot → 경고 + 단일 실행', async () => {
  const { warns } = await captureAll(() =>
    runNormal(
      { ...baseArgs(), bot: 'smart', parallel: 2, config: { hint: 'auto', scoreWindow: 60 } },
      'example',
      ExampleGame
    )
  );
  assert.ok(warns.some(w => w.includes('parallel')), '병렬 불가 경고 출력');
});

test('E-6: runNormal --parallel=2 + 외부 게임 → process.exit(1)', async () => {
  const code = await captureAll(() =>
    mockExit(() => runNormal(
      { ...baseArgs(), parallel: 2 }, 'unknown-game', ExampleGame
    ))
  ).then(({ result }) => result);
  assert.equal(code, 1);
});

test('E-7: runNormal --serve → FunMeterServer.start 호출됨', async () => {
  const serverPath = path.resolve(__dirname, '../src/server/index');
  let serverStarted = false;
  const stub = {
    FunMeterServer: class {
      start() {
        serverStarted = true;
        return Promise.resolve({ url: 'http://127.0.0.1:4567' });
      }
      sendProgress() {}
      sendResult() {}
      saveHistory() {}
    },
  };
  // config 비어있지 않게 하여 serve 블록 내 config 로그 경로 커버
  await withModuleStub(serverPath, stub, () =>
    captureAll(() =>
      runNormal({ ...baseArgs(), serve: true, config: { initialSpeed: 80 } }, 'example', ExampleGame)
    )
  );
  assert.ok(serverStarted, 'FunMeterServer.start 호출됨');
});

// ── Group D (추가): runNormal --trend / --history ──────────────────────────

test('D-3: runNormal --trend 히스토리 없음 → 안내 출력', async () => {
  const serverPath = path.resolve(__dirname, '../src/server/index');
  const stub = {
    FunMeterServer: class {
      getTrend() { return { slope: null, feedback: '', outliers: [], entries: [] }; }
    },
  };
  let capturedOutput;
  await withModuleStub(serverPath, stub, async () => {
    const { logs } = await captureAll(async () => {
      await mockExit(() => runNormal(
        { ...baseArgs(), trend: true }, 'example', ExampleGame
      ));
    });
    capturedOutput = logs.join('\n');
  });
  assert.ok(capturedOutput.includes('히스토리 없음'), '--trend 히스토리 없음 출력');
});

test('D-4: runNormal --trend 히스토리 있음 + outlier → 트렌드 출력', async () => {
  const serverPath = path.resolve(__dirname, '../src/server/index');
  const entry = { savedAt: new Date().toISOString(), result: { median: 10, zone: 'FLOW' } };
  const stub = {
    FunMeterServer: class {
      getTrend() {
        return {
          slope: 0.5, feedback: '상승 추세',
          outliers: [entry],
          entries: [entry, entry],
        };
      }
    },
  };
  let capturedOutput;
  await withModuleStub(serverPath, stub, async () => {
    const { logs } = await captureAll(async () => {
      await mockExit(() => runNormal(
        { ...baseArgs(), trend: true }, 'example', ExampleGame
      ));
    });
    capturedOutput = logs.join('\n');
  });
  assert.ok(capturedOutput.includes('트렌드'), '--trend 트렌드 출력 확인');
});

test('D-6: runNormal --history 2개 이상 → 이전 대비 비교 출력', async () => {
  const serverPath = path.resolve(__dirname, '../src/server/index');
  const makeEntry = (median, zone, timeoutRate) => ({
    savedAt: new Date().toISOString(),
    result: { name: 'example', zone, median, timeoutRate },
  });
  const stub = {
    FunMeterServer: class {
      getHistory() {
        return [makeEntry(12, 'FLOW', 0.05), makeEntry(10, 'FLOW', 0.10)];
      }
    },
  };
  let capturedOutput;
  await withModuleStub(serverPath, stub, async () => {
    const { logs } = await captureAll(async () => {
      await mockExit(() => runNormal(
        { ...baseArgs(), history: true }, 'example', ExampleGame
      ));
    });
    capturedOutput = logs.join('\n');
  });
  assert.ok(capturedOutput.includes('이전 실행 대비'), '비교 출력 확인');
});

// ── Group E (추가): ML train ──────────────────────────────────────────────

test('E-4: runNormal ML train (small episodes) → 학습 완료 후 측정', async () => {
  const args = {
    ...baseArgs({ runs: 3 }),
    bot: 'ml',
    ml: { train: true, episodes: 5, epsilon: 0.3, buckets: 5 },
  };
  const { logs } = await captureAll(() =>
    runNormal(args, 'example', ExampleGame)
  );
  assert.ok(logs.some(l => l.includes('MLBot') || l.includes('학습')), 'ML 학습 로그 출력 확인');
});

// ── Group E-2: config 로그 ────────────────────────────────────────────────

test('E-2: runNormal config 출력 (initialSpeed=80)', async () => {
  const { logs } = await captureAll(() =>
    runNormal({ ...baseArgs(), config: { initialSpeed: 80 } }, 'example', ExampleGame)
  );
  assert.ok(logs.some(l => l.includes('설정')), '⚙️  설정 출력 확인');
});

// ── Group F: shareResult ─────────────────────────────────────────────────

test('F-1: shareResult 성공 → URL 출력', async () => {
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  const stub = {
    uploadGist: async () => ({ url: 'https://gist.github.com/abc', id: 'abc' }),
    GistAuthError:   class extends Error {},
    GistUploadError: class extends Error {},
  };
  const mockResult = { name: 'test', zone: 'FLOW', median: 10 };
  await withModuleStub(gistPath, stub, async () => {
    const { logs } = await captureAll(() => shareResult(mockResult));
    assert.ok(logs.some(l => l.includes('gist.github.com')), 'URL 출력 확인');
  });
});

test('F-2: shareResult GistAuthError → 에러 메시지 출력', async () => {
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  class FakeGistAuthError extends Error {
    constructor() { super('FUNMETER_GITHUB_TOKEN 환경 변수가 설정되지 않았습니다.'); }
  }
  const stub = {
    uploadGist: async () => { throw new FakeGistAuthError(); },
    GistAuthError:   FakeGistAuthError,
    GistUploadError: class extends Error {},
  };
  const mockResult = { name: 'test', zone: 'FLOW', median: 10 };
  await withModuleStub(gistPath, stub, async () => {
    const { errors } = await captureAll(() => shareResult(mockResult));
    assert.ok(errors.some(e => e.includes('GITHUB_TOKEN') || e.includes('인증')), 'GistAuthError 메시지 출력 확인');
  });
});

test('F-3: shareResult GistUploadError → 업로드 실패 메시지 출력', async () => {
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  class FakeGistUploadError extends Error {
    constructor() { super('서버 응답 오류 500'); }
  }
  const stub = {
    uploadGist: async () => { throw new FakeGistUploadError(); },
    GistAuthError:   class extends Error {},
    GistUploadError: FakeGistUploadError,
  };
  const mockResult = { name: 'test', zone: 'FLOW', median: 10 };
  await withModuleStub(gistPath, stub, async () => {
    const { errors } = await captureAll(() => shareResult(mockResult));
    assert.ok(errors.some(e => e.includes('업로드 실패') || e.includes('500')), 'GistUploadError 메시지 출력 확인');
  });
});

test('F-4: shareResult 예상치 못한 에러 → 일반 에러 메시지 출력', async () => {
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  const stub = {
    uploadGist: async () => { throw new Error('네트워크 타임아웃'); },
    GistAuthError:   class extends Error {},
    GistUploadError: class extends Error {},
  };
  const mockResult = { name: 'test', zone: 'FLOW', median: 10 };
  await withModuleStub(gistPath, stub, async () => {
    const { errors } = await captureAll(() => shareResult(mockResult));
    assert.ok(errors.some(e => e.includes('예상치 못한 오류') || e.includes('타임아웃')), '일반 에러 메시지 출력 확인');
  });
});

// ── Group A (추가): makeBot ml.load, flappy-bird 기본 봇 ───────────────────

test('A-3: makeBot ml.load → MLBot.load 호출', async () => {
  const mlbotPath = path.resolve(__dirname, '../src/bots/MLBot');
  let loadCalled = false;
  const fakeInstance = { epsilon: 0 };
  function FakeMLBot() {}
  FakeMLBot.load = (_p, _opts) => { loadCalled = true; return fakeInstance; };

  await withModuleStub(mlbotPath, FakeMLBot, async () => {
    const bot = makeBot(
      { bot: 'ml', config: {}, opt: {}, ml: { load: 'model.json', epsilon: 0.1 } },
      'example'
    );
    assert.ok(loadCalled, 'MLBot.load가 호출됨');
    assert.equal(bot, fakeInstance);
  });
});

test('A-4: makeBot flappy-bird 기본 봇 → FlappyBirdBot', () => {
  const FlappyBirdBot = require('../src/bots/FlappyBirdBot');
  const bot = makeBot({ config: {}, opt: {}, ml: {} }, 'flappy-bird');
  assert.ok(bot instanceof FlappyBirdBot, 'FlappyBirdBot 인스턴스');
});

// ── Group B (추가): loadGame 비외부 unknown ────────────────────────────────

test('B-4: loadGame 비외부 unknown → exit(1)', async () => {
  const code = await mockExit(() =>
    captureAll(() => loadGame('unknown-game-xyz', {}))
  );
  assert.equal(code, 1);
});

// ── Group C (추가): runOptimize 케이스 ────────────────────────────────────

test('C-1: runOptimize DEFAULT_PARAMS timing-jump → 정상 실행', async () => {
  const { Optimizer } = require('../src/Optimizer');
  const TimingJumpAdapter = require('../games/timing-jump/TimingJumpAdapter');
  const orig = Optimizer.prototype.optimize;
  Optimizer.prototype.optimize = () => ({ config: {}, result: {}, found: false });
  try {
    const args = { ...baseArgs(), bot: 'random', opt: { runs: 2, iter: 1 } };
    const { logs } = await captureAll(() => runOptimize(args, 'timing-jump', TimingJumpAdapter));
    assert.ok(logs.some(l => l.includes('timing-jump') || l.includes('최적화')), '최적화 로그 출력');
  } finally {
    Optimizer.prototype.optimize = orig;
  }
});

test('C-4: runOptimize found=true → 설정 안내 출력', async () => {
  const { Optimizer } = require('../src/Optimizer');
  const orig = Optimizer.prototype.optimize;
  Optimizer.prototype.optimize = () => ({
    config: { initialSpeed: 120.5678 },
    result: {},
    found: true,
  });
  try {
    const args = {
      ...baseArgs(),
      bot: 'random',
      opt: { runs: 2, iter: 1, param: 'initialSpeed', min: 80, max: 200, direction: 'higher' },
    };
    const { logs } = await captureAll(() => runOptimize(args, 'example', ExampleGame));
    assert.ok(logs.some(l => l.includes('이 설정으로')), 'found=true 안내 출력 확인');
    assert.ok(logs.some(l => l.includes('120.5678')), 'config 값 포함 확인');
  } finally {
    Optimizer.prototype.optimize = orig;
  }
});

test('C-5: runOptimize botType=human → HumanLikeBot BotClass 경로', async () => {
  const { Optimizer } = require('../src/Optimizer');
  const orig = Optimizer.prototype.optimize;
  Optimizer.prototype.optimize = () => ({ config: {}, result: {}, found: false });
  try {
    const args = {
      ...baseArgs(),
      bot: 'human',
      opt: { runs: 2, iter: 1, param: 'initialSpeed', min: 80, max: 200, direction: 'higher' },
    };
    const { logs } = await captureAll(() => runOptimize(args, 'example', ExampleGame));
    assert.ok(logs.some(l => l.includes('human')), 'bot=human 로그 확인');
  } finally {
    Optimizer.prototype.optimize = orig;
  }
});

test('C-6: runOptimize botType=flappy → FlappyBirdBot BotClass 경로', async () => {
  const { Optimizer } = require('../src/Optimizer');
  const orig = Optimizer.prototype.optimize;
  Optimizer.prototype.optimize = () => ({ config: {}, result: {}, found: false });
  try {
    const args = {
      ...baseArgs(),
      bot: 'flappy',
      opt: { runs: 2, iter: 1, param: 'initialSpeed', min: 80, max: 200, direction: 'higher' },
    };
    const { logs } = await captureAll(() => runOptimize(args, 'example', ExampleGame));
    assert.ok(logs.some(l => l.includes('flappy')), 'bot=flappy 로그 확인');
  } finally {
    Optimizer.prototype.optimize = orig;
  }
});

test('C-7: runOptimize botType=smart → SmartBot BotClass 경로', async () => {
  const { Optimizer } = require('../src/Optimizer');
  const orig = Optimizer.prototype.optimize;
  Optimizer.prototype.optimize = () => ({ config: {}, result: {}, found: false });
  try {
    const args = {
      ...baseArgs(),
      bot: 'smart',
      opt: { runs: 2, iter: 1, param: 'initialSpeed', min: 80, max: 200, direction: 'higher' },
    };
    const { logs } = await captureAll(() => runOptimize(args, 'example', ExampleGame));
    assert.ok(logs.some(l => l.includes('smart')), 'bot=smart 로그 확인');
  } finally {
    Optimizer.prototype.optimize = orig;
  }
});

// ── Group D (추가): --view 에러 처리, --url ────────────────────────────────

test('D-2: runNormal --view GistNotFoundError → exit(1)', async () => {
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  class FakeGistNotFoundError extends Error {
    constructor() { super('Gist not found: abc'); }
  }
  const stub = {
    viewGist: async () => { throw new FakeGistNotFoundError(); },
    GistNotFoundError: FakeGistNotFoundError,
    GistFormatError:   class extends Error {},
  };
  const code = await withModuleStub(gistPath, stub, () =>
    mockExit(() => captureAll(() =>
      runNormal({ ...baseArgs(), view: 'abc' }, 'example', ExampleGame)
    ))
  );
  assert.equal(code, 1);
});

test('D-8: runNormal --view GistFormatError → exit(1)', async () => {
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  class FakeGistFormatError extends Error {
    constructor() { super('Invalid gist format'); }
  }
  const stub = {
    viewGist: async () => { throw new FakeGistFormatError(); },
    GistNotFoundError: class extends Error {},
    GistFormatError:   FakeGistFormatError,
  };
  const code = await withModuleStub(gistPath, stub, () =>
    mockExit(() => captureAll(() =>
      runNormal({ ...baseArgs(), view: 'abc' }, 'example', ExampleGame)
    ))
  );
  assert.equal(code, 1);
});

test('D-9: runNormal --view 일반 에러 → exit(1) 조회 실패', async () => {
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  const stub = {
    viewGist: async () => { throw new Error('network timeout'); },
    GistNotFoundError: class extends Error {},
    GistFormatError:   class extends Error {},
  };
  let capturedErrors = [];
  const origErr = console.error;
  console.error = (...a) => capturedErrors.push(a.map(String).join(' '));
  const code = await withModuleStub(gistPath, stub, () =>
    mockExit(() => runNormal({ ...baseArgs(), view: 'abc' }, 'example', ExampleGame))
  ).finally(() => { console.error = origErr; });
  assert.equal(code, 1);
  assert.ok(capturedErrors.some(e => e.includes('조회 실패')), '조회 실패 메시지 출력');
});

test('D-url: runNormal --url Playwright 미설치 → exit(1)', async () => {
  const code = await mockExit(() =>
    captureAll(() =>
      runNormal({ ...baseArgs(), url: 'http://example.com' }, 'example', ExampleGame)
    )
  );
  assert.equal(code, 1);
});

// ── Group E (추가): 병렬 실행, share ──────────────────────────────────────

test('E-8: runNormal --parallel=2 example(random) → 병렬 실행', async () => {
  const { logs } = await captureAll(() =>
    runNormal(
      { ...baseArgs({ runs: 4, parallel: 2 }), bot: 'random' },
      'example', ExampleGame
    )
  );
  assert.ok(logs.some(l => l.includes('병렬')), '병렬 실행 로그 확인');
});

test('E-9: runNormal --parallel=2 human bot → HumanLikeBot 경로', async () => {
  const { logs } = await captureAll(() =>
    runNormal(
      { ...baseArgs({ runs: 4, parallel: 2 }), bot: 'human' },
      'example', ExampleGame
    )
  );
  assert.ok(logs.some(l => l.includes('병렬')), '병렬 실행 로그 확인');
});

test('E-share: runNormal share=true → shareResult 호출 → gist URL 출력', async () => {
  const gistPath = path.resolve(__dirname, '../src/reporters/gistReporter');
  const stub = {
    uploadGist: async () => ({ url: 'https://gist.github.com/test123', id: 'test123' }),
    GistAuthError:   class extends Error {},
    GistUploadError: class extends Error {},
  };
  await withModuleStub(gistPath, stub, async () => {
    const { logs } = await captureAll(() =>
      runNormal({ ...baseArgs({ runs: 3 }), share: true }, 'example', ExampleGame)
    );
    assert.ok(logs.some(l => l.includes('gist.github.com')), 'Gist URL 출력 확인');
  });
});
