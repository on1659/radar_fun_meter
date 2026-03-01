const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const path = require('path');

const CLI = path.resolve(__dirname, '../src/cli.js');

function runCLI(args) {
  try {
    const stdout = execSync(`node "${CLI}" ${args}`, { encoding: 'utf8', cwd: path.resolve(__dirname, '..') });
    return { stdout, stderr: '', code: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', code: e.status };
  }
}

// T-CV1: --port=80 → 에러 종료
test('--port=80 → 에러 종료 (1024 미만)', () => {
  const { stderr, code } = runCLI('--game=example --port=80 --runs=1');
  assert.equal(code, 1);
  assert.match(stderr, /port.*1024/i);
});

// T-CV2: --list-games → 정상 종료 (port 미지정)
test('--list-games → 정상 종료', () => {
  const { code } = runCLI('--list-games');
  assert.equal(code, 0);
});

// T-CV3: --output path traversal → 차단
test('--output=../../etc/passwd.json → path traversal 차단', () => {
  const { stderr, code } = runCLI('--game=example --runs=1 --output=../../etc/passwd.json');
  assert.equal(code, 1);
  assert.match(stderr, /output.*경로/);
});

// T-CV4: --opt.iter=200 → 상한 초과 에러
test('--opt.iter=200 → 상한 초과 에러', () => {
  const { stderr, code } = runCLI('--game=example --optimize --opt.iter=200');
  assert.equal(code, 1);
  assert.match(stderr, /opt.iter.*100/);
});
