/**
 * GameAdapter - 각 게임이 구현해야 하는 인터페이스
 * 
 * 새 게임을 추가하려면 이 클래스를 상속해서 구현하면 됨.
 */
class GameAdapter {
  /**
   * 게임 초기화
   * @param {Object} config - 게임 파라미터 (속도, 난이도 등)
   */
  constructor(config = {}) {
    this.config = config;
    this.tick = 0;
  }

  /**
   * 게임 한 프레임 진행
   * @param {string} input - 봇 입력 ('jump', 'tap', 'drop', null 등)
   * @returns {Object} { score, alive, difficulty }
   */
  update(input) {
    throw new Error('update() must be implemented');
  }

  /**
   * 게임 리셋 (새 라운드 시작)
   */
  reset() {
    throw new Error('reset() must be implemented');
  }

  /**
   * 현재 점수
   */
  getScore() {
    throw new Error('getScore() must be implemented');
  }

  /**
   * 살아있는지 여부
   */
  isAlive() {
    throw new Error('isAlive() must be implemented');
  }

  /**
   * 현재 난이도 (0.0 ~ 1.0)
   * 0 = 아주 쉬움, 1 = 최고 난이도
   */
  getDifficulty() {
    return 0.5; // 기본값, 필요하면 오버라이드
  }

  /**
   * 게임 이름
   */
  getName() {
    return this.constructor.name;
  }
}

module.exports = GameAdapter;
