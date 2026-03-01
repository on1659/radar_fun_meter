'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const fs       = require('fs');
const path     = require('path');
const { printHelp, printListGames, saveResult } = require('../src/cli/formatter');

// 콘솔 캡처 헬퍼
function captureLog(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.map(String).join(' '));
  try { fn(); } finally { console.log = orig; }
  return logs.join('\n');
}

const mockResult = {
  name: 'Test', runs: 5, zone: 'FLOW', emoji: '✅',
  advice: '재밌음', mean: 3.0, median: 3.0, stddev: 1.0,
  min: 1.0, max: 5.0, p25: 2.0, p75: 4.0, p90: 4.5, p95: 5.0,
  timeoutRate: 0, scoreMean: 0, scoreMax: 0,
  levelStats: null, histogram: [],
  survivalTimes: [1, 2, 3, 4, 5],
};

test('F-1: printHelp — 핵심 키워드 포함', () => {
  const output = captureLog(() => printHelp());
  assert.ok(output.includes('--game'),   '--game 옵션 포함');
  assert.ok(output.includes('--runs'),   '--runs 옵션 포함');
  assert.ok(output.includes('--bot'),    '--bot 옵션 포함');
  assert.ok(output.includes('funmeter'), '툴 이름 포함');
});

test('F-2: printHelp — ML/최적화 옵션 포함', () => {
  const output = captureLog(() => printHelp());
  assert.ok(output.includes('--ml.train'),  'ML 옵션 포함');
  assert.ok(output.includes('--optimize'),  '최적화 옵션 포함');
  assert.ok(output.includes('--serve'),     '서버 옵션 포함');
});

test('F-3: printListGames — levelMode 게임 → [레벨 모드] 출력', () => {
  const GAMES = { mygame: () => {} };
  const PARAMS = {
    mygame: {
      name: 'MyGame', min: 0, max: 100, hardDirection: 'higher',
      flowOptions: { levelMode: true },
    },
  };
  const output = captureLog(() => printListGames(GAMES, PARAMS));
  assert.ok(output.includes('[레벨 모드]'), 'levelMode 태그 포함');
});

test('F-4: printListGames — DEFAULT_PARAMS 없는 게임 → 안내 문구', () => {
  const GAMES = { mygame: () => {}, nogame: () => {} };
  const PARAMS = { mygame: { name: 'MyGame', min: 0, max: 100, hardDirection: 'higher' } };
  const output = captureLog(() => printListGames(GAMES, PARAMS));
  assert.ok(output.includes('(기본 파라미터 없음)'), '파라미터 없음 안내 포함');
});

test('F-5: saveResult .markdown → Markdown 내용 저장', () => {
  const filePath = path.join(process.cwd(), 'tmp-test.markdown');
  saveResult(filePath, mockResult);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('##'), 'Markdown 헤더 포함');
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

test('F-6: printHelp — 최적화 옵션 섹션 포함', () => {
  const output = captureLog(() => printHelp());
  assert.ok(output.includes('--optimize'), '최적화 옵션 포함');
  assert.ok(output.includes('--opt.runs'), 'opt.runs 포함');
  assert.ok(output.includes('--opt.iter'), 'opt.iter 포함');
});

test('F-7: printListGames — 빈 게임 레지스트리 → 헤더만 출력', () => {
  const output = captureLog(() => printListGames({}, {}));
  assert.ok(output.includes('사용 가능한 게임'), '헤더 포함');
});
