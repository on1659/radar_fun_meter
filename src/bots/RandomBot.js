/**
 * RandomBot - 랜덤 입력 봇
 * 가장 기본적인 봇. 일정 확률로 입력을 보냄.
 */
class RandomBot {
  constructor(options = {}) {
    this.inputChance = options.inputChance || 0.05; // 프레임당 입력 확률
    this.inputs = options.inputs || ['action']; // 가능한 입력 목록
  }

  /**
   * @param {GameAdapter} game
   * @param {number} tick
   * @returns {string|null}
   */
  decide(game, tick) {
    if (Math.random() < this.inputChance) {
      return this.inputs[Math.floor(Math.random() * this.inputs.length)];
    }
    return null;
  }
}

module.exports = RandomBot;
