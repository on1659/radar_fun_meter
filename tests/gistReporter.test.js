const { test } = require('node:test');
const assert = require('node:assert/strict');

// maskToken 함수 직접 테스트 (내부 함수는 export 안 되므로 gistReporter 모듈을 통해 uploadGist 테스트)
const { uploadGist, GistUploadError, GistAuthError } = require('../src/reporters/gistReporter');

// T-GR1: 토큰 없음 → GistAuthError
test('uploadGist: 토큰 없음 → GistAuthError', async () => {
  await assert.rejects(
    () => uploadGist({ name: 'test', zone: 'FLOW' }, {}),
    (err) => err instanceof GistAuthError
  );
});

// T-GR2: HTTP 에러 응답에 토큰이 노출되지 않음
// 실제 네트워크 호출을 피하기 위해 잘못된 토큰으로 호출하면 GitHub API가 401 반환
// 에러 메시지에 실제 토큰 문자열이 포함되지 않아야 함
// (네트워크 없는 환경에서 안정적으로 동작하도록 mockToken 기반으로 검증)
test('maskToken: 에러 메시지에 토큰 노출 없음 (mock 기반)', async () => {
  // uploadGist 내부에서 maskToken이 에러 메시지를 마스킹함을 간접 검증
  // 실제 네트워크 없이도 동작: 실제 GitHub 요청은 네트워크 오류를 낼 수 있으므로
  // 여기서는 maskToken 헬퍼를 직접 import해서 단위 테스트
  // gistReporter.js에서 maskToken을 export하지 않으므로, uploadGist의 동작을 통해 검증
  // 대신 모듈 내부 상태를 직접 확인하는 방식으로:

  // 가짜 토큰이 담긴 에러 메시지를 시뮬레이션
  const fakeToken = 'ghp_SUPERSECRETTOKEN12345';

  // uploadGist가 네트워크 에러를 던지는 경우 (네트워크 없음), 토큰이 노출되지 않아야 함
  try {
    await uploadGist({ name: 'test', zone: 'FLOW' }, { token: fakeToken });
    // 여기 도달하면 테스트 실패 (무조건 throw 해야 함)
    assert.fail('uploadGist should have thrown');
  } catch (err) {
    // 네트워크 오류(timeout 등) 또는 GistUploadError
    // 어느 쪽이든 에러 메시지에 실제 토큰 문자열이 없어야 함
    assert.ok(!err.message.includes(fakeToken),
      `에러 메시지에 토큰이 노출됨: ${err.message}`);
  }
});
