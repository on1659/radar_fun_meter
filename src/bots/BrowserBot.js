/**
 * BrowserBot — 브라우저 모드용 봇
 *
 * FunMeter.runBrowser()와 함께 사용하는 봇.
 * decide() 대신 act(state)를 사용하며, 확률적으로 키 입력을 반환합니다.
 *
 * 사용 예시:
 *   const bot = new BrowserBot({ actions: ['Space', 'ArrowLeft'], jumpProb: 0.05 });
 *   const action = bot.act({ score: 100, elapsed: 5.2 }); // 'Space' | null
 */

class BrowserBot {
  /**
   * @param {object} [options]
   * @param {string[]} [options.actions] - 허용 액션 목록 (기본: ['Space'])
   * @param {number} [options.jumpProb] - 매 폴링마다 액션 실행 확률 (기본: 0.05)
   */
  constructor({ actions = ['Space'], jumpProb = 0.05 } = {}) {
    this.actions = actions;
    this.jumpProb = jumpProb;
  }

  /**
   * 브라우저 게임 상태를 받아 액션 반환
   * @param {object} state - { score: number, elapsed: number }
   * @returns {string|null} - 키 이름 또는 null
   */
  act(state) {
    if (Math.random() < this.jumpProb) {
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    }
    return null;
  }

  reset() {}
}

module.exports = BrowserBot;
