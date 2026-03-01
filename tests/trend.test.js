const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FunMeterServer } = require('../src/server/index');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'funmeter-trend-'));
}

// 히스토리 엔트리를 파일로 저장 (오래된 것 먼저 — 파일명 알파벳 오름차순)
function writeEntries(dir, entries) {
  for (let i = 0; i < entries.length; i++) {
    const seq = String(i).padStart(6, '0');
    const filename = `2024-01-01T00-00-00.000Z-${seq}.json`;
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(entries[i]), 'utf8');
  }
}

// Test 1: 상승 추세 감지
test('getTrend: 상승 추세 감지', () => {
  const dir = makeTmpDir();
  const entries = [
    { savedAt: '2024-01-01T00:00:00Z', result: { median: 5,  zone: 'FLOW' } },
    { savedAt: '2024-01-02T00:00:00Z', result: { median: 8,  zone: 'FLOW' } },
    { savedAt: '2024-01-03T00:00:00Z', result: { median: 11, zone: 'FLOW' } },
    { savedAt: '2024-01-04T00:00:00Z', result: { median: 14, zone: 'FLOW' } },
  ];
  writeEntries(dir, entries);

  const srv = new FunMeterServer({ historyDir: dir, maxHistory: 10 });
  const { slope, feedback, outliers } = srv.getTrend();

  assert.ok(slope > 0.5, `slope(${slope}) > 0.5 이어야 함`);
  assert.ok(feedback.includes('상승 추세'), `feedback에 '상승 추세' 포함 필요: ${feedback}`);
  assert.equal(outliers.length, 0);

  fs.rmSync(dir, { recursive: true });
});

// Test 2: 이상치 탐지
test('getTrend: 이상치 탐지', () => {
  const dir = makeTmpDir();
  const medians = [10, 10, 10, 10, 10, 60];
  const entries = medians.map((median, i) => ({
    savedAt: `2024-01-0${i + 1}T00:00:00Z`,
    result: { median, zone: 'FLOW' },
  }));
  writeEntries(dir, entries);

  const srv = new FunMeterServer({ historyDir: dir, maxHistory: 10 });
  const { outliers } = srv.getTrend();

  assert.equal(outliers.length, 1);
  assert.equal(outliers[0].result.median, 60);

  fs.rmSync(dir, { recursive: true });
});

// Test 3: 데이터 부족 처리
test('getTrend: 데이터 부족 처리 (2개)', () => {
  const dir = makeTmpDir();
  const entries = [
    { savedAt: '2024-01-01T00:00:00Z', result: { median: 5, zone: 'FLOW' } },
    { savedAt: '2024-01-02T00:00:00Z', result: { median: 8, zone: 'FLOW' } },
  ];
  writeEntries(dir, entries);

  const srv = new FunMeterServer({ historyDir: dir, maxHistory: 10 });
  const { slope, feedback } = srv.getTrend();

  assert.equal(slope, null);
  assert.ok(feedback.includes('데이터 부족'), `feedback에 '데이터 부족' 포함 필요: ${feedback}`);

  fs.rmSync(dir, { recursive: true });
});

// Test 4: 안정 구간 판정
test('getTrend: 안정적인 추세 판정', () => {
  const dir = makeTmpDir();
  const medians = [10, 10.1, 9.9, 10.2, 9.8];
  const entries = medians.map((median, i) => ({
    savedAt: `2024-01-0${i + 1}T00:00:00Z`,
    result: { median, zone: 'FLOW' },
  }));
  writeEntries(dir, entries);

  const srv = new FunMeterServer({ historyDir: dir, maxHistory: 10 });
  const { slope, feedback } = srv.getTrend();

  assert.ok(Math.abs(slope) < 0.5, `|slope|(${Math.abs(slope)}) < 0.5 이어야 함`);
  assert.ok(feedback.includes('안정적인 추세'), `feedback에 '안정적인 추세' 포함 필요: ${feedback}`);

  fs.rmSync(dir, { recursive: true });
});

// Test 5: 게임 필터링
test('getTrend: 게임 이름 필터링', () => {
  const dir = makeTmpDir();
  const entries = [
    { savedAt: '2024-01-01T00:00:00Z', result: { name: 'timing-jump', median: 7.0, zone: 'FLOW' } },
    { savedAt: '2024-01-02T00:00:00Z', result: { name: 'timing-jump', median: 7.1, zone: 'FLOW' } },
    { savedAt: '2024-01-03T00:00:00Z', result: { name: 'timing-jump', median: 6.9, zone: 'FLOW' } },
    { savedAt: '2024-01-04T00:00:00Z', result: { name: 'stack-tower', median: 20.0, zone: 'FLOW' } },
    { savedAt: '2024-01-05T00:00:00Z', result: { name: 'stack-tower', median: 20.1, zone: 'FLOW' } },
    { savedAt: '2024-01-06T00:00:00Z', result: { name: 'stack-tower', median: 19.9, zone: 'FLOW' } },
  ];
  writeEntries(dir, entries);

  const srv = new FunMeterServer({ historyDir: dir, maxHistory: 10 });

  const jumpResult = srv.getTrend('timing-jump');
  assert.equal(jumpResult.entries.length, 3, 'timing-jump 3개');
  for (const e of jumpResult.entries) {
    assert.ok(Math.abs(e.result.median - 7) < 0.5, `timing-jump 중앙값 ~7s: ${e.result.median}`);
  }

  const towerResult = srv.getTrend('stack-tower');
  assert.equal(towerResult.entries.length, 3, 'stack-tower 3개');
  for (const e of towerResult.entries) {
    assert.ok(Math.abs(e.result.median - 20) < 0.5, `stack-tower 중앙값 ~20s: ${e.result.median}`);
  }

  const allResult = srv.getTrend();
  assert.equal(allResult.entries.length, 6, '필터 없음 → 6개');

  fs.rmSync(dir, { recursive: true });
});
