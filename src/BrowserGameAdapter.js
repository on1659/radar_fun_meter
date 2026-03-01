/**
 * BrowserGameAdapter — Playwright 기반 실제 웹게임 어댑터
 *
 * URL + DOM 셀렉터만으로 실제 웹게임을 FunMeter로 테스트할 수 있습니다.
 *
 * 필요 조건: npm install playwright && npx playwright install chromium
 *
 * 사용 예시:
 *   const adapter = new BrowserGameAdapter({
 *     url: 'http://localhost:3000',
 *     scoreSelector: '#score',
 *     deathSelector: '.game-over',
 *   });
 *   await adapter.init();
 *   // ... FunMeter.runBrowser(adapter, bot) 호출
 *   await adapter.close();
 */

const QUERY_TIMEOUT = 2000; // DOM 쿼리 타임아웃 2초

function validateSelector(selector, fieldName) {
  if (typeof selector !== 'string' || selector.trim() === '') {
    throw new Error(`BrowserGameAdapter: ${fieldName}은 비어 있지 않은 문자열이어야 합니다`);
  }
  const forbidden = /<script/i.test(selector) || /javascript:/i.test(selector);
  if (forbidden) {
    throw new Error(`BrowserGameAdapter: ${fieldName}에 허용되지 않는 패턴이 포함되어 있습니다`);
  }
}

class BrowserGameAdapter {
  /**
   * @param {object} config
   * @param {string} config.url - 게임 URL (필수)
   * @param {string[]} [config.actions] - 허용 키 입력 목록 (기본: ['Space'])
   * @param {string} [config.scoreSelector] - 점수 DOM 셀렉터 (기본: '#score')
   * @param {string} [config.deathSelector] - 게임오버 DOM 셀렉터 (기본: '.game-over')
   * @param {string|null} [config.restartSelector] - 재시작 버튼 셀렉터 (없으면 reload)
   * @param {boolean} [config.usePostMessage] - postMessage 기반 상태 수신 (기본: false)
   * @param {number} [config.pollInterval] - DOM 폴링 주기 ms (기본: 50)
   * @param {number} [config.timeout] - 최대 생존 시간 ms (기본: 60000)
   * @param {boolean} [config.headless] - 헤드리스 모드 (기본: true)
   * @param {string} [config.name] - 게임 이름 (기본: URL hostname)
   * @param {object} [config._chromium] - 테스트용 chromium 주입 (선택)
   */
  constructor(config = {}) {
    if (!config.url) throw new Error('BrowserGameAdapter: url is required');

    this._chromiumOverride = config._chromium ?? null;

    this.config = {
      actions: ['Space'],
      scoreSelector: '#score',
      deathSelector: '.game-over',
      restartSelector: null,
      usePostMessage: false,
      pollInterval: 50,
      timeout: 60_000,
      headless: true,
      name: null,
      ...config,
    };
    // _chromium은 내부 전용, config에서 제거
    delete this.config._chromium;

    // 셀렉터 검증
    validateSelector(this.config.scoreSelector, 'scoreSelector');
    validateSelector(this.config.deathSelector, 'deathSelector');
    if (this.config.restartSelector !== null) {
      validateSelector(this.config.restartSelector, 'restartSelector');
    }

    this._browser = null;
    this._page = null;
    this._score = 0;
    this._alive = true;
    this._startTime = null;
  }

  /**
   * Playwright 브라우저 시작 및 페이지 이동
   */
  async init() {
    const chromium = this._chromiumOverride
      ?? (await import('playwright').then(m => m.chromium));

    this._browser = await chromium.launch({ headless: this.config.headless });
    this._page = await this._browser.newPage();
    await this._page.goto(this.config.url, { waitUntil: 'networkidle' });

    if (this.config.usePostMessage) {
      await this._page.exposeFunction('__funmeterState', (state) => {
        this._score = state.score ?? this._score;
        this._alive = state.alive ?? this._alive;
      });
      await this._page.evaluate(() => {
        window.addEventListener('message', (e) => {
          if (e.data?.type === 'FUNMETER_STATE') {
            window.__funmeterState(e.data);
          }
        });
      });
    }
  }

  /**
   * 게임 재시작 (restartSelector 클릭 또는 페이지 reload)
   */
  async reset() {
    this._score = 0;
    this._alive = true;
    this._startTime = Date.now();

    if (this.config.restartSelector) {
      const btn = await this._page.$(this.config.restartSelector);
      if (btn) {
        await btn.click();
        return;
      }
    }
    await this._page.reload({ waitUntil: 'networkidle' });
    await this._page.focus('body');
  }

  /**
   * 키보드 입력 주입
   * @param {string|null} action - 키 이름 (예: 'Space', 'ArrowLeft') 또는 null
   */
  async update(action) {
    if (!action) return;
    await this._page.keyboard.press(action);
  }

  /**
   * DOM에서 점수 읽기
   * @returns {Promise<number>}
   */
  async getScore() {
    if (this.config.usePostMessage) return this._score;
    try {
      const el = await Promise.race([
        this._page.$(this.config.scoreSelector),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), QUERY_TIMEOUT)),
      ]);
      if (!el) return 0;
      const text = await el.innerText();
      return parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 게임 생존 여부 확인 (deathSelector 요소 부재 = 생존)
   * @returns {Promise<boolean>}
   */
  async isAlive() {
    if (this.config.usePostMessage) return this._alive;
    try {
      const el = await Promise.race([
        this._page.$(this.config.deathSelector),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), QUERY_TIMEOUT)),
      ]);
      return el === null;
    } catch {
      return true; // 타임아웃 시 살아있는 것으로 간주 (안전한 기본값)
    }
  }

  /**
   * 게임 이름 반환 (name 설정 없으면 URL hostname)
   * @returns {string}
   */
  getName() {
    return this.config.name ?? new URL(this.config.url).hostname;
  }

  /**
   * 브라우저 종료
   */
  async close() {
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
      this._page = null;
    }
  }
}

module.exports = BrowserGameAdapter;
