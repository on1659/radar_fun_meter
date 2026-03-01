'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const fs       = require('fs');
const path     = require('path');

const { parseArgs, _validateOrThrow }      = require('../src/cli/parser');
const { printHelp, printListGames, saveResult } = require('../src/cli/formatter');
const { loadGame, makeBot, GAMES }         = require('../src/cli/runner');

// ─── 공통 mockResult ────────────────────────────────────────────────────────

const mockResult = {
  name:        'test-game',
  runs:        4,
  zone:        'FLOW',
  emoji:       '✅',
  advice:      '좋은 난이도입니다.',
  mean:        11.0,
  median:      10.5,
  stddev:      2.5,
  p25:         8.0,
  p75:         14.0,
  p90:         16.0,
  p95:         18.0,
  timeoutRate: 0.0,
  scoreMean:   5.0,
  scoreMax:    10,
  levelStats:  null,
  histogram: [
    { from: 0,  to: 5,  count: 1, bar: '█████' },
    { from: 5,  to: 10, count: 2, bar: '██████████' },
    { from: 10, to: 15, count: 1, bar: '█████' },
  ],
  survivalTimes: [5, 10, 12, 15],
};

// ─── T-P: parseArgs ─────────────────────────────────────────────────────────

test('T-P1: parseArgs — --game=timing-jump --runs=50', () => {
  const args = parseArgs(['node', 'cli.js', '--game=timing-jump', '--runs=50']);
  assert.equal(args.game, 'timing-jump');
  assert.equal(args.runs, 50);
  assert.deepEqual(args.config, {});
  assert.deepEqual(args.opt, {});
  assert.deepEqual(args.ml, {});
  assert.deepEqual(args._, []);
});

test('T-P2: parseArgs — --config.initialSpeed=120 --opt.runs=30', () => {
  const args = parseArgs(['node', 'cli.js', '--config.initialSpeed=120', '--opt.runs=30']);
  assert.equal(args.config.initialSpeed, 120);
  assert.equal(args.opt.runs, 30);
});

test('T-P3: parseArgs — --bot.jumpProb=0.1 flat key 보존', () => {
  const args = parseArgs(['node', 'cli.js', '--bot.jumpProb=0.1']);
  assert.equal(args['bot.jumpProb'], 0.1);
});

test('T-P4: parseArgs — --flag 값 없는 플래그', () => {
  const args = parseArgs(['node', 'cli.js', '--flag']);
  assert.equal(args.flag, true);
});

test('T-P5: parseArgs — init my-game 포지셔널 인자', () => {
  const args = parseArgs(['node', 'cli.js', 'init', 'my-game']);
  assert.deepEqual(args._, ['init', 'my-game']);
});

// ─── T-V: _validateOrThrow ──────────────────────────────────────────────────

test('T-V1: _validateOrThrow — port=80 throws RangeError', () => {
  assert.throws(
    () => _validateOrThrow({ port: 80, config: {}, opt: {} }),
    (err) => err instanceof RangeError && /1024/.test(err.message)
  );
});

test('T-V2: _validateOrThrow — port=4567 정상 통과', () => {
  assert.doesNotThrow(() => _validateOrThrow({ port: 4567, config: {}, opt: {} }));
});

test('T-V3: _validateOrThrow — port=99999 throws RangeError', () => {
  assert.throws(
    () => _validateOrThrow({ port: 99999, config: {}, opt: {} }),
    (err) => err instanceof RangeError && /65535/.test(err.message)
  );
});

test('T-V4: _validateOrThrow — output path traversal throws Error', () => {
  assert.throws(
    () => _validateOrThrow({ output: '../../etc/passwd.json', config: {}, opt: {} }),
    (err) => err instanceof Error && /output.*경로/.test(err.message)
  );
});

test('T-V5: _validateOrThrow — opt.runs=20000 throws RangeError', () => {
  assert.throws(
    () => _validateOrThrow({ config: {}, opt: { runs: 20000 } }),
    (err) => err instanceof RangeError && /10000/.test(err.message)
  );
});

test('T-V6: _validateOrThrow — opt.iter=200 throws RangeError', () => {
  assert.throws(
    () => _validateOrThrow({ config: {}, opt: { iter: 200 } }),
    (err) => err instanceof RangeError && /100/.test(err.message)
  );
});

test('T-V7: _validateOrThrow — config.speed=NaN throws TypeError', () => {
  assert.throws(
    () => _validateOrThrow({ config: { speed: NaN }, opt: {} }),
    (err) => err instanceof TypeError && /NaN/.test(err.message)
  );
});

test('T-V8: _validateOrThrow — config.speed=Infinity throws TypeError', () => {
  assert.throws(
    () => _validateOrThrow({ config: { speed: Infinity }, opt: {} }),
    (err) => err instanceof TypeError && /Infinity/.test(err.message)
  );
});

// ─── T-F: formatter ─────────────────────────────────────────────────────────

test('T-F1: printListGames — stdout에 게임 이름 포함', () => {
  const GAMES_STUB  = { mygame: () => {}, other: () => {} };
  const PARAMS_STUB = {
    mygame: { name: 'MyGame', min: 0, max: 100, hardDirection: 'higher' },
  };

  const logs = [];
  const origLog = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    printListGames(GAMES_STUB, PARAMS_STUB);
  } finally {
    console.log = origLog;
  }

  const output = logs.join('\n');
  assert.ok(output.includes('mygame'), 'mygame이 출력에 포함되어야 함');
  assert.ok(output.includes('other'),  'other이 출력에 포함되어야 함');
});

test('T-F2: saveResult .json → 유효한 JSON', () => {
  const filePath = path.join(process.cwd(), 'tmp-test-result.json');
  saveResult(filePath, mockResult);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.doesNotThrow(() => JSON.parse(content));
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

test('T-F3: saveResult .html → content에 <html 포함', () => {
  const filePath = path.join(process.cwd(), 'tmp-test-result.html');
  saveResult(filePath, mockResult);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('<html'), 'HTML 파일에 <html 태그가 있어야 함');
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

test('T-F4: saveResult .md → content에 ## 포함', () => {
  const filePath = path.join(process.cwd(), 'tmp-test-result.md');
  saveResult(filePath, mockResult);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('##'), 'Markdown 파일에 ## 헤더가 있어야 함');
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

test('T-F5: saveResult 디렉터리 미존재 → console.error 호출, 예외 미전파', () => {
  const filePath = path.join(process.cwd(), 'nonexistent-xyz-abc', 'result.json');
  const errors = [];
  const origErr = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    assert.doesNotThrow(() => saveResult(filePath, mockResult));
  } finally {
    console.error = origErr;
  }
  assert.ok(errors.length > 0, 'console.error가 호출되어야 함');
});

// ─── T-R: runner ─────────────────────────────────────────────────────────────

test('T-R1: GAMES[example] → Function 반환', () => {
  const GameClass = GAMES['example']();
  assert.equal(typeof GameClass, 'function');
});

test('T-R2: makeBot({ bot: "random" }, "example") → RandomBot 인스턴스', () => {
  const RandomBot = require('../src/bots/RandomBot');
  const bot = makeBot({ bot: 'random', config: {}, opt: {}, ml: {} }, 'example');
  assert.ok(bot instanceof RandomBot);
});

test('T-R3: makeBot({ bot: "human" }, "example") → HumanLikeBot 인스턴스', () => {
  const HumanLikeBot = require('../src/bots/HumanLikeBot');
  const bot = makeBot({ bot: 'human', config: {}, opt: {}, ml: {} }, 'example');
  assert.ok(bot instanceof HumanLikeBot);
});

test('T-R4: makeBot({}, "flappy-bird") → FlappyBirdBot 인스턴스 (gameName 기반)', () => {
  const FlappyBirdBot = require('../src/bots/FlappyBirdBot');
  const bot = makeBot({ config: {}, opt: {}, ml: {} }, 'flappy-bird');
  assert.ok(bot instanceof FlappyBirdBot);
});

test('T-R5: makeBot({}, "stack-tower") → RandomBot, jumpProb=0 (게임 기본값)', () => {
  const RandomBot = require('../src/bots/RandomBot');
  const bot = makeBot({ config: {}, opt: {}, ml: {} }, 'stack-tower');
  assert.ok(bot instanceof RandomBot);
  assert.equal(bot.jumpProb, 0);
});

test('T-R6: loadGame("unknown", { yes: true }) → process.exit(1)', async () => {
  const origExit = process.exit;
  let exitCode;
  process.exit = (code) => {
    exitCode = code;
    throw new Error('process.exit:' + code);
  };
  try {
    await loadGame('unknown', { yes: true });
  } catch (e) {
    if (!e.message.startsWith('process.exit')) throw e;
  } finally {
    process.exit = origExit;
  }
  assert.equal(exitCode, 1);
});

test('T-R7: loadGame("example", {}) → ExampleGame 반환', async () => {
  const GameClass = await loadGame('example', {});
  assert.equal(typeof GameClass, 'function');
});

test('T-R8: makeBot({ "bot.jumpProb": 0.05 }, "stack-tower") → RandomBot, jumpProb=0.05', () => {
  const RandomBot = require('../src/bots/RandomBot');
  const bot = makeBot({ 'bot.jumpProb': 0.05, config: {}, opt: {}, ml: {} }, 'stack-tower');
  assert.ok(bot instanceof RandomBot);
  assert.equal(bot.jumpProb, 0.05);
});
