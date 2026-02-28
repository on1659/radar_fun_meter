/**
 * HumanLikeBot - 사람처럼 반응하는 봇
 *
 * 특징:
 * - 장애물/이벤트를 감지해서 반응 (랜덤이 아님)
 * - 인간 반응 지연 100~300ms 시뮬레이션
 * - accuracy 파라미터로 실수율 조절 (기본 90%)
 *
 * 지원 게임:
 * - TimingJump: 장애물이 접근할 때 점프
 * - StackTower: 블록이 중앙에 왔을 때 드롭
 * - RhythmTap: 노트가 타겟 존에 들어올 때 탭
 */
class HumanLikeBot {
  /**
   * @param {object} options
   * @param {number} options.accuracy - 정확도 0~1 (기본 0.9 = 90%)
   * @param {number} options.reactionMin - 최소 반응 시간 ms (기본 100ms)
   * @param {number} options.reactionMax - 최대 반응 시간 ms (기본 300ms)
   * @param {number} options.ticksPerSecond - 게임 틱레이트 (기본 60)
   */
  constructor(options = {}) {
    this.accuracy = options.accuracy ?? 0.9;
    this.reactionMin = options.reactionMin ?? 100;  // ms
    this.reactionMax = options.reactionMax ?? 300;  // ms
    this.ticksPerSecond = options.ticksPerSecond ?? 60;

    // ms → ticks 변환
    this._minTicks = Math.round(this.reactionMin / (1000 / this.ticksPerSecond));
    this._maxTicks = Math.round(this.reactionMax / (1000 / this.ticksPerSecond));

    // 반응 대기 상태
    this._pendingTick = null;    // 남은 틱 (null이면 대기 없음)
    this._handledIds = new Set(); // 이미 반응한 장애물 ID 추적
  }

  /**
   * 게임 reset 시 봇 상태 초기화
   */
  reset() {
    this._pendingTick = null;
    this._handledIds = new Set();
    this._lastStackState = null;
  }

  /**
   * 봇의 입력 결정
   * @param {GameAdapter} game
   * @returns {string|null}
   */
  decide(game) {
    // 대기 중인 반응 처리
    if (this._pendingTick !== null) {
      this._pendingTick--;
      if (this._pendingTick <= 0) {
        this._pendingTick = null;
        // accuracy 확률로 성공, 나머지는 실수 (null 반환)
        return Math.random() < this.accuracy ? 'action' : null;
      }
      return null;
    }

    // 위협 감지 → 반응 예약
    if (this._detectThreat(game)) {
      const delay = this._minTicks + Math.floor(Math.random() * (this._maxTicks - this._minTicks + 1));
      this._pendingTick = delay;
    }

    return null;
  }

  /**
   * 현재 게임 타입에 맞게 위협 감지
   * @private
   */
  _detectThreat(game) {
    // TimingJump 감지: obstacles 배열 보유
    if (game.obstacles && Array.isArray(game.obstacles)) {
      return this._detectTimingJumpThreat(game);
    }
    // StackTower 감지: currentBlock + stackedBlocks 보유
    if (game.currentBlock && game.stackedBlocks) {
      return this._detectStackTowerThreat(game);
    }
    // RhythmTap 감지: notes 배열 보유
    if (game.notes && Array.isArray(game.notes)) {
      return this._detectRhythmTapThreat(game);
    }
    return false;
  }

  /**
   * TimingJump: 접근하는 장애물 감지
   * 장애물이 위험 존에 진입하기까지의 "시간"으로 판단 (픽셀 거리가 아님)
   * @private
   */
  _detectTimingJumpThreat(game) {
    // 공중에 있으면 점프 불가
    if (!game.isOnGround) return false;

    const cfg = game._cfg || {};
    const playerX = cfg.playerX ?? 80;
    const playerWidth = cfg.playerWidth ?? 30;
    const margin = cfg.margin ?? 4;
    const speed = game.speed ?? 260;
    const speedPerTick = speed / this.ticksPerSecond;

    // 위험 존 진입 위치: 장애물 왼쪽이 플레이어 오른쪽에 닿는 순간
    const dangerEntryX = playerX + playerWidth - margin; // ~106

    // 반응 후 가장 유리한 점프 타이밍 (위험 존 진입 약 18틱 전)
    const idealLeadTicks = 18;
    // 최대 반응 지연 + 이상적 리드 타임 = 총 감지 리드
    const totalLeadTicks = this._maxTicks + idealLeadTicks;
    // 감지 거리: 위험 존에서 totalLeadTicks 이전
    const detectionDist = (dangerEntryX - playerX) + totalLeadTicks * speedPerTick;

    // 가장 가까운 미통과 장애물 탐색
    let closest = null;
    let closestDist = Infinity;

    for (const obs of game.obstacles) {
      if (obs.passed) continue;
      const dist = obs.x - playerX;
      if (dist > 0 && dist < closestDist) {
        closestDist = dist;
        closest = obs;
      }
    }

    if (!closest) return false;
    if (closestDist > detectionDist) return false;
    if (this._handledIds.has(closest.id)) return false;

    this._handledIds.add(closest.id);
    // 오래된 ID 정리 (메모리 관리)
    if (this._handledIds.size > 50) {
      const first = this._handledIds.values().next().value;
      this._handledIds.delete(first);
    }

    return true;
  }

  /**
   * StackTower: 현재 블록이 이전 블록 중앙에 가까울 때 감지
   * @private
   */
  _detectStackTowerThreat(game) {
    const curr = game.currentBlock;
    const stackedBlocks = game.stackedBlocks;
    if (!curr || !stackedBlocks || stackedBlocks.length === 0) return false;

    const prev = stackedBlocks[stackedBlocks.length - 1];
    const prevCenter = prev.x + prev.width / 2;
    const currCenter = curr.x + curr.width / 2;
    const dist = Math.abs(currCenter - prevCenter);

    // 반응 지연 동안 블록이 이동하는 거리 고려
    const speed = game.speed ?? 3;
    const avgDelayTicks = (this._minTicks + this._maxTicks) / 2;
    const moveWhileReacting = speed * avgDelayTicks;

    // 감지 임계값: 반응 후 블록이 이동할 거리 + 약간의 여유
    const threshold = moveWhileReacting * 0.8;

    if (dist <= threshold) {
      // 중복 반응 방지: 블록 위치가 크게 바뀔 때만
      const stateKey = `${Math.round(currCenter)}_${stackedBlocks.length}`;
      if (this._lastStackState === stateKey) return false;
      this._lastStackState = stateKey;
      return true;
    }

    return false;
  }

  /**
   * RhythmTap: 타겟 존에 접근하는 노트 감지
   * @private
   */
  _detectRhythmTapThreat(game) {
    const cfg = game._cfg || {};
    const targetY = cfg.targetY ?? 320;
    const speed = game.speed ?? 3;

    // 반응 지연 동안 노트가 이동하는 거리
    const avgDelayTicks = (this._minTicks + this._maxTicks) / 2;
    const noteMovement = speed * avgDelayTicks;
    const detectionDist = cfg.goodRange + noteMovement;

    for (const note of game.notes) {
      if (note.hit) continue;
      const dist = targetY - note.y;
      if (dist > 0 && dist <= detectionDist) {
        const key = `note_${note.id}`;
        if (!this._handledIds.has(key)) {
          this._handledIds.add(key);
          return true;
        }
      }
    }

    return false;
  }
}

module.exports = HumanLikeBot;
