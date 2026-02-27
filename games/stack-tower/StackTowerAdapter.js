/**
 * 스택 타워 어댑터
 * 봇은 블록이 최대한 겹칠 때 drop
 */
const GameAdapter = require('../../src/GameAdapter');

const GAME_CONFIG = {
  gameWidth: 300,
  gameHeight: 500,
  towerX: 75,
  baseBlockWidth: 150,
  blockHeight: 20,
  minBlockWidth: 20,
  initialSpeed: 3,
  speedIncrement: 0.15,
};

class StackTowerAdapter extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this._cfg = { ...GAME_CONFIG, ...config };
    // 봇 오차 (px): 0이면 완벽, 클수록 부정확
    this.botError = config.botError ?? 15;
  }

  reset() {
    const cfg = this._cfg;
    this.status = 'running'; // 시뮬레이션이므로 바로 running
    this.score = 0;
    this.level = 0;
    this.alive = true;
    this._time = 0;
    this.frameTick = 0;

    this.stackedBlocks = [{
      x: cfg.towerX - cfg.baseBlockWidth / 2,
      y: cfg.gameHeight - cfg.blockHeight,
      width: cfg.baseBlockWidth,
    }];

    this.currentBlock = this._createMovingBlock();
    this.direction = 1;
    this.speed = cfg.initialSpeed;
  }

  _createMovingBlock() {
    const cfg = this._cfg;
    const prev = this.stackedBlocks[this.stackedBlocks.length - 1];
    return { x: 0, y: prev.y - cfg.blockHeight, width: prev.width };
  }

  update(input) {
    if (!this.alive) return;

    const cfg = this._cfg;
    this.frameTick++;
    this._time = this.frameTick / 60;

    const curr = this.currentBlock;
    curr.x += this.speed * this.direction;

    // 벽 반사
    if (curr.x < -curr.width / 2) { curr.x = -curr.width / 2; this.direction = 1; }
    else if (curr.x + curr.width > cfg.gameWidth + curr.width / 2) {
      curr.x = cfg.gameWidth + curr.width / 2 - curr.width; this.direction = -1;
    }

    // drop 입력
    if (input === 'action') {
      this._drop();
    }

    // 봇 자동 drop: 블록이 타워 위를 지나는 최적 위치에서 drop
    // 이전 블록 범위 내에 현재 블록 중심이 있을 때 오차 포함해서 drop
    const prev = this.stackedBlocks[this.stackedBlocks.length - 1];
    const prevCenter = prev.x + prev.width / 2;
    const currCenter = curr.x + curr.width / 2;
    const distFromCenter = Math.abs(currCenter - prevCenter);

    // 완벽한 중앙 근처에서만 drop (botError px 오차)
    // direction 변화 시에만 판단 (진동 방지)
    const newDir = curr.x + this.speed * this.direction;
    if (distFromCenter <= this.botError) {
      this._dropped = this._dropped || false;
      if (!this._dropped) {
        this._dropped = true;
        this._drop();
      }
    } else {
      this._dropped = false;
    }
  }

  _drop() {
    if (!this.alive) return;

    const cfg = this._cfg;
    const prev = this.stackedBlocks[this.stackedBlocks.length - 1];
    const curr = this.currentBlock;

    const overlapLeft = Math.max(prev.x, curr.x);
    const overlapRight = Math.min(prev.x + prev.width, curr.x + curr.width);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      this.alive = false;
      return;
    }

    const isPerfect = Math.abs(overlapWidth - prev.width) < 3 && Math.abs(overlapWidth - curr.width) < 3;
    this.stackedBlocks.push({ x: overlapLeft, y: curr.y, width: overlapWidth });
    this.score += isPerfect ? 200 : Math.round(overlapWidth * 2);
    this.level++;

    // 속도 증가
    this.speed = cfg.initialSpeed + this.level * cfg.speedIncrement;

    // 다음 블록
    this.currentBlock = this._createMovingBlock();
    this.direction = 1;

    // 카메라 스크롤
    const top = this.stackedBlocks[this.stackedBlocks.length - 1];
    if (top.y < 150) {
      const shift = 150 - top.y;
      this.stackedBlocks.forEach(b => b.y += shift);
      this.currentBlock.y += shift;
    }

    // 최소 블록 너비 체크
    if (overlapWidth < cfg.minBlockWidth) {
      this.alive = false;
    }
  }

  getScore() { return this.score; }
  isAlive() { return this.alive; }
  getDifficulty() { return Math.min(this.speed / 20, 1); }
  getName() { return 'StackTower'; }
}

module.exports = StackTowerAdapter;
