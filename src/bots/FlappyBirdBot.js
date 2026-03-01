/**
 * FlappyBirdBot - FlappyBird 전용 봇
 *
 * 특징:
 * - 다가오는 파이프의 간격 중앙 높이를 목표로 함
 * - 현재 높이가 목표보다 낮으면 날개짓
 * - accuracy로 실수율 조절 (기본 90%)
 * - 반응 지연 시뮬레이션 (100~300ms)
 */
class FlappyBirdBot {
  /**
   * @param {object} options
   * @param {number} options.accuracy - 정확도 0~1 (기본 0.9)
   * @param {number} options.reactionMin - 최소 반응 시간 ms (기본 100)
   * @param {number} options.reactionMax - 최대 반응 시간 ms (기본 300)
   * @param {number} options.ticksPerSecond - 게임 틱레이트 (기본 60)
   */
  constructor(options = {}) {
    this.accuracy = options.accuracy ?? 0.9;
    this.reactionMin = options.reactionMin ?? 100;
    this.reactionMax = options.reactionMax ?? 300;
    this.ticksPerSecond = options.ticksPerSecond ?? 60;

    this._minTicks = Math.round(this.reactionMin / (1000 / this.ticksPerSecond));
    this._maxTicks = Math.round(this.reactionMax / (1000 / this.ticksPerSecond));

    this._pendingTick = null;
    this._lastDecision = 0;
  }

  /**
   * 봇 상태를 초기화합니다. FunMeter.run()이 각 게임마다 호출합니다.
   */
  reset() {
    this._pendingTick = null;
    this._lastDecision = 0;
  }

  /**
   * FlappyBird 게임 상태를 분석해 날개짓 여부를 결정합니다.
   * 다음 파이프의 간격 중앙 높이를 목표로 반응 지연을 시뮬레이션합니다.
   * @param {object} game - FlappyBirdAdapter 인스턴스
   * @returns {string|null} 'action'(날개짓) 또는 null
   */
  decide(game) {
    // 대기 중인 반응 처리
    if (this._pendingTick !== null) {
      this._pendingTick--;
      if (this._pendingTick <= 0) {
        this._pendingTick = null;
        return Math.random() < this.accuracy ? 'action' : null;
      }
      return null;
    }

    const playerY = game.playerY;
    const gravity = game._cfg.gravity ?? 0.4;
    const avgDelay = (this._minTicks + this._maxTicks) / 2;
    const futureVY = game.playerVY + gravity * avgDelay;
    const futureY = playerY + futureVY * avgDelay;

    // 다음 파이프 찾기
    const nextPipe = this._findNextPipe(game);
    
    // 목표 높이 결정: 파이프가 있으면 간격 중앙, 없으면 화면 중앙
    const targetY = nextPipe
      ? (nextPipe.gapTop + nextPipe.gapBottom) / 2
      : 150; // 기본 유지 높이

    // 예측 높이가 목표보다 낮으면 날개짓
    const threshold = 10; // 여유 범위
    if (futureY > targetY + threshold) {
      // 연속 입력 방지 (최소 5틱 간격)
      const ticksSinceLast = game.tick - this._lastDecision;
      if (ticksSinceLast < 5) return null;

      const delay = this._minTicks + Math.floor(Math.random() * (this._maxTicks - this._minTicks + 1));
      this._pendingTick = delay;
      this._lastDecision = game.tick;
    }

    return null;
  }

  _findNextPipe(game) {
    if (!game.obstacles || game.obstacles.length === 0) return null;

    const cfg = game._cfg || {};
    const playerX = cfg.playerX ?? 80;

    // 플레이어보다 앞에 있는 가장 가까운 파이프
    let closest = null;
    let closestDist = Infinity;

    for (const pipe of game.obstacles) {
      if (pipe.passed) continue;
      const dist = pipe.x - playerX;
      if (dist > 0 && dist < closestDist) {
        closestDist = dist;
        closest = pipe;
      }
    }

    return closest;
  }
}

module.exports = FlappyBirdBot;
