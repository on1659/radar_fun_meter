const { test } = require('node:test');
const assert = require('node:assert/strict');
const BrowserGameAdapter = require('../src/BrowserGameAdapter');

// mock 페이지 팩토리
function makeMockPage({ scoreText = '42', deathElFound = false } = {}) {
  const scoreEl = { innerText: async () => scoreText };
  return {
    goto: async () => null,
    keyboard: { press: async () => null },
    $: async (selector) => {
      if (selector === '#score') return scoreEl;
      if (selector === '.game-over') return deathElFound ? {} : null;
      return null;
    },
    focus: async () => null,
    reload: async () => null,
    exposeFunction: async () => null,
    evaluate: async () => null,
    _pressedKeys: [],
  };
}

function makeMockBrowser(page) {
  return {
    newPage: async () => page,
    close: async () => null,
  };
}

function makeMockChromium(page) {
  const browser = makeMockBrowser(page);
  return {
    launch: async () => browser,
  };
}

// T2-1a: isAlive() — deathSelector 없으면 true
test('isAlive() returns true when deathSelector not found', async () => {
  const page = makeMockPage({ deathElFound: false });
  const chromium = makeMockChromium(page);

  const adapter = new BrowserGameAdapter({
    url: 'http://localhost:3000',
    deathSelector: '.game-over',
    _chromium: chromium,
  });
  await adapter.init();
  assert.equal(await adapter.isAlive(), true);
});

// T2-1b: isAlive() — deathSelector 있으면 false
test('isAlive() returns false when deathSelector found', async () => {
  const page = makeMockPage({ deathElFound: true });
  const chromium = makeMockChromium(page);

  const adapter = new BrowserGameAdapter({
    url: 'http://localhost:3000',
    deathSelector: '.game-over',
    _chromium: chromium,
  });
  await adapter.init();
  assert.equal(await adapter.isAlive(), false);
});

// T2-1c: update() — page.keyboard.press 호출
test('update() calls page.keyboard.press with action', async () => {
  const pressedKeys = [];
  const page = makeMockPage();
  page.keyboard.press = async (key) => { pressedKeys.push(key); };
  const chromium = makeMockChromium(page);

  const adapter = new BrowserGameAdapter({ url: 'http://localhost:3000', _chromium: chromium });
  await adapter.init();
  await adapter.update('Space');
  assert.deepEqual(pressedKeys, ['Space']);
});

// T2-1d: update(null) — 아무것도 안 함
test('update(null) does nothing', async () => {
  const pressedKeys = [];
  const page = makeMockPage();
  page.keyboard.press = async (key) => { pressedKeys.push(key); };
  const chromium = makeMockChromium(page);

  const adapter = new BrowserGameAdapter({ url: 'http://localhost:3000', _chromium: chromium });
  await adapter.init();
  await adapter.update(null);
  assert.deepEqual(pressedKeys, []);
});

// T2-1e: getScore() — scoreSelector로 점수 읽기
test('getScore() returns parsed score from DOM', async () => {
  const page = makeMockPage({ scoreText: '42' });
  const chromium = makeMockChromium(page);

  const adapter = new BrowserGameAdapter({
    url: 'http://localhost:3000',
    scoreSelector: '#score',
    _chromium: chromium,
  });
  await adapter.init();
  assert.equal(await adapter.getScore(), 42);
});

// T2-1f: getName() — name 없으면 URL hostname
test('getName() returns hostname when name not set', () => {
  const adapter = new BrowserGameAdapter({ url: 'http://mygame.example.com/play' });
  assert.equal(adapter.getName(), 'mygame.example.com');
});

// T2-1g: getName() — name 설정 시 그 값 반환
test('getName() returns config.name when set', () => {
  const adapter = new BrowserGameAdapter({
    url: 'http://localhost:3000',
    name: 'MyWebGame',
  });
  assert.equal(adapter.getName(), 'MyWebGame');
});

// T2-1h: url 없으면 에러
test('BrowserGameAdapter throws when url is missing', () => {
  assert.throws(() => new BrowserGameAdapter({}), /url is required/);
});

// T2-1i: close() — 브라우저 종료
test('close() closes the browser', async () => {
  let closed = false;
  const page = makeMockPage();
  const browser = makeMockBrowser(page);
  browser.close = async () => { closed = true; };
  const chromium = { launch: async () => browser };

  const adapter = new BrowserGameAdapter({ url: 'http://localhost:3000', _chromium: chromium });
  await adapter.init();
  await adapter.close();
  assert.equal(closed, true);
  assert.equal(adapter._browser, null);
  assert.equal(adapter._page, null);
});

// T2-1j: reset() — _score, _alive 초기화
test('reset() resets internal state', async () => {
  const page = makeMockPage();
  const chromium = makeMockChromium(page);

  const adapter = new BrowserGameAdapter({ url: 'http://localhost:3000', _chromium: chromium });
  await adapter.init();

  adapter._score = 999;
  adapter._alive = false;
  await adapter.reset();

  assert.equal(adapter._score, 0);
  assert.equal(adapter._alive, true);
});

// T2-1k: 스크립트 인젝션 패턴 → 생성자 throw (P1-4)
test('스크립트 인젝션 scoreSelector → 생성자 throw', () => {
  assert.throws(
    () => new BrowserGameAdapter({
      url: 'http://localhost',
      scoreSelector: '<script>alert(1)</script>',
    }),
    /허용되지 않는 패턴/
  );
});

// T2-1l: 빈 문자열 셀렉터 → 생성자 throw (P1-4)
test('빈 deathSelector → 생성자 throw', () => {
  assert.throws(
    () => new BrowserGameAdapter({
      url: 'http://localhost',
      deathSelector: '',
    }),
    /비어 있지 않은 문자열/
  );
});

// T2-1m: javascript: 패턴 → 생성자 throw (P1-4)
test('javascript: 패턴 restartSelector → 생성자 throw', () => {
  assert.throws(
    () => new BrowserGameAdapter({
      url: 'http://localhost',
      restartSelector: 'javascript:alert(1)',
    }),
    /허용되지 않는 패턴/
  );
});

// T2-1n: 정상 셀렉터 → 생성자 성공 (P1-4)
test('정상 셀렉터 → 생성자 성공', () => {
  assert.doesNotThrow(() => new BrowserGameAdapter({
    url: 'http://localhost',
    scoreSelector: '#score',
    deathSelector: '.game-over',
  }));
});
