/**
 * ExampleGame - 예제 게임 (타이밍 점프 스타일)
 * 새 게임 Adapter 구현 방법을 보여주는 예시
 */
const GameAdapter = require('../../src/GameAdapter');

class ExampleGame extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this.initialSpeed = config.initialSpeed || 5;
    this.speedIncrement = config.speedIncrement || 0.002;
    this.reset();
  }

  reset() {
    this.tick = 0;
    this.score = 0;
    this.alive = true;
    this.speed = this.initialSpeed;
    this.obstacleTimer = 0;
    this.obstacleInterval = 120; // 2초마다 장애물
    this.playerY = 0; // 0 = 땅
    this.jumping = false;
    this.jumpVelocity = 0;
  }

  update(input) {
    if (!this.alive) return;

    this.tick++;
    this.speed += this.speedIncrement;
    this.score += Math.floor(this.speed);

    // 점프 처리
    if (input === 'jump' && this.playerY === 0) {
      this.jumping = true;
      this.jumpVelocity = 15;
    }

    if (this.jumping) {
      this.playerY += this.jumpVelocity;
      this.jumpVelocity -= 1.5; // 중력
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.jumping = false;
        this.jumpVelocity = 0;
      }
    }

    // 장애물 생성 & 충돌
    this.obstacleTimer++;
    const dynamicInterval = Math.max(30, this.obstacleInterval - this.speed * 5);
    if (this.obstacleTimer >= dynamicInterval) {
      this.obstacleTimer = 0;
      // 장애물 충돌: 땅에 있으면 죽음
      if (this.playerY < 10) {
        this.alive = false;
      }
    }
  }

  getScore() { return this.score; }
  isAlive() { return this.alive; }
  getDifficulty() {
    return Math.min(1.0, (this.speed - this.initialSpeed) / 20);
  }
  getName() { return 'ExampleGame'; }
}

module.exports = ExampleGame;
