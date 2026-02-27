/**
 * GameAdapter - 모든 게임이 구현해야 하는 인터페이스
 */
class GameAdapter {
  constructor(config = {}) {
    this.config = config;
  }

  /** 게임 초기화 (매 run마다 호출) */
  reset() { throw new Error('reset() 구현 필요'); }

  /**
   * 한 틱(프레임) 진행
   * @param {string|null} input - 봇이 결정한 입력 ('jump', 'tap', 'drop', null 등)
   */
  update(input) { throw new Error('update() 구현 필요'); }

  /** 현재 점수 */
  getScore() { throw new Error('getScore() 구현 필요'); }

  /** 생존 여부 */
  isAlive() { throw new Error('isAlive() 구현 필요'); }

  /** 현재 난이도 (0~1) */
  getDifficulty() { throw new Error('getDifficulty() 구현 필요'); }

  /** 게임 이름 */
  getName() { throw new Error('getName() 구현 필요'); }

  /** 현재 생존 시간 (초) */
  getTime() { return this._time || 0; }
}

module.exports = GameAdapter;
