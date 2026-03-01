'use strict';
const { test } = require('node:test');
const assert   = require('node:assert/strict');
const http     = require('http');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');

const { FunMeterServer } = require('../src/server/index');

/**
 * SSE 스트림에서 특정 이벤트를 수집하는 헬퍼.
 * 서버가 버퍼링한 이벤트를 포함하여 `count`개 받거나 `timeout`ms가 지나면 반환.
 *
 * @param {string} url       - SSE 엔드포인트 (e.g. 'http://127.0.0.1:PORT/events')
 * @param {string} eventType - 수집할 이벤트 타입 ('progress' | 'result' | ...)
 * @param {{count?: number, timeout?: number}} [opts]
 * @returns {Promise<object[]>}
 */
function readSSEEvents(url, eventType, { count = 1, timeout = 200 } = {}) {
  return new Promise((resolve, reject) => {
    const received = [];
    let buffer = '';

    const req = http.get(url, res => {
      res.setEncoding('utf8');
      res.on('data', chunk => {
        buffer += chunk;
        // SSE 이벤트는 \n\n 으로 구분
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop(); // 아직 완성되지 않은 마지막 블록 보존
        for (const block of blocks) {
          if (!block.trim()) continue;
          let type = null;
          let data = null;
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) type = line.slice(7).trim();
            if (line.startsWith('data: '))  data = line.slice(6).trim();
          }
          if (type === eventType && data) {
            received.push(JSON.parse(data));
          }
        }
        if (received.length >= count) {
          req.destroy();
          resolve(received);
        }
      });
      res.on('error', err => {
        if (err.code === 'ECONNRESET') resolve(received);
        else reject(err);
      });
    });

    req.on('error', err => {
      if (err.code === 'ECONNRESET') resolve(received);
      else reject(err);
    });

    const timer = setTimeout(() => {
      req.destroy();
      resolve(received);
    }, timeout);

    // resolve 후 타이머 정리 (메모리 누수 방지)
    req.once('close', () => clearTimeout(timer));
  });
}

// ── TC-1: HTTP 서버 기동 및 `/` 응답 ───────────────────────────────────────
test('서버 기동 후 대시보드 HTML 반환', async () => {
  const srv = new FunMeterServer({ port: 0 }); // OS가 빈 포트 할당
  const { url } = await srv.start();
  try {
    const res = await fetch(url);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /html/);
    const body = await res.text();
    assert.ok(body.includes('<canvas id="live-chart"'), '대시보드에 live-chart canvas가 있어야 함');
  } finally {
    srv.stop();
  }
});

// ── TC-2: SSE 진행률 이벤트 수신 ──────────────────────────────────────────
test('sendProgress() 가 SSE progress 이벤트를 클라이언트에 전달', async () => {
  const srv = new FunMeterServer({ port: 0 });
  const { url } = await srv.start();

  // 먼저 이벤트 전송 → 서버 버퍼에 저장됨
  srv.sendProgress({ run: 1, total: 10, elapsed: 1.0, score: 50 });
  srv.sendProgress({ run: 2, total: 10, elapsed: 2.1, score: 110 });

  // SSE 연결 시 버퍼 이벤트가 재전송됨
  const received = await readSSEEvents(`${url}/events`, 'progress', { count: 2, timeout: 100 });
  srv.stop();

  assert.equal(received.length, 2, `received=${JSON.stringify(received)}`);
  assert.equal(received[0].run, 1);
});

// ── TC-3: 히스토리 저장 및 조회 ──────────────────────────────────────────
test('saveHistory() + getHistory() 라운드트립', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-test-'));
  try {
    const srv = new FunMeterServer({ historyDir: tmpDir });

    const fakeResult = { name: 'timing-jump', zone: 'FLOW', median: 18.3, timeoutRate: 0.1 };
    srv.saveHistory(fakeResult);
    srv.saveHistory({ ...fakeResult, zone: 'TOO_HARD', median: 3.2 });

    const history = srv.getHistory();
    assert.equal(history.length, 2);
    // 최신순 정렬: 두 번째 저장(TOO_HARD)이 history[0]
    assert.equal(history[0].result.zone, 'TOO_HARD');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── TC-4: `/history` JSON 엔드포인트 ─────────────────────────────────────
test('/history 엔드포인트가 저장된 히스토리를 JSON으로 반환', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-test-'));
  const srv = new FunMeterServer({ port: 0, historyDir: tmpDir });
  const { url } = await srv.start();
  try {
    srv.saveHistory({ name: 'example', zone: 'FLOW', median: 12.0 });
    const res = await fetch(`${url}/history`);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.equal(data[0].result.name, 'example');
  } finally {
    srv.stop();
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── TC-5: 히스토리 디렉터리 쓰기 실패 시 경고만 출력 (중단 없음) ──────────
test('read-only 경로에 저장 시도해도 예외 없이 경고 출력', () => {
  const srv = new FunMeterServer({ historyDir: '/nonexistent/readonly/path' });
  // 예외 발생 없이 경고만 출력되어야 함
  assert.doesNotThrow(() => srv.saveHistory({ name: 'x', zone: 'FLOW' }));
});

// ── TC-6: SSE result 이벤트 수신 ─────────────────────────────────────────
test('sendResult() 가 SSE result 이벤트를 클라이언트에 전달', async () => {
  const srv = new FunMeterServer({ port: 0 });
  const { url } = await srv.start();

  // 먼저 이벤트 전송 → 서버 버퍼에 저장됨
  srv.sendResult({ name: 'timing-jump', zone: 'FLOW', median: 18.3, timeoutRate: 0.08 });

  // SSE 연결 시 버퍼 이벤트가 재전송됨
  const received = await readSSEEvents(`${url}/events`, 'result', { count: 1, timeout: 100 });
  srv.stop();

  assert.equal(received.length, 1, 'result 이벤트를 받아야 함');
  assert.equal(received[0].zone, 'FLOW');
  assert.equal(received[0].median, 18.3);
});

// ── TC-7: maxHistory 초과 시 가장 오래된 파일 삭제 ───────────────────────
test('maxHistory 초과 시 오래된 파일 자동 삭제', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-test-'));
  try {
    const srv = new FunMeterServer({ historyDir: tmpDir, maxHistory: 3 });

    for (let i = 0; i < 4; i++) {
      srv.saveHistory({ name: 'timing-jump', zone: 'FLOW', median: i });
    }

    const files = fs.readdirSync(tmpDir);
    assert.equal(files.length, 3, 'maxHistory 초과분(1개)이 삭제되어야 함');

    const history = srv.getHistory();
    assert.equal(history.length, 3);
    // 가장 오래된 항목(median=0)이 삭제되어 있어야 함
    const medians = history.map(h => h.result.median);
    assert.ok(!medians.includes(0), `median=0이 삭제되어야 하지만 남아있음: ${JSON.stringify(medians)}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── TC-8: 클라이언트 disconnect 후 sendProgress 안전성 ───────────────────
test('클라이언트 disconnect 후 sendProgress 호출해도 예외 없음', async () => {
  const srv = new FunMeterServer({ port: 0 });
  const { url } = await srv.start();

  // SSE 연결 후 타임아웃으로 disconnect 시뮬레이션
  // (서버가 버퍼 이벤트 없을 때 헤더를 즉시 flush 안 하므로 타임아웃 방식 사용)
  await readSSEEvents(`${url}/events`, 'progress', { count: 999, timeout: 20 });

  // 서버가 disconnect를 감지할 시간
  await new Promise(r => setTimeout(r, 50));

  // 끊긴 클라이언트에게 전송 → 예외 없어야 함
  assert.doesNotThrow(() => srv.sendProgress({ run: 1, total: 5, elapsed: 0.5 }));

  srv.stop();
});

// ── TC-9: 다수 클라이언트 동시 연결 + 브로드캐스트 ─────────────────────
test('다수 클라이언트 동시 연결 시 모두 동일 이벤트 수신', async () => {
  const srv = new FunMeterServer({ port: 0 });
  const { url } = await srv.start();

  // 3개 클라이언트 동시 연결 후 이벤트 수신 대기
  const clientCount = 3;
  const promises = Array.from({ length: clientCount }, () =>
    readSSEEvents(`${url}/events`, 'progress', { count: 1, timeout: 200 })
  );

  // 모든 클라이언트가 연결될 시간을 준 후 이벤트 전송
  await new Promise(r => setTimeout(r, 30));
  srv.sendProgress({ run: 7, total: 10, elapsed: 7.0 });

  const results = await Promise.all(promises);
  srv.stop();

  // 모든 클라이언트가 이벤트를 받아야 함
  for (let i = 0; i < clientCount; i++) {
    assert.ok(results[i].length >= 1, `클라이언트 ${i + 1}이 이벤트를 받지 못함`);
    assert.equal(results[i][0].run, 7, `클라이언트 ${i + 1}의 데이터가 다름`);
  }
});
