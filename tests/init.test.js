'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateTemplate, toClassName, createGameFiles } = require('../src/commands/init');

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
