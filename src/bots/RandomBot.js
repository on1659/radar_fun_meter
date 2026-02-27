/**
 * RandomBot - 랜덤 입력 봇
 * 각 게임에 맞는 입력을 랜덤 확률로 실행
 */
class RandomBot {
  constructor(options = {}) {
    this.jumpProb = options.jumpProb ?? 0.05;  // 기본 5% 확률로 점프/탭/드롭
  }

  /**
   * 봇의 입력 결정
   * @param {GameAdapter} game - 현재 게임 상태
   * @returns {string|null} 입력
   */
  decide(game) {
    if (Math.random() < this.jumpProb) {
      return 'action';
    }
    return null;
  }
}

module.exports = RandomBot;
