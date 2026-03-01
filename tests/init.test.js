'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateTemplate, toClassName, createGameFiles, runInit, patchCliRegistry } = require('../src/commands/init');

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

// T1: basic 템플릿에 클래스명 포함
test('generateTemplate basic includes class MyGameAdapter', () => {
  const src = generateTemplate('my-game', 'basic');
  assert.ok(src.includes('class MyGameAdapter'), 'basic 템플릿에 MyGameAdapter 클래스 포함');
  assert.ok(src.includes('module.exports = MyGameAdapter'), 'module.exports 포함');
});

// T2: human 템플릿에 obstacles, speed 필드 포함
test('generateTemplate human includes obstacles and speed fields', () => {
  const src = generateTemplate('my-game', 'human');
  assert.ok(src.includes('this.obstacles'), 'human 템플릿에 this.obstacles 포함');
  assert.ok(src.includes('this.speed'), 'human 템플릿에 this.speed 포함');
  assert.ok(src.includes('this.isOnGround'), 'human 템플릿에 this.isOnGround 포함');
});

// T3: levels 템플릿에 getLevel() 포함
test('generateTemplate levels includes getLevel method', () => {
  const src = generateTemplate('my-game', 'levels');
  assert.ok(src.includes('getLevel()'), 'levels 템플릿에 getLevel() 포함');
  assert.ok(src.includes('this._level'), 'levels 템플릿에 this._level 포함');
});

// T4: toClassName 변환 검증
test('toClassName converts kebab-case to PascalCase with Adapter suffix', () => {
  assert.strictEqual(toClassName('my-cool-game'), 'MyCoolGameAdapter');
  assert.strictEqual(toClassName('game'), 'GameAdapter');
  assert.strictEqual(toClassName('timing-jump'), 'TimingJumpAdapter');
});

// T5: createGameFiles 실행 후 어댑터 파일 존재
test('createGameFiles creates adapter file in temp dir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funmeter-test-'));
  try {
    const result = createGameFiles('test-game', 'basic', tmpDir);
    assert.ok(fs.existsSync(result.file), '생성된 파일이 존재해야 함');
    assert.ok(fs.existsSync(result.dir), '생성된 디렉터리가 존재해야 함');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// T6: 생성된 파일을 require() 하면 에러 없이 인스턴스화 가능
test('createGameFiles output is requireable and instantiable', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funmeter-test-'));
  try {
    const result = createGameFiles('sample-game', 'basic', tmpDir);
    // 생성된 파일은 radar_fun_meter/src/GameAdapter를 require하는데
    // 실제 패키지 경로 대신 로컬 경로로 바꿔서 테스트
    let src = fs.readFileSync(result.file, 'utf8');
    const localAdapterPath = path.resolve(__dirname, '../src/GameAdapter');
    src = src.replace("require('radar_fun_meter/src/GameAdapter')", `require(${JSON.stringify(localAdapterPath)})`);
    const patchedPath = result.file + '.patched.js';
    fs.writeFileSync(patchedPath, src, 'utf8');

    const Adapter = require(patchedPath);
    const instance = new Adapter();
    instance.reset();
    assert.ok(typeof instance.getScore === 'function', 'getScore 메서드 존재');
    assert.ok(typeof instance.isAlive === 'function', 'isAlive 메서드 존재');
    assert.ok(typeof instance.getDifficulty === 'function', 'getDifficulty 메서드 존재');
    assert.ok(typeof instance.getName === 'function', 'getName 메서드 존재');
    assert.strictEqual(typeof instance.getScore(), 'number', 'getScore()는 숫자 반환');
    assert.strictEqual(typeof instance.isAlive(), 'boolean', 'isAlive()는 불리언 반환');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// T7: 동일 이름으로 두 번 실행 시 에러 발생
test('createGameFiles throws error if game directory already exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funmeter-test-'));
  try {
    createGameFiles('dup-game', 'basic', tmpDir);
    assert.throws(
      () => createGameFiles('dup-game', 'basic', tmpDir),
      (err) => {
        assert.ok(err.message.includes('already exists'), `에러 메시지에 "already exists" 포함: ${err.message}`);
        return true;
      }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── T8~T17: runInit / patchCliRegistry 추가 테스트 ────────────────────────

// T8: runInit 이름 없음 → exit(1)
test('T8: runInit 이름 없음 → exit(1)', async () => {
  const code = await mockExit(() =>
    captureAll(() => runInit({ config: {}, opt: {} }))
  );
  assert.equal(code, 1);
});

// T9: runInit 잘못된 이름(대문자) → exit(1)
test('T9: runInit 잘못된 이름(대문자) → exit(1)', async () => {
  const code = await mockExit(() =>
    captureAll(() => runInit({ init: 'MyGame', config: {}, opt: {} }))
  );
  assert.equal(code, 1);
});

// T10: runInit 잘못된 템플릿 → exit(1)
test('T10: runInit 잘못된 템플릿 → exit(1)', async () => {
  const code = await mockExit(() =>
    captureAll(() => runInit({ init: 'my-game', template: 'invalid', config: {}, opt: {} }))
  );
  assert.equal(code, 1);
});

// T11: runInit 커스텀 dir → 파일 생성 + '커스텀 디렉터리' 안내 메시지
test('T11: runInit 커스텀 디렉터리 → 파일 생성', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funmeter-init-'));
  try {
    const { logs } = await captureAll(() =>
      runInit({ init: 'test-game', dir: tmpDir, config: {}, opt: {} })
    );
    assert.ok(fs.existsSync(path.join(tmpDir, 'test-game')), '게임 디렉터리 생성됨');
    assert.ok(
      logs.join('\n').includes('커스텀 디렉터리'),
      '커스텀 dir 안내 메시지 출력'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// T12: runInit 이미 존재하는 게임(커스텀 dir) → exit(1)
test('T12: runInit 이미 존재하는 게임(커스텀 dir) → exit(1)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funmeter-init-'));
  try {
    await captureAll(() => runInit({ init: 'test-game', dir: tmpDir, config: {}, opt: {} }));
    const code = await mockExit(() =>
      captureAll(() => runInit({ init: 'test-game', dir: tmpDir, config: {}, opt: {} }))
    );
    assert.equal(code, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// T13: patchCliRegistry 신규 게임 삽입 → cli.js 양쪽 블록에 항목 추가 (복원 필수)
test('T13: patchCliRegistry 신규 게임 삽입', () => {
  const cliPath = path.resolve(__dirname, '../src/cli.js');
  const original = fs.readFileSync(cliPath, 'utf8');
  const name = 'test-zzz-' + Date.now();

  // patchCliRegistry가 찾을 수 있도록 마커 블록을 임시 추가
  const fakeContent = original + `
const GAME_FILE_MAP = {
  example: '../../games/example/ExampleGame',
};
const GAMES = {
  example: () => require('../../games/example/ExampleGame'),
};
`;
  fs.writeFileSync(cliPath, fakeContent, 'utf8');

  try {
    patchCliRegistry(name, `../games/${name}/Adapter`);
    const modified = fs.readFileSync(cliPath, 'utf8');
    const count = (modified.match(new RegExp(`'${name}':`,'g')) || []).length;
    assert.ok(count >= 2, `cli.js 양쪽 블록에 삽입됨 (발견 수: ${count})`);
  } finally {
    fs.writeFileSync(cliPath, original, 'utf8');
  }
});

// T14: patchCliRegistry 이미 존재하는 게임 → 변경 없음 (early return)
test('T14: patchCliRegistry 이미 존재하는 게임 → 변경 없음', () => {
  const cliPath = path.resolve(__dirname, '../src/cli.js');
  const original = fs.readFileSync(cliPath, 'utf8');
  const existingName = 'test-existing-' + Date.now();

  // 이미 게임 이름이 포함된 내용을 cli.js에 임시 기록
  const fakeContent = original + `\n  '${existingName}': () => require('./somewhere'),\n`;
  fs.writeFileSync(cliPath, fakeContent, 'utf8');

  try {
    patchCliRegistry(existingName, '../games/somewhere/Adapter');
    const after = fs.readFileSync(cliPath, 'utf8');
    // early return이 일어났으면 writeFileSync가 호출되지 않아 내용 동일
    assert.strictEqual(after, fakeContent, '이미 존재 → 변경 없음');
  } finally {
    fs.writeFileSync(cliPath, original, 'utf8');
  }
});

// T15: runInit 기본 games/ dir → 파일 생성 + cli.js 등록 완료 메시지
test('T15: runInit 기본 games/ dir → 파일 생성 + cli.js 등록', async () => {
  const uniqueName = 'test-tmp-' + Date.now();
  const cliPath = path.resolve(__dirname, '../src/cli.js');
  const gamesPath = path.resolve(__dirname, '../games', uniqueName);
  const originalCli = fs.readFileSync(cliPath, 'utf8');
  try {
    const { logs } = await captureAll(() =>
      runInit({ init: uniqueName, config: {}, opt: {} })
    );
    assert.ok(fs.existsSync(gamesPath), '게임 디렉터리 생성됨');
    assert.ok(logs.join('\n').includes('등록 완료'), 'cli.js 등록 완료 메시지');
  } finally {
    fs.writeFileSync(cliPath, originalCli, 'utf8');
    if (fs.existsSync(gamesPath)) fs.rmSync(gamesPath, { recursive: true });
  }
});

// T16: runInit args._[1] 이름 파싱 → 파일 생성
test('T16: runInit args._[1] 이름 파싱 → 파일 생성', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funmeter-init-'));
  try {
    const { logs } = await captureAll(() =>
      runInit({ _: ['init', 'my-parsed-game'], dir: tmpDir, config: {}, opt: {} })
    );
    assert.ok(fs.existsSync(path.join(tmpDir, 'my-parsed-game')), '파일 생성됨');
    assert.ok(logs.some(l => l.includes('my-parsed-game')), '생성 로그 출력');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// T17: runInit patchCliRegistry 실패 → warn 메시지
test('T17: runInit patchCliRegistry 실패 → warn 메시지', async () => {
  const origWrite = fs.writeFileSync;
  const cliPath = path.resolve(__dirname, '../src/cli.js');
  const originalCli = fs.readFileSync(cliPath, 'utf8');
  const uniqueName = 'test-warn-' + Date.now();
  const gamesDefaultPath = path.resolve(__dirname, '../games', uniqueName);

  // cli.js 쓰기만 차단, 게임 파일 쓰기는 허용
  fs.writeFileSync = (p, ...rest) => {
    if (typeof p === 'string' && p.endsWith('cli.js')) throw new Error('EACCES: permission denied');
    origWrite(p, ...rest);
  };

  try {
    const { warns } = await captureAll(() =>
      runInit({ init: uniqueName, config: {}, opt: {} })
    );
    assert.ok(warns.some(w => w.includes('자동 등록 실패')), 'warn 출력 확인');
  } finally {
    fs.writeFileSync = origWrite;
    origWrite(cliPath, originalCli, 'utf8');
    if (fs.existsSync(gamesDefaultPath))
      fs.rmSync(gamesDefaultPath, { recursive: true });
  }
});
