// 테스트 전용 — isAlive()가 항상 true인 무한 루프 게임
class InfiniteGame {
  reset() {}
  update() {}
  getScore() { return 0; }
  isAlive() { return true; }
  getName() { return 'Infinite'; }
  getDifficulty() { return 1; }
}

module.exports = InfiniteGame;
