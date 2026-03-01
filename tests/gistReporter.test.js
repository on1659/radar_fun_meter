'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');
const { EventEmitter } = require('events');

const {
  uploadGist, viewGist,
  GistUploadError, GistAuthError, GistNotFoundError, GistFormatError,
} = require('../src/reporters/gistReporter');

// https.request monkey-patch 헬퍼 — Node 16+ 호환, 외부 라이브러리 의존 없음
function mockHttp({ status, body }) {
  const original = https.request;
  https.request = (options, cb) => {
    const res = Object.assign(new EventEmitter(), { statusCode: status });
    const req = Object.assign(new EventEmitter(), {
      write() {},
      end() { cb(res); res.emit('data', body); res.emit('end'); },
      setTimeout() {},
    });
    return req;
  };
  return () => { https.request = original; };
}

const mockResult = {
  name: 'TestGame', runs: 10, zone: 'FLOW', emoji: '🟢',
  advice: '적절한 난이도입니다.', mean: 8.5, median: 8.0, stddev: 1.5,
  p25: 7.0, p75: 9.5, p90: 10.5, p95: 11.0, timeoutRate: 0.1,
  scoreMean: 120, scoreMax: 200, levelStats: null,
  histogram: [{ from: 0, to: 5, count: 1, bar: '██' }],
};

// T-GR1: 토큰 없음 → GistAuthError
test('uploadGist: 토큰 없음 → GistAuthError', async () => {
  await assert.rejects(
    () => uploadGist({ name: 'test', zone: 'FLOW' }, {}),
    (err) => err instanceof GistAuthError
  );
});

// T-GR2: 에러 메시지에 토큰 미포함 (mock 기반)
test('maskToken: 에러 메시지에 토큰 노출 없음 (mock 기반)', async () => {
  const fakeToken = 'ghp_SUPERSECRETTOKEN12345';
  const restore = mockHttp({
    status: 401,
    body: `{"message":"Bad credentials","token":"${fakeToken}"}`,
  });
  try {
    await assert.rejects(
      () => uploadGist(mockResult, { token: fakeToken }),
      (err) => {
        assert.ok(
          !err.message.includes(fakeToken),
          `에러 메시지에 토큰이 노출됨: ${err.message}`
        );
        return true;
      }
    );
  } finally {
    restore();
  }
});

// T-GR3: uploadGist HTTP 201 성공 → { id, url } 반환
test('uploadGist HTTP 201 → { id, url } 반환', async () => {
  const restore = mockHttp({
    status: 201,
    body: JSON.stringify({ id: 'abc123', html_url: 'https://gist.github.com/abc123' }),
  });
  try {
    const result = await uploadGist(mockResult, { token: 'ghp_testtoken' });
    assert.strictEqual(result.id, 'abc123');
    assert.strictEqual(result.url, 'https://gist.github.com/abc123');
  } finally {
    restore();
  }
});

// T-GR4: uploadGist HTTP 401 실패 → GistUploadError throw
test('uploadGist HTTP 401 → GistUploadError throw', async () => {
  const restore = mockHttp({
    status: 401,
    body: JSON.stringify({ message: 'Bad credentials' }),
  });
  try {
    await assert.rejects(
      () => uploadGist(mockResult, { token: 'ghp_invalid' }),
      (err) => err instanceof GistUploadError
    );
  } finally {
    restore();
  }
});

// T-GR5: uploadGist 401 에러 메시지에 토큰 미포함 (maskToken 검증)
test('uploadGist: 401 에러 메시지에 토큰 미포함', async () => {
  const secretToken = 'ghp_MY_SECRET_TOKEN_XYZ';
  const restore = mockHttp({
    status: 401,
    body: `{"message":"token ${secretToken} is invalid"}`,
  });
  try {
    await assert.rejects(
      () => uploadGist(mockResult, { token: secretToken }),
      (err) => {
        assert.ok(
          !err.message.includes(secretToken),
          `토큰 노출: ${err.message}`
        );
        return true;
      }
    );
  } finally {
    restore();
  }
});

// T-GR6: viewGist HTTP 200 + content → JSON 파싱 결과 반환
test('viewGist HTTP 200 + content → JSON 파싱 결과 반환', async () => {
  const gistData = {
    files: {
      'funmeter-result.json': {
        content: JSON.stringify({ zone: 'FLOW', name: 'TestGame' }),
      },
    },
  };
  const restore = mockHttp({ status: 200, body: JSON.stringify(gistData) });
  try {
    const result = await viewGist('gist123');
    assert.strictEqual(result.zone, 'FLOW');
    assert.strictEqual(result.name, 'TestGame');
  } finally {
    restore();
  }
});

// T-GR7: viewGist HTTP 404 → GistNotFoundError throw
test('viewGist HTTP 404 → GistNotFoundError throw', async () => {
  const restore = mockHttp({ status: 404, body: JSON.stringify({ message: 'Not Found' }) });
  try {
    await assert.rejects(
      () => viewGist('nonexistent-gist'),
      (err) => err instanceof GistNotFoundError
    );
  } finally {
    restore();
  }
});

// T-GR8: viewGist HTTP 500 → GistUploadError throw
test('viewGist HTTP 500 → GistUploadError throw', async () => {
  const restore = mockHttp({ status: 500, body: 'Internal Server Error' });
  try {
    await assert.rejects(
      () => viewGist('gist123'),
      (err) => err instanceof GistUploadError
    );
  } finally {
    restore();
  }
});

// T-GR9: viewGist funmeter-result.json 없는 Gist → GistFormatError throw
test('viewGist: funmeter-result.json 없는 Gist → GistFormatError throw', async () => {
  const gistData = {
    files: {
      'some-other-file.txt': { content: 'hello' },
    },
  };
  const restore = mockHttp({ status: 200, body: JSON.stringify(gistData) });
  try {
    await assert.rejects(
      () => viewGist('gist123'),
      (err) => err instanceof GistFormatError
    );
  } finally {
    restore();
  }
});
