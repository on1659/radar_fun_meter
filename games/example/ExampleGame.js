/**
 * ExampleGame - 타이밍 점프 스타일 예제 (HumanLikeBot 호환)
 *
 * HumanLikeBot이 필요한 필드를 노출:
 *   game._cfg        - playerX, playerWidth, margin 등
 *   game.isOnGround  - 점프 가능 여부
 *   game.speed       - px/s 단위 속도
 *   game.obstacles   - [{ id, x, width, height, passed }]
 */
const GameAdapter = require('../../src/GameAdapter');

const GAME_CONFIG = {
  gravity: 0.5,
  jumpForce: -10,
  playerX: 80,
  playerWidth: 28,
  playerHeight: 36,
  gameWidth: 400,
  obstacleWidth: 22,
  obstacleMinHeight: 20,
  obstacleMaxHeight: 60,
  margin: 3,
  initialSpeed: 130,     // px/s
  speedIncrement: 0.04,  // px/s per tick (60틱 기준 2.4 px/s/s)
  obstacleInterval: 90,  // 초기 틱 간격
};

class ExampleGame extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this._cfg = { ...GAME_CONFIG, ...config };
  }

  reset() {
    const cfg = this._cfg;
    this.score = 0;
    this.alive = true;
    this._time = 0;
    this.tick = 0;
    this.speed = cfg.initialSpeed;  // px/s
    this.playerY = 0;               // 0=땅, 음수=공중
    this.playerVY = 0;
    this.isOnGround = true;
    this.obstacles = [];
    this.nextObstacle = cfg.obstacleInterval;
    this._obstacleIdCounter = 0;
  }

  update(input) {
    if (!this.alive) return;

    const cfg = this._cfg;
    this.tick++;
    this._time = this.tick / 60;

    // 속도 증가 (시간이 지날수록 점점 빨라짐)
    this.speed = cfg.initialSpeed + this.tick * cfg.speedIncrement;

    // 점프 입력
    if (input === 'action' && this.isOnGround) {
      this.playerVY = cfg.jumpForce;
      this.isOnGround = false;
    }

    // 중력/물리
    if (!this.isOnGround) {
      this.playerVY += cfg.gravity;
      this.playerY += this.playerVY;
      if (this.playerY >= 0) {
        this.playerY = 0;
        this.playerVY = 0;
        this.isOnGround = true;
      }
    }

    // 장애물 스폰 (속도가 빨라질수록 더 자주)
    if (this.tick >= this.nextObstacle) {
      const h = cfg.obstacleMinHeight +
        Math.floor(Math.random() * (cfg.obstacleMaxHeight - cfg.obstacleMinHeight));
      this.obstacles.push({
        id: ++this._obstacleIdCounter,
        x: cfg.gameWidth,
        width: cfg.obstacleWidth,
        height: h,
        passed: false,
      });
      this.nextObstacle = this.tick + Math.max(25, cfg.obstacleInterval - Math.floor(this.tick / 60));
    }

    // 장애물 이동 + passed 처리
    const speedPerTick = this.speed / 60;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= speedPerTick;
      if (!obs.passed && obs.x + obs.width < cfg.playerX) {
        obs.passed = true;
        this.score += 10;
      }
      if (obs.x + obs.width < 0) {
        this.obstacles.splice(i, 1);
      }
    }

    // AABB 충돌 검사
    const m = cfg.margin;
    const pLeft = cfg.playerX + m;
    const pRight = cfg.playerX + cfg.playerWidth - m;
    const pBottom = this.playerY;         // 0=땅
    const pTop = this.playerY - cfg.playerHeight;

    for (const obs of this.obstacles) {
      const oLeft = obs.x + m;
      const oRight = obs.x + obs.width - m;
      const oTop = -obs.height;           // 장애물 위쪽 (0이 바닥)
      if (pRight > oLeft && pLeft < oRight && pBottom > oTop && pTop < 0) {
        this.alive = false;
        break;
      }
    }

    // 거리 점수
    if (this.alive && this.tick % 5 === 0) this.score += 1;
  }

  getScore() { return this.score; }
  isAlive() { return this.alive; }
  getDifficulty() { return Math.min(this.speed / 400, 1); }
  getName() { return 'ExampleGame'; }
}

module.exports = ExampleGame;
