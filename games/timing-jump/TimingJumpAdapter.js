/**
 * 타이밍 점프 어댑터
 * Gamzaworld TimingJumpGame 로직을 FunMeter에 연결
 */
const GameAdapter = require('../../src/GameAdapter');

// ES Module을 CommonJS에서 사용하기 위해 로직 인라인
const GAME_CONFIG = {
  gravity: 0.6,
  jumpForce: -11,
  playerX: 80,
  playerWidth: 30,
  playerHeight: 40,
  gameWidth: 600,
  gameHeight: 250,
  obstacleWidth: 28,
  obstacleMinHeight: 30,
  obstacleMaxHeight: 80,
  initialSpeed: 260,
  speedIncrement: 0.07,
};

class TimingJumpAdapter extends GameAdapter {
  constructor(config = {}) {
    super(config);
    // config로 기본값 덮어쓰기
    this._cfg = { ...GAME_CONFIG, ...config };
  }

  reset() {
    const cfg = this._cfg;
    this.playerY = 0;
    this.playerVY = 0;
    this.isOnGround = true;
    this.obstacles = [];
    this.score = 0;
    this.frameCount = 0;
    this.speed = cfg.initialSpeed;
    this.alive = true;
    this.nextObstacleIn = 100;
    this._obstacleIdCounter = 0;
  }

  update(input) {
    if (!this.alive) return;

    const cfg = this._cfg;
    this.frameCount++;
    this._time = this.frameCount / 60;
    this.speed = cfg.initialSpeed + this.frameCount * cfg.speedIncrement;

    // 점프 입력
    if (input === 'action' && this.isOnGround) {
      this.playerVY = cfg.jumpForce;
      this.isOnGround = false;
    }

    // 물리
    if (!this.isOnGround) {
      this.playerVY += cfg.gravity;
      this.playerY += this.playerVY;
      if (this.playerY >= 0) {
        this.playerY = 0;
        this.playerVY = 0;
        this.isOnGround = true;
      }
    }

    // 장애물 스폰
    this.nextObstacleIn--;
    if (this.nextObstacleIn <= 0) {
      const h = Math.floor(cfg.obstacleMinHeight + Math.random() * (cfg.obstacleMaxHeight - cfg.obstacleMinHeight));
      this.obstacles.push({ id: ++this._obstacleIdCounter, x: cfg.gameWidth, width: cfg.obstacleWidth, height: h, passed: false });
      this.nextObstacleIn = Math.max(18, 50 - Math.floor(this.frameCount / 40));
    }

    // 이동 + 충돌
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.speed / 60; // 픽셀/초 → 픽셀/프레임 (60fps 기준)

      if (!obs.passed && obs.x + obs.width < cfg.playerX) {
        obs.passed = true;
        this.score += 10;
      }
      if (obs.x + obs.width < 0) {
        this.obstacles.splice(i, 1);
      }
    }

    // AABB 충돌
    const margin = 4;
    const pLeft = cfg.playerX + margin;
    const pRight = cfg.playerX + cfg.playerWidth - margin;
    const pBottom = this.playerY;
    const pTop = this.playerY - cfg.playerHeight;

    for (const obs of this.obstacles) {
      const oLeft = obs.x + margin;
      const oRight = obs.x + obs.width - margin;
      const oTop = -obs.height;
      if (pRight > oLeft && pLeft < oRight && pBottom > oTop && pTop < 0) {
        this.alive = false;
        break;
      }
    }

    // 거리 점수
    if (this.frameCount % 5 === 0) this.score += 1;
  }

  getScore() { return this.score; }
  isAlive() { return this.alive; }
  getDifficulty() { return Math.min(this.speed / 500, 1); }
  getName() { return 'TimingJump'; }
}

module.exports = TimingJumpAdapter;
