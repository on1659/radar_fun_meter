'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { toHTML } = require('../src/reporters/htmlReporter');
const { toMarkdown } = require('../src/reporters/mdReporter');

const mockResult = {
  name: 'TestGame', runs: 10, zone: 'FLOW', emoji: '🟢',
  advice: '적절한 난이도입니다.', mean: 8.5, median: 8.0, stddev: 1.5,
  p25: 7.0, p75: 9.5, p90: 10.5, p95: 11.0, timeoutRate: 0.1,
  scoreMean: 120, scoreMax: 200, levelStats: null,
  histogram: [
    { from: 0, to: 5, count: 1, bar: '██' },
    { from: 5, to: 10, count: 8, bar: '█████████████' },
    { from: 10, to: 15, count: 1, bar: '██' },
  ],
};

describe('htmlReporter', function() {
  test('HTML 기본 구조 포함', function() {
    const html = toHTML(mockResult);
    assert.ok(html.includes('<!DOCTYPE html>'), '<!DOCTYPE html> 포함되어야 함');
    assert.ok(html.includes('<html'), '<html> 태그 포함되어야 함');
  });

  test('게임 이름과 타이틀 포함', function() {
    const html = toHTML(mockResult);
    assert.ok(html.includes('TestGame'), '게임 이름 포함되어야 함');
    assert.ok(html.includes('Fun Meter'), 'Fun Meter 타이틀 포함되어야 함');
  });

  test('FLOW zone 배지 색상 #22c55e', function() {
    const html = toHTML(mockResult);
    assert.ok(html.includes('#22c55e'), 'FLOW 배지 색상 #22c55e 포함되어야 함');
  });

  test('script 태그 미포함 (self-contained 확인)', function() {
    const html = toHTML(mockResult);
    assert.ok(!html.includes('<script'), '<script> 태그 없어야 함');
  });

  test('TOO_HARD zone 배지 색상 #ef4444', function() {
    const hardResult = Object.assign({}, mockResult, { zone: 'TOO_HARD', emoji: '🔴' });
    const html = toHTML(hardResult);
    assert.ok(html.includes('#ef4444'), 'TOO_HARD 배지 색상 #ef4444 포함되어야 함');
  });

  test('TOO_EASY zone 배지 색상 #f59e0b', function() {
    const easyResult = Object.assign({}, mockResult, { zone: 'TOO_EASY', emoji: '🟡' });
    const html = toHTML(easyResult);
    assert.ok(html.includes('#f59e0b'), 'TOO_EASY 배지 색상 #f59e0b 포함되어야 함');
  });

  test('levelStats null 시 레벨 섹션 미포함', function() {
    const html = toHTML(mockResult); // levelStats: null
    // 레벨 섹션이 없거나 빈 상태여야 함
    const levelHeadingIdx = html.indexOf('<h2>레벨</h2>');
    assert.ok(levelHeadingIdx === -1, 'levelStats null 시 레벨 h2 없어야 함');
  });

  test('levelStats 있을 때 레벨 섹션 포함', function() {
    const resultWithLevel = Object.assign({}, mockResult, {
      levelStats: { mean: 3.5, median: 3.0, max: 7, p25: 2.0, p75: 5.0 },
    });
    const html = toHTML(resultWithLevel);
    assert.ok(html.includes('<h2>레벨</h2>'), 'levelStats 있을 때 레벨 h2 포함되어야 함');
  });

  // T-HR9: deathPattern 있을 때 사망 패턴 섹션 포함
  test('deathPattern 있을 때 사망 패턴 섹션 포함', function() {
    const result = Object.assign({}, mockResult, {
      deathPattern: { skewness: 0.412, kurtosis: -0.231, cluster: 'early' },
    });
    const html = toHTML(result);
    assert.ok(html.includes('사망 패턴'), '사망 패턴 h2 포함되어야 함');
    assert.ok(html.includes('0.412'), '왜도 값 포함되어야 함');
  });

  // T-HR10: scoreCurve 있을 때 점수 곡선 섹션 포함
  test('scoreCurve 있을 때 점수 곡선 섹션 포함', function() {
    const result = Object.assign({}, mockResult, {
      scoreCurve: {
        buckets: [10, 20, 30, 25, 15, 10, 8, 5, 3, 2,
                  1,  1,  1,  1,  1,  1,  1, 1, 1, 1],
        pattern: 'rising',
        growth1H: 12.5,
        growth2H: 3.2,
      },
    });
    const html = toHTML(result);
    assert.ok(html.includes('점수 곡선'), '점수 곡선 h2 포함되어야 함');
    assert.ok(html.includes('rising'), 'pattern 포함되어야 함');
  });

  // T-HR11: suggestions 배열 있을 때 제안 섹션 포함
  test('suggestions 있을 때 제안 섹션 포함', function() {
    const result = Object.assign({}, mockResult, {
      suggestions: ['초반 난이도 낮추기', '점프 판정 완화'],
    });
    const html = toHTML(result);
    assert.ok(html.includes('제안'), '제안 h2 포함되어야 함');
    assert.ok(html.includes('초반 난이도 낮추기'), '제안 내용 포함되어야 함');
  });
});

describe('mdReporter', function() {
  test('헤더에 게임 이름과 zone 포함', function() {
    const md = toMarkdown(mockResult);
    assert.ok(md.includes('## 🟢 TestGame'), '헤더에 게임 이름 포함되어야 함');
    assert.ok(md.includes('FLOW'), 'zone 포함되어야 함');
  });

  test('GFM 테이블에 평균 통계 포함', function() {
    const md = toMarkdown(mockResult);
    assert.ok(md.includes('| 평균 | 8.5s |'), '평균 통계 행 포함되어야 함');
  });

  test('levelStats null 시 레벨 섹션 미포함', function() {
    const md = toMarkdown(mockResult); // levelStats: null
    assert.ok(!md.includes('## 레벨'), 'levelStats null 시 레벨 섹션 없어야 함');
  });

  test('levelStats 있을 때 레벨 섹션 포함', function() {
    const resultWithLevel = Object.assign({}, mockResult, {
      levelStats: { mean: 3.5, median: 3.0, max: 7, p25: 2.0, p75: 5.0 },
    });
    const md = toMarkdown(resultWithLevel);
    assert.ok(md.includes('## 레벨'), '레벨 섹션 포함되어야 함');
  });

  test('히스토그램 코드 블록 포함', function() {
    const md = toMarkdown(mockResult);
    assert.ok(md.includes('```'), '코드 블록 포함되어야 함');
  });

  test('어드바이스 인용구 포함', function() {
    const md = toMarkdown(mockResult);
    assert.ok(md.includes('> 💡'), '어드바이스 인용구 포함되어야 함');
    assert.ok(md.includes('적절한 난이도입니다.'), '어드바이스 내용 포함되어야 함');
  });

  test('Generated by 메타 포함', function() {
    const md = toMarkdown(mockResult);
    assert.ok(md.includes('radar_fun_meter'), 'Generated by 메타 포함되어야 함');
  });
});
