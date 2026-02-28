# Contributing to radar_fun_meter

## 새 게임 어댑터 만들기

### 1. 폴더 구조 생성

```
games/
└── my-game/
    └── MyGameAdapter.js
```

### 2. GameAdapter 상속 구현

최소 구현 (필수 메서드):

```js
const GameAdapter = require('../../src/GameAdapter');

class MyGameAdapter extends GameAdapter {
  constructor(config = {}) {
    super(config);
    // 난이도 조절 파라미터를 config에서 받음
    this.difficulty = config.difficulty ?? 1.0;
  }

  reset() {
    // 매 run마다 호출. 게임 상태를 완전히 초기화해야 함.
    this.score = 0;
    this.alive = true;
    this._time = 0;
    this.tick = 0;
  }

  update(input) {
    // 한 프레임(틱) 진행. input은 봇이 결정한 문자열 ('action', null 등)
    if (!this.alive) return;
    this.tick++;
    this._time = this.tick / 60;
    // 게임 로직...
    if (input === 'action') { /* 처리 */ }
  }

  getScore()      { return this.score; }
  isAlive()       { return this.alive; }
  getDifficulty() { return Math.min(this.difficulty, 1); } // 0~1 범위
  getName()       { return 'MyGame'; }
}

module.exports = MyGameAdapter;
```

### 3. 선택 구현: 레벨 기반 게임

레벨이 핵심 지표인 게임 (ex: 스택 쌓기, 퍼즐)은 `getLevel()` 구현:

```js
getLevel() { return this.level; } // 숫자 반환 (null이면 FunMeter가 무시)
```

레벨 기반으로 FLOW 판정하려면 CLI에서 자동 적용되게 하거나,
`DEFAULT_PARAMS`에 `flowOptions` 추가 (아래 4번 참고).

### 4. CLI 레지스트리 등록 (src/cli.js)

```js
const GAMES = {
  // ...기존 게임들...
  'my-game': () => require('../games/my-game/MyGameAdapter'),
};
```

### 5. Optimizer 파라미터 등록 (선택, src/Optimizer.js)

최적화를 지원하려면 `DEFAULT_PARAMS`에 추가:

```js
const DEFAULT_PARAMS = {
  // ...
  'my-game': {
    name: 'difficulty',       // 조정할 config 파라미터 이름
    min: 0.5,                 // 탐색 최솟값
    max: 5.0,                 // 탐색 최댓값
    hardDirection: 'higher',  // 'higher' = 값이 클수록 어려움, 'lower' = 값이 작을수록 어려움

    // 레벨 기반 게임인 경우:
    // flowOptions: { levelMode: true, levelFlowMinMedian: 5, levelFlowMaxMedian: 20 },

    // 내부 봇이 있어서 외부 봇 입력 불필요한 경우:
    // defaultBotOptions: { jumpProb: 0 },
  },
};
```

### 6. 실행 테스트

```bash
# 기본 테스트 (RandomBot)
node src/cli.js --game=my-game --runs=100

# 파라미터 조절 테스트
node src/cli.js --game=my-game --runs=100 --config.difficulty=2.0

# 자동 최적화
node src/cli.js --game=my-game --optimize --opt.runs=50 --opt.iter=15
```

---

## HumanLikeBot 호환성 추가

HumanLikeBot은 게임 상태를 읽어서 위협을 감지합니다. 게임 타입에 따라
아래 필드를 노출하면 자동으로 감지 로직이 작동합니다.

### 타이밍 점프 스타일 (장애물 피하기)

```js
// 필수 필드
this.isOnGround = true;          // 점프 가능 여부
this.speed = 130;                // px/s 단위 속도
this.obstacles = [{
  id: 1,                         // 고유 ID (중복 감지용)
  x: 400,                        // 장애물 왼쪽 x 좌표
  width: 22,                     // 장애물 너비
  passed: false,                 // 지나쳤으면 true
}];

// _cfg로 플레이어 크기/위치 정보 노출
this._cfg = {
  playerX: 80,
  playerWidth: 28,
  margin: 3,
};
```

### 스택 타워 스타일 (블록 쌓기)

```js
this.currentBlock = { x: 0, width: 150 };   // 현재 움직이는 블록
this.stackedBlocks = [{ x: 75, width: 150 }]; // 쌓인 블록 배열
this.speed = 3;                               // px/tick 단위
```

### 리듬 탭 스타일 (노트 타이밍)

```js
this.notes = [{
  id: 1,
  y: 100,      // 노트 y 좌표
  hit: false,  // 이미 처리됐으면 true
}];
this.speed = 3;       // px/tick
this._cfg = {
  targetY: 320,       // 판정 라인 y 좌표
  goodRange: 50,      // 판정 범위 px
};
```

---

## 완성 예제: FlappyBird 어댑터

```js
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
    this.isOnGround = false; // 항상 공중
    this.pipes = [];
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
      this.pipes.push({
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
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const p = this.pipes[i];
      p.x -= spd;
      if (!p.passed && p.x + p.width < cfg.playerX) { p.passed = true; this.score++; }
      if (p.x + p.width < 0) { this.pipes.splice(i, 1); continue; }

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
```

HumanLikeBot이 이 게임에서 파이프를 감지하려면 `this.pipes`를
`game.obstacles`로도 노출하거나, `_detectThreat` 오버라이드 방식 대신
직접 pipes 필드를 `obstacles`로 매핑하면 됩니다:

```js
// update() 마지막에 추가 (HumanLikeBot 호환 alias)
get obstacles() { return this.pipes; }
```

---

## PR 체크리스트

- [ ] `reset()` 호출 후 완전히 초기화되는가?
- [ ] `isAlive()` → false 전환이 명확한가?
- [ ] `getScore()` 단조 증가 or 의미 있는 값인가?
- [ ] `node src/cli.js --game=<name> --runs=50` 로 오류 없이 실행되는가?
- [ ] FLOW 판정이 의미 있는 결과를 내는가? (너무 쉽거나 어렵지 않은 기본값)
