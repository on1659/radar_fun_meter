# API Reference

> radar_fun_meter — Flow Theory 기반 게임 재미 측정 도구

---

## FunMeter

게임을 N번 자동으로 플레이해 생존 시간 분포를 분석하고, Flow Zone(FLOW / TOO_HARD / TOO_EASY)을 판정하는 핵심 클래스.

### constructor(options)

```js
const { FunMeter } = require('radar_fun_meter');
const meter = new FunMeter(options);
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `ticksPerSecond` | `number` | `60` | 게임 업데이트 주파수 (fps) |
| `maxSeconds` | `number` | `60` | 최대 생존 시간 (이 이상은 타임아웃 처리) |
| `flowMinMedian` | `number` | `5` | FLOW 판정 최소 중앙값 (초) |
| `flowMaxTimeout` | `number` | `0.5` | FLOW 허용 최대 타임아웃 비율 (0~1) |
| `levelMode` | `boolean` | `false` | 레벨 모드 활성화 (getLevel() 지원 게임) |
| `levelFlowMinMedian` | `number` | `3` | 레벨 모드 FLOW 최소 중앙값 (레벨 수) |
| `levelFlowMaxMedian` | `number` | `10` | 레벨 모드 FLOW 최대 중앙값 (레벨 수) |
| `genre` | `string` | — | 장르 프리셋 (`'action'`, `'rhythm'`, `'puzzle'`, `'survival'`) |
| `flowCriteria` | `object` | — | 커스텀 Flow 기준 (`{ minMedian, maxTimeoutRate }`) |

```js
// 예시 1: 기본 설정으로 생성
const meter = new FunMeter();

// 예시 2: 빠른 테스트용 (최대 10초, 50회 플레이)
const meter = new FunMeter({ maxSeconds: 10, flowMinMedian: 3 });
```

---

### run(game, bot, runs, options) → RunResult

게임을 `runs`번 플레이하고 통계를 반환한다.

```js
const result = meter.run(game, bot, runs, options);
```

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `game` | `GameAdapter` | 필수 | 게임 인스턴스 |
| `bot` | `Bot` | 필수 | 봇 인스턴스 |
| `runs` | `number` | `100` | 플레이 횟수 |
| `options.verbose` | `boolean` | `true` | 진행률 바 출력 (20회 이상 자동 활성화) |

#### RunResult 반환 객체

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | `string` | 게임 이름 |
| `runs` | `number` | 총 플레이 횟수 |
| `times` | `number[]` | 각 플레이의 생존 시간 배열 (초) |
| `scores` | `number[]` | 각 플레이의 최종 점수 배열 |
| `levels` | `number[]` | 각 플레이의 최종 레벨 배열 (getLevel 없으면 빈 배열) |
| `mean` | `number` | 평균 생존 시간 (초) |
| `median` | `number` | 중앙값 생존 시간 (초) |
| `min` | `number` | 최소 생존 시간 (초) |
| `max` | `number` | 최대 생존 시간 (초) |
| `stddev` | `number` | 표준편차 (초) |
| `p25` | `number` | 25th 백분위수 (초) |
| `p75` | `number` | 75th 백분위수 (초) |
| `p90` | `number` | 90th 백분위수 (초) |
| `p95` | `number` | 95th 백분위수 (초) |
| `histogram` | `HistogramBucket[]` | 생존 시간 히스토그램 |
| `timeoutRate` | `number` | 타임아웃 비율 (0~1) |
| `scoreMean` | `number` | 평균 점수 |
| `scoreMax` | `number` | 최고 점수 |
| `levelStats` | `LevelStats \| null` | 레벨 통계 (getLevel 없으면 null) |
| `levelMode` | `boolean` | 레벨 모드 활성화 여부 |
| `zone` | `'FLOW' \| 'TOO_HARD' \| 'TOO_EASY'` | Flow Zone 판정 결과 |
| `emoji` | `string` | 판정 결과 이모지 |
| `advice` | `string` | 난이도 조정 조언 |
| `deathPattern` | `DeathPattern` | 사망 패턴 분석 결과 |
| `suggestions` | `string[]` | 구체적 파라미터 조정 제안 |
| `scoreCurve` | `object \| null` | 점수 곡선 통계 |

```js
// 예시 1: 기본 실행
const { FunMeter, RandomBot } = require('radar_fun_meter');
const TimingJumpAdapter = require('radar_fun_meter/games/timing-jump/TimingJumpAdapter');

const meter = new FunMeter({ maxSeconds: 30 });
const game = new TimingJumpAdapter({ initialSpeed: 120 });
const bot = new RandomBot({ jumpProb: 0.05 });

const result = meter.run(game, bot, 100);
console.log(result.zone);    // 'FLOW' | 'TOO_HARD' | 'TOO_EASY'
console.log(result.median);  // 중앙값 생존 시간 (초)

// 예시 2: SmartBot으로 실행
const { SmartBot } = require('radar_fun_meter');
const bot2 = new SmartBot({ hint: 'platformer' });
const result2 = meter.run(game, bot2, 50, { verbose: false });
```

---

### print(result)

`run()`의 결과를 콘솔에 보기 좋게 출력한다.

```js
meter.print(result);
```

출력 예시:
```
════════════════════════════════════════
🎮 timing-jump — 100회 결과
════════════════════════════════════════
Zone:   🌊 FLOW
중앙값: 12.45s  평균: 11.23s  표준편차: 4.56s
...
```

---

### Flow Zone 판정 기준

#### 시간 모드 (기본)

| 조건 | 판정 |
|------|------|
| `median >= flowMinMedian` AND `timeoutRate <= flowMaxTimeout` | `FLOW` |
| `median < flowMinMedian` | `TOO_HARD` |
| `timeoutRate > flowMaxTimeout` | `TOO_EASY` |

#### 레벨 모드 (`levelMode: true`)

게임이 `getLevel()`을 구현할 때 자동 또는 명시적으로 활성화.

| 조건 | 판정 |
|------|------|
| `levelFlowMinMedian <= levelMedian <= levelFlowMaxMedian` | `FLOW` |
| `levelMedian < levelFlowMinMedian` | `TOO_HARD` |
| `levelMedian > levelFlowMaxMedian` | `TOO_EASY` |

---

### genre / flowCriteria 옵션

장르 프리셋을 사용하면 Flow Zone 기준을 자동으로 설정할 수 있습니다.

```js
const { FunMeter, GENRE_PRESETS } = require('radar_fun_meter');

const meter = new FunMeter({ genre: 'action' });
// 동일:
const meter2 = new FunMeter({ flowCriteria: GENRE_PRESETS.action });
```

| 장르 | minMedian | maxTimeoutRate | 설명 |
|------|-----------|----------------|------|
| `action` | 5s | 30% | 반사 신경 게임 — 빠른 실패 허용 |
| `rhythm` | 10s | 40% | 리듬 게임 — 중간 정밀도 |
| `puzzle` | 15s | 60% | 퍼즐 게임 — 긴 생존 허용 |
| `survival` | 8s | 20% | 생존 게임 — 시간 압박 높음 |

### deathPattern

`RunResult.deathPattern`은 생존 시간 분포의 형태를 분석합니다.

```ts
interface DeathPattern {
  skewness: number;   // 양수 = 앞쪽 집중, 음수 = 뒤쪽 집중
  kurtosis: number;   // 양수 = 뾰족한 분포, 음수 = 평평한 분포
  cluster: 'early' | 'uniform' | 'late';
}
```

- `'early'`: 초반 사망 집중 → 난이도가 높거나 초반 스파이크 존재
- `'late'`: 후반 사망 집중 → 게임이 너무 쉽거나 maxSeconds 근접
- `'uniform'`: 고르게 분포 → 밸런스 양호

---

## Optimizer

이진 탐색(binary search)으로 Flow Zone을 달성하는 게임 파라미터를 자동으로 찾는다.

### constructor(options)

```js
const { Optimizer } = require('radar_fun_meter');
const optimizer = new Optimizer(options);
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `maxIterations` | `number` | `20` | 최대 이진 탐색 횟수 |
| `runs` | `number` | `50` | 각 후보값 당 플레이 횟수 |
| `verbose` | `boolean` | `false` | 탐색 과정 출력 |
| `flowOptions` | `FunMeterOptions` | `{}` | FunMeter 생성 옵션 |

---

### optimize(GameClass, BotClass, botOptions, param) → OptimizeResult

파라미터를 이진 탐색해 Flow Zone을 달성하는 값을 찾는다.

```js
const { config, result, found } = optimizer.optimize(
  TimingJumpAdapter,
  RandomBot,
  { jumpProb: 0.05 },
  { name: 'initialSpeed', min: 80, max: 400, hardDirection: 'higher' }
);
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `GameClass` | `class` | 게임 어댑터 클래스 |
| `BotClass` | `class` | 봇 클래스 |
| `botOptions` | `object` | 봇 생성자 옵션 |
| `param.name` | `string` | 탐색할 파라미터 이름 |
| `param.min` | `number` | 탐색 최솟값 |
| `param.max` | `number` | 탐색 최댓값 |
| `param.hardDirection` | `'higher' \| 'lower'` | 높을수록 어려우면 `'higher'` |

#### OptimizeResult 반환 객체

| 필드 | 타입 | 설명 |
|------|------|------|
| `config` | `Record<string, number>` | Flow Zone을 달성한 파라미터 값 |
| `result` | `RunResult` | 해당 파라미터로 실행한 마지막 결과 |
| `found` | `boolean` | Flow Zone 달성 성공 여부 |

```js
// 예시 1: timing-jump 최적화
const optimizer = new Optimizer({ runs: 50, verbose: true });
const { config, found } = optimizer.optimize(
  TimingJumpAdapter, RandomBot, { jumpProb: 0.05 },
  { name: 'initialSpeed', min: 80, max: 400, hardDirection: 'higher' }
);

if (found) {
  console.log(`최적 속도: ${config.initialSpeed}`);
}
```

---

### optimizeByName(gameName, GameClass, BotClass, botOptions) → OptimizeResult

`DEFAULT_PARAMS`에 미리 정의된 파라미터로 최적화를 실행한다.

```js
const { config, result } = optimizer.optimizeByName(
  'timing-jump',
  TimingJumpAdapter,
  RandomBot,
  { jumpProb: 0.05 }
);
```

지원 게임 이름: `timing-jump`, `stack-tower`, `rhythm-tap`, `flappy-bird`, `heartbeat`

```js
// 예시 2: DEFAULT_PARAMS 직접 확인
const { DEFAULT_PARAMS } = require('radar_fun_meter');
console.log(DEFAULT_PARAMS['timing-jump']);
// { name: 'initialSpeed', min: 80, max: 400, hardDirection: 'higher', ... }
```

---

## BrowserGameAdapter

Playwright를 사용해 실제 웹게임 URL을 테스트할 수 있는 어댑터.

> **필요 조건**: `npm install playwright && npx playwright install chromium`

```js
const { BrowserGameAdapter, BrowserBot, FunMeter } = require('radar_fun_meter');

const adapter = new BrowserGameAdapter({
  url: 'http://localhost:3000',
  scoreSelector: '#score',
  deathSelector: '.game-over',
  actions: ['Space', 'ArrowLeft'],
});

const bot = new BrowserBot({ actions: ['Space'], jumpProb: 0.05 });
const meter = new FunMeter();
const result = await meter.runBrowser(adapter, bot, { runs: 30 });
meter.print(result);
```

### constructor(config)

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `url` | `string` | 필수 | 게임 URL |
| `actions` | `string[]` | `['Space']` | 허용 키 입력 목록 |
| `scoreSelector` | `string` | `'#score'` | 점수 DOM 셀렉터 |
| `deathSelector` | `string` | `'.game-over'` | 게임오버 DOM 셀렉터 |
| `restartSelector` | `string \| null` | `null` | 재시작 버튼 셀렉터 (없으면 reload) |
| `usePostMessage` | `boolean` | `false` | postMessage 기반 상태 수신 모드 |
| `pollInterval` | `number` | `50` | DOM 폴링 주기 (ms) |
| `timeout` | `number` | `60000` | 최대 생존 시간 (ms) |
| `headless` | `boolean` | `true` | 헤드리스 모드 |
| `name` | `string` | URL hostname | 게임 이름 |

### CLI --url 옵션

```bash
# 기본 브라우저 모드
funmeter --url=http://localhost:3000 \
  --actions=Space,ArrowLeft \
  --scoreSelector=#score \
  --deathSelector=.game-over \
  --runs=30

# 재시작 버튼이 있는 경우
funmeter --url=http://localhost:3000 \
  --restartSelector=.restart-btn \
  --runs=50 \
  --output=report.html

# 헤드리스 끄기 (디버깅)
funmeter --url=http://localhost:3000 --headed
```

---

## GameAdapter (추상 베이스 클래스)

모든 게임 어댑터가 상속해야 하는 추상 클래스. `src/GameAdapter.js`에 정의.

### 필수 메서드

| 메서드 | 반환 타입 | 설명 |
|--------|-----------|------|
| `reset()` | `void` | 게임 상태를 초기화 (매 플레이마다 호출됨) |
| `update(input)` | `void` | 한 틱 진행. `input`은 봇의 액션 문자열 또는 `null` |
| `getScore()` | `number` | 현재 점수 반환 |
| `isAlive()` | `boolean` | 게임 오버 여부 (`false`이면 종료) |
| `getDifficulty()` | `number` | 현재 난이도 반환 (0~1) |
| `getName()` | `string` | 게임 이름 반환 |

### 선택 메서드

| 메서드 | 반환 타입 | 설명 |
|--------|-----------|------|
| `getTime()` | `number` | 경과 시간 (틱 단위, GameAdapter 기본 구현 있음) |
| `getLevel()` | `number \| null` | 현재 레벨 (구현 시 레벨 모드 자동 활성화) |

```js
// 예시 1: 최소 구현
const { GameAdapter } = require('radar_fun_meter');

class MyGame extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this.reset();
  }
  reset() { this._score = 0; this._alive = true; this._tick = 0; }
  update(input) {
    if (input === 'action') this._score++;
    if (++this._tick > 300) this._alive = false;
  }
  getScore() { return this._score; }
  isAlive() { return this._alive; }
  getDifficulty() { return this._tick / 300; }
  getName() { return 'MyGame'; }
}

// 예시 2: getLevel() 추가로 레벨 모드 활성화
getLevel() { return Math.floor(this._score / 10); }
```

---

## Bot 인터페이스

봇이 구현해야 하는 인터페이스.

### decide(game) → string | null

매 틱마다 호출되는 봇의 입력 결정 함수.

| 반환값 | 의미 |
|--------|------|
| `'action'` | 게임에 액션 입력 (점프, 탭, 드롭 등) |
| `null` | 아무 동작 없음 |

### reset() (선택)

매 게임 시작 전에 `FunMeter.run()`이 호출. 봇 내부 상태가 있으면 구현 필요.

```js
// 예시 1: 최소 봇 구현
const myBot = {
  decide(game) {
    return Math.random() < 0.05 ? 'action' : null;
  }
};

// 예시 2: reset()이 있는 봇
class StatefulBot {
  constructor() { this.reset(); }
  reset() { this._count = 0; }
  decide(game) {
    this._count++;
    return this._count % 30 === 0 ? 'action' : null;
  }
}
```
