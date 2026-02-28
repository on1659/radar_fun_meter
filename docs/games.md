# Game Adapters

> 내장 게임 어댑터 가이드 및 커스텀 게임 작성법

---

## 내장 게임 목록

| 게임 | 경로 | 핵심 파라미터 | 범위 | 기본 봇 | FLOW 범위 |
|------|------|-------------|------|--------|-----------|
| `timing-jump` | `games/timing-jump/` | `initialSpeed` | 80~400 | HumanLikeBot | ~120 |
| `stack-tower` | `games/stack-tower/` | `botError` | 2~40 | RandomBot (jumpProb=0) | ~21 |
| `rhythm-tap` | `games/rhythm-tap/` | `botAccuracy` | 0.05~0.9 | HumanLikeBot | ~0.6 |
| `flappy-bird` | `games/flappy-bird/` | `pipeSpeed` | 80~300 | FlappyBirdBot | ~160 |
| `heartbeat` | `examples/heartbeat/` | `drainRate` | 0.1~3.0 | RandomBot | ~0.4 |

---

## 게임별 설명

### timing-jump

장애물이 좌→우 방향으로 달려오는 달리기 게임. 장애물에 부딪히기 전에 'action'(점프)으로 넘어야 한다.

- **`initialSpeed`**: 장애물 이동 속도 (px/s). 높을수록 어려움.
- **`speedIncrement`**: 생존할수록 속도가 증가하는 비율 (기본 0.05)
- 봇: `HumanLikeBot` (장애물 감지 후 반응 지연 시뮬레이션)

```bash
# CLI
funmeter --game=timing-jump --runs=100 --bot=human
funmeter --game=timing-jump --config.initialSpeed=150 --runs=50
funmeter --game=timing-jump --optimize
```

```js
// 코드
const TimingJumpAdapter = require('radar-fun-meter/games/timing-jump/TimingJumpAdapter');
const game = new TimingJumpAdapter({ initialSpeed: 120 });
```

---

### stack-tower

블록을 위에서 아래로 쌓는 탑 쌓기 게임. 내부 자동 드롭 봇이 있어 외부 봇은 RandomBot(jumpProb=0)을 사용한다.

- **`botError`**: 내부 봇의 오차 범위 (픽셀). 높을수록 어려움.
- 레벨 모드 자동 활성화 (`getLevel()` 구현됨)
- 외부 봇: `RandomBot({ jumpProb: 0 })` (내부 봇이 모든 결정을 함)

```bash
# CLI
funmeter --game=stack-tower --runs=100
funmeter --game=stack-tower --config.botError=25 --runs=50
funmeter --game=stack-tower --optimize
```

```js
const StackTowerAdapter = require('radar-fun-meter/games/stack-tower/StackTowerAdapter');
const game = new StackTowerAdapter({ botError: 20 });
```

---

### rhythm-tap

노트가 위에서 아래로 내려오면 타겟 존에 맞춰 'action'(탭)해야 하는 리듬 게임.

- **`botAccuracy`**: 내부 봇 정확도 (0~1). 낮을수록 어려움.
- 봇: `HumanLikeBot` (노트 감지 후 반응)

```bash
funmeter --game=rhythm-tap --runs=100 --bot=human
funmeter --game=rhythm-tap --config.botAccuracy=0.7 --runs=50
```

```js
const RhythmTapAdapter = require('radar-fun-meter/games/rhythm-tap/RhythmTapAdapter');
const game = new RhythmTapAdapter({ botAccuracy: 0.7 });
```

---

### flappy-bird

파이프 사이를 통과하는 Flappy Bird 스타일 게임. 'action'(날개짓)으로 위로 떠오른다.

- **`pipeSpeed`**: 파이프 이동 속도 (px/s). 높을수록 어려움.
- 봇: `FlappyBirdBot` (전용 봇, 파이프 간격 예측)

```bash
funmeter --game=flappy-bird --runs=100
funmeter --game=flappy-bird --config.pipeSpeed=180 --runs=50
funmeter --game=flappy-bird --optimize
```

```js
const FlappyBirdAdapter = require('radar-fun-meter/games/flappy-bird/FlappyBirdAdapter');
const game = new FlappyBirdAdapter({ pipeSpeed: 160 });
```

---

### heartbeat (튜토리얼 예제)

생명력 바가 점점 빠르게 감소하는 게임. 'action'(탭)으로 생명력을 회복한다. 새 게임 어댑터 작성 튜토리얼 예제.

- **`drainRate`**: 초기 생명력 소모 속도. 높을수록 어려움.
- 봇: `RandomBot({ jumpProb: 0.05 })`

```bash
funmeter --game=heartbeat --runs=100
funmeter --game=heartbeat --config.drainRate=0.5 --runs=50
funmeter --game=heartbeat --optimize
```

```js
const HeartBeatAdapter = require('radar-fun-meter/examples/heartbeat/HeartBeatAdapter');
const game = new HeartBeatAdapter({ drainRate: 0.4 });
```

---

## 커스텀 게임 어댑터 작성

### 1단계: GameAdapter 상속

```js
const { GameAdapter } = require('radar-fun-meter');

class MyGame extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this._cfg = { speed: 100, ...config };
    this.reset();
  }
  // ...
}

module.exports = MyGame;
```

### 2단계: 필수 메서드 6개 구현

| 메서드 | 반환값 | 설명 |
|--------|--------|------|
| `reset()` | `void` | 매 플레이 시작 시 상태 초기화 |
| `update(input)` | `void` | 한 틱(프레임) 진행. `input`은 `'action'` 또는 `null` |
| `getScore()` | `number` | 현재 점수 |
| `isAlive()` | `boolean` | 게임 오버 여부 |
| `getDifficulty()` | `number` | 현재 난이도 (0.0~1.0) |
| `getName()` | `string` | 게임 이름 |

### 3단계: (선택) getLevel() 구현

`getLevel()`을 구현하면 FunMeter가 레벨 모드로 자동 전환.

```js
getLevel() {
  return Math.floor(this._score / 100); // 100점마다 레벨 1 증가
}
```

---

## 최소 구현 템플릿

아래 코드를 복사해 새 게임을 빠르게 시작하세요.

```js
const { GameAdapter } = require('radar-fun-meter');

const DEFAULTS = {
  difficulty: 0.5,   // ★ 조정할 핵심 파라미터
};

class MyGameAdapter extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this._cfg = { ...DEFAULTS, ...config };
    this.reset();
  }

  reset() {
    this._score = 0;
    this._alive = true;
    this._tick = 0;
  }

  update(input) {
    if (!this._alive) return;
    this._tick++;

    // 게임 로직
    if (input === 'action') {
      this._score += 10;
    }

    // 사망 조건 (예: 300틱 생존)
    const survivalChance = 1 - this._cfg.difficulty * 0.01;
    if (Math.random() > survivalChance) {
      this._alive = false;
    }
  }

  getScore()      { return this._score; }
  isAlive()       { return this._alive; }
  getDifficulty() { return this._cfg.difficulty; }
  getName()       { return 'MyGame'; }
}

module.exports = MyGameAdapter;
```

### Optimizer 연동

커스텀 게임을 Optimizer와 연동하려면 파라미터 정보를 직접 전달한다.

```js
const { Optimizer, RandomBot } = require('radar-fun-meter');
const MyGameAdapter = require('./MyGameAdapter');

const optimizer = new Optimizer({ runs: 50, verbose: true });
const { config, found } = optimizer.optimize(
  MyGameAdapter,
  RandomBot,
  { jumpProb: 0.05 },
  {
    name: 'difficulty',
    min: 0.1,
    max: 0.9,
    hardDirection: 'higher',   // difficulty가 높을수록 어려움
  }
);

console.log(found ? `최적 난이도: ${config.difficulty}` : 'FLOW Zone을 찾지 못했습니다.');
```

---

## HeartBeatAdapter 전체 코드 해설

> `examples/heartbeat/HeartBeatAdapter.js`를 기반으로 한 실제 구현 예시

```js
const { GameAdapter } = require('radar-fun-meter');

const DEFAULTS = {
  maxHearts: 100,
  startHearts: 80,
  tapHeal: 8,
  drainRate: 0.35,       // ★ Optimizer가 조정하는 핵심 파라미터
  drainIncrement: 0.0004, // 틱마다 증가 → 시간이 지날수록 점점 어려워짐
};

class HeartBeatAdapter extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this._cfg = { ...DEFAULTS, ...config };
    // ⚠️ reset()은 constructor 끝에서 호출하지 않아도 됨
    // FunMeter가 run() 시작 전에 reset()을 자동 호출함
  }

  reset() {
    // 매 run마다 완전히 초기화해야 함
    this.score = 0;
    this.alive = true;
    this.tick = 0;
    this._time = 0;
    this.hearts = this._cfg.startHearts;
    this._drain = this._cfg.drainRate;
  }

  update(input) {
    if (!this.alive) return;
    const cfg = this._cfg;
    this.tick++;
    this._time = this.tick / 60;

    // 'action' = 탭하여 생명력 회복
    if (input === 'action') {
      this.hearts = Math.min(cfg.maxHearts, this.hearts + cfg.tapHeal);
      this.score += 5;
    }

    // 소모 속도 증가 (점점 어려워짐)
    this._drain += cfg.drainIncrement;
    this.hearts -= this._drain;

    if (this.hearts <= 0) {
      this.hearts = 0;
      this.alive = false;
    }

    if (this.tick % 10 === 0) this.score += 1;
  }

  getScore()      { return this.score; }
  isAlive()       { return this.alive; }
  getDifficulty() { return Math.min(this._drain / (this._cfg.drainRate * 5), 1); }
  getName()       { return 'HeartBeat'; }
}

module.exports = HeartBeatAdapter;
```

**핵심 포인트:**
1. `DEFAULTS`에 모든 파라미터 기본값 정의
2. `config`로 외부에서 파라미터 오버라이드 가능
3. `reset()`에서 모든 상태 변수를 초기화 (이전 run 흔적 제거)
4. `update(input)`에서 한 틱의 로직만 처리
5. `getDifficulty()`는 0~1 정규화 필수
