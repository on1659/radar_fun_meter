/**
 * ExampleGame - 타이밍 점프 스타일 예제
 * 장애물이 다가오면 점프해서 피함
 */
const GameAdapter = require('../../src/GameAdapter');

class ExampleGame extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this.initialSpeed = config.initialSpeed ?? 22;
    this.speedIncrement = config.speedIncrement ?? 0.01;
    this.obstacleInterval = config.obstacleInterval ?? 90; // 틱
    this.jumpDuration = config.jumpDuration ?? 20; // 틱
  }

  reset() {
    this.score = 0;
    this.alive = true;
    this._time = 0;
    this.speed = this.initialSpeed;
    this.playerY = 0; // 0=땅, 양수=공중
    this.jumpTicks = 0;
    this.obstacles = [];
    this.tick = 0;
    this.nextObstacle = this.obstacleInterval;
  }

  update(input) {
    if (!this.alive) return;

    this.tick++;
    this._time = this.tick / 60;

    // 점프 입력
    if (input === 'action' && this.playerY === 0 && this.jumpTicks === 0) {
      this.jumpTicks = this.jumpDuration;
    }

    // 점프 처리
    if (this.jumpTicks > 0) {
      this.playerY = 1;
      this.jumpTicks--;
    } else {
      this.playerY = 0;
    }

    // 장애물 생성
    if (this.tick >= this.nextObstacle) {
      this.obstacles.push({ x: 100 });
      this.nextObstacle = this.tick + this.obstacleInterval - Math.floor(this.speed);
    }

    // 장애물 이동 + 충돌 체크
    this.obstacles = this.obstacles.filter(obs => {
      obs.x -= this.speed / 10;
      if (obs.x <= 5 && obs.x >= 0 && this.playerY === 0) {
        this.alive = false;
        return false;
      }
      return obs.x > 0;
    });

    // 난이도 증가
    this.speed += this.speedIncrement;
    this.score += Math.floor(this.speed);
  }

  getScore() { return this.score; }
  isAlive() { return this.alive; }
  getDifficulty() { return Math.min(this.speed / 100, 1); }
  getName() { return 'ExampleGame'; }
}

module.exports = ExampleGame;
