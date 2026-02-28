/**
 * FlappyBird 어댑터 — HumanLikeBot 호환 예제
 *
 * 파이프 장애물을 피하며 날아가는 게임
 * - 'action' 입력으로 날개짓 (점프)
 * - 중력으로 계속 떨어짐
 * - 파이프에 부딪히거나 바닥/천장에 닿으면 사망
 * - 파이프 통과 시 점수 +1
 *
 * HumanLikeBot 호환:
 * - this.obstacles (파이프 배열)
 * - this.isOnGround (false — 항상 공중)
 * - this.speed (파이프 이동 속도)
 * - this._cfg (플레이어 크기/위치)
 */

const GameAdapter = require('../../src/GameAdapter');

const CFG = {
  gravity: 0.4,
  jumpForce: -8,
  pipeGap: 120,
  pipeSpeed: 150,   // px/s
  pipeInterval: 90, // ticks
  playerX: 80,
  playerWidth: 34,
  playerHeight: 24,
  margin: 4,
};

class FlappyBirdAdapter extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this._cfg = { ...CFG, ...config };
  }

  reset() {
    const cfg = this._cfg;
    this.playerY = 150;
    this.playerVY = 0;
    this.isOnGround = true;  // HumanLikeBot 호환 — 언제든 날개짓 가능
    this.obstacles = [];     // HumanLikeBot이 읽을 파이프 배열
    this._pipeId = 0;
    this.score = 0;
    this.alive = true;
    this._time = 0;
    this.tick = 0;
    this.speed = cfg.pipeSpeed;
    this.nextPipe = cfg.pipeInterval;
  }

  update(input) {
    if (!this.alive) return;
    const cfg = this._cfg;
    this.tick++;
    this._time = this.tick / 60;

    // 날개짓
    if (input === 'action') this.playerVY = cfg.jumpForce;

    // 물리
    this.playerVY += cfg.gravity;
    this.playerY += this.playerVY;

    // 파이프 스폰
    if (this.tick >= this.nextPipe) {
      const gapY = 80 + Math.random() * 140;
      this.obstacles.push({
        id: ++this._pipeId,
        x: 400,
        gapTop: gapY,
        gapBottom: gapY + cfg.pipeGap,
        width: 52,
        passed: false,
      });
      this.nextPipe = this.tick + cfg.pipeInterval;
    }

    // 파이프 이동 + 충돌
    const spd = this.speed / 60;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const p = this.obstacles[i];
      p.x -= spd;
      if (!p.passed && p.x + p.width < cfg.playerX) {
        p.passed = true;
        this.score++;
      }
      if (p.x + p.width < 0) {
        this.obstacles.splice(i, 1);
        continue;
      }

      // AABB 충돌
      const m = cfg.margin;
      if (cfg.playerX + cfg.playerWidth - m > p.x + m &&
          cfg.playerX + m < p.x + p.width - m) {
        if (this.playerY - cfg.playerHeight < p.gapTop ||
            this.playerY > p.gapBottom) {
          this.alive = false;
        }
      }
    }

    // 바닥/천장 충돌
    if (this.playerY > 300 || this.playerY < 0) this.alive = false;
  }

  getScore()      { return this.score; }
  isAlive()       { return this.alive; }
  getDifficulty() { return Math.min(this.speed / 400, 1); }
  getName()       { return 'FlappyBird'; }
}

module.exports = FlappyBirdAdapter;
