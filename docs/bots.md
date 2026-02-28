# Bot Guide

> radar_fun_meter에서 봇을 사용하고 직접 작성하는 방법

---

## 봇 인터페이스

봇은 아래 인터페이스를 구현하는 객체 또는 클래스이다.

```ts
interface Bot {
  decide(game: GameAdapter): string | null;
  reset?(): void;   // 선택사항
}
```

| 메서드 | 필수 여부 | 설명 |
|--------|-----------|------|
| `decide(game)` | 필수 | 매 틱마다 호출. `'action'` 또는 `null` 반환 |
| `reset()` | 선택 | 매 게임 시작 전 FunMeter가 자동 호출 |

`decide()`가 `'action'`을 반환하면 게임의 `update('action')`이 호출된다. `null`이면 `update(null)`.

---

## RandomBot

가장 단순한 봇. 매 틱마다 설정된 확률로 무작위 액션을 실행한다.

```js
const { RandomBot } = require('radar-fun-meter');
const bot = new RandomBot({ jumpProb: 0.05 });
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `jumpProb` | `number` | `0.05` | 매 틱당 'action' 확률 (0~1) |

**언제 사용:**
- 단순한 게임에서 빠른 기준선 측정
- 내부 봇이 있는 게임 (`stack-tower`: jumpProb=0)
- 확률 기반 게임 (`heartbeat`)

```js
// 예시: timing-jump에서 RandomBot (낮은 정확도)
const bot = new RandomBot({ jumpProb: 0.03 });  // 3% 확률로 점프
```

---

## HumanLikeBot

게임 내부 상태를 직접 읽어 실제 인간처럼 반응하는 봇. 반응 지연과 실수율을 시뮬레이션한다.

```js
const { HumanLikeBot } = require('radar-fun-meter');
const bot = new HumanLikeBot({
  accuracy: 0.9,
  reactionMin: 100,
  reactionMax: 300,
});
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `accuracy` | `number` | `0.9` | 반응 성공률 (0~1) |
| `reactionMin` | `number` | `100` | 최소 반응 지연 (ms) |
| `reactionMax` | `number` | `300` | 최대 반응 지연 (ms) |
| `ticksPerSecond` | `number` | `60` | 게임 틱레이트 |

**지원 게임:**
- `timing-jump`: `game.obstacles` 배열 감지 → 장애물 접근 시 점프
- `stack-tower`: `game.currentBlock` + `game.stackedBlocks` 감지 → 중앙 정렬 시 드롭
- `rhythm-tap`: `game.notes` 배열 감지 → 타겟 존 접근 시 탭

**언제 사용:**
- 정확한 인간 플레이어 시뮬레이션이 필요할 때
- timing-jump, rhythm-tap의 기본 봇

```js
// 예시: 낮은 정확도로 초보자 시뮬레이션
const bot = new HumanLikeBot({ accuracy: 0.6, reactionMin: 200, reactionMax: 500 });
```

---

## SmartBot

공개 API(`getDifficulty()`, `getScore()`)만 사용하는 범용 적응형 봇. 게임 장르 힌트를 받아 전략을 조정한다.

```js
const { SmartBot } = require('radar-fun-meter');
const bot = new SmartBot({ hint: 'platformer', scoreWindow: 60 });
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `hint` | `'platformer' \| 'rhythm' \| 'tower' \| 'auto'` | `'auto'` | 장르 힌트. `'auto'`는 첫 틱에 자동 감지 |
| `scoreWindow` | `number` | `60` | 점수 트렌드 추적 윈도우 틱 수 |

**장르별 전략:**

| 장르 | 전략 | 사용 게임 |
|------|------|-----------|
| `platformer` | 난이도 기반 확률 점프, 쿨다운 | timing-jump |
| `rhythm` | 일정 간격 탭 (난이도에 따라 간격 조정) | rhythm-tap |
| `tower` | 낮은 확률 드롭 (정밀도 중시) | stack-tower |
| `auto` | 첫 호출 시 내부 필드 감지 후 위 중 하나 선택 | 범용 |

**HumanLikeBot과의 차이:**

| 항목 | HumanLikeBot | SmartBot |
|------|-------------|---------|
| 게임 상태 접근 | 내부 필드 직접 읽음 | 공개 API만 사용 |
| 장르 지원 | 3개 게임 하드코딩 | hint로 분기, 범용 |
| 전략 | 반응 지연 시뮬레이션 | 난이도+점수 트렌드 기반 |

```js
// 예시 1: timing-jump에서 SmartBot
const bot = new SmartBot({ hint: 'platformer' });

// 예시 2: 자동 감지
const bot = new SmartBot();  // hint 없으면 'auto'

// 예시 3: FunMeter와 함께
const { FunMeter, SmartBot } = require('radar-fun-meter');
const TimingJumpAdapter = require('radar-fun-meter/games/timing-jump/TimingJumpAdapter');

const meter = new FunMeter({ maxSeconds: 30 });
const game = new TimingJumpAdapter({ initialSpeed: 120 });
const bot = new SmartBot({ hint: 'platformer' });
const result = meter.run(game, bot, 100);
meter.print(result);
```

---

## 커스텀 봇 작성

### 최소 봇 구현 (10줄)

```js
class MyBot {
  decide(game) {
    const d = game.getDifficulty();
    // 난이도가 높을수록 더 자주 액션
    const prob = 0.03 + d * 0.07;
    return Math.random() < prob ? 'action' : null;
  }
}

module.exports = MyBot;
```

### reset() 구현이 필요한 경우

봇 내부에 상태(카운터, 이전 결정 등)가 있으면 `reset()`을 구현해야 한다. FunMeter가 각 run 시작 전에 자동으로 호출한다.

```js
class CounterBot {
  constructor() {
    this.reset();
  }

  reset() {
    this._tick = 0;
    this._lastAction = -100;
  }

  decide(game) {
    this._tick++;
    // 마지막 액션 이후 30틱 이상 지났을 때만 액션
    if (this._tick - this._lastAction >= 30) {
      if (Math.random() < 0.3) {
        this._lastAction = this._tick;
        return 'action';
      }
    }
    return null;
  }
}
```

### getDifficulty() 활용 전략

`game.getDifficulty()`는 현재 게임 난이도를 0~1로 반환한다. 이를 활용해 봇 전략을 동적으로 조정할 수 있다.

```js
class AdaptiveBot {
  decide(game) {
    const d = game.getDifficulty();

    // 쉬운 구간 (d < 0.3): 공격적으로 시도
    if (d < 0.3) return Math.random() < 0.2 ? 'action' : null;

    // 보통 구간 (d < 0.6): 표준 플레이
    if (d < 0.6) return Math.random() < 0.1 ? 'action' : null;

    // 어려운 구간 (d >= 0.6): 신중하게
    return Math.random() < 0.05 ? 'action' : null;
  }
}
```

### getScore() 트렌드 활용

점수 변화율을 추적해 막힌 상황을 감지하고 전략을 바꿀 수 있다.

```js
class TrendBot {
  constructor() {
    this.reset();
  }

  reset() {
    this._scoreHistory = [];
  }

  decide(game) {
    const score = game.getScore();
    this._scoreHistory.push(score);
    if (this._scoreHistory.length > 60) this._scoreHistory.shift();

    const trend = this._getTrend();
    const d = game.getDifficulty();

    // 점수 정체 시 더 적극적으로
    let prob = 0.05;
    if (trend < 0) prob += 0.05;
    if (d > 0.7) prob -= 0.02;

    return Math.random() < Math.max(0.01, prob) ? 'action' : null;
  }

  _getTrend() {
    const h = this._scoreHistory;
    if (h.length < 20) return 0;
    const half = Math.floor(h.length / 2);
    const oldAvg = h.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const newAvg = h.slice(half).reduce((a, b) => a + b, 0) / (h.length - half);
    return newAvg - oldAvg;
  }
}
```

---

## CLI에서 봇 선택

```bash
funmeter --game=timing-jump --bot=random    # RandomBot (기본)
funmeter --game=timing-jump --bot=human     # HumanLikeBot
funmeter --game=timing-jump --bot=smart     # SmartBot

# 봇 파라미터
funmeter --game=timing-jump --bot=random --bot.jumpProb=0.1
funmeter --game=timing-jump --bot=human --bot.accuracy=0.7
```

---

## 봇 선택 가이드

| 상황 | 추천 봇 |
|------|---------|
| 빠른 기준선 측정 | `RandomBot` |
| 실제 인간 플레이 시뮬레이션 (timing-jump, rhythm-tap) | `HumanLikeBot` |
| 내부 봇이 있는 게임 (stack-tower) | `RandomBot({ jumpProb: 0 })` |
| 새로운/커스텀 게임, 범용 테스트 | `SmartBot` |
| 최고 성능이 필요할 때 | 게임 전용 커스텀 봇 작성 |
