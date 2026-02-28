# 🎮 radar_fun_meter

**범용 게임 재미 측정 도구**  
Flow Theory 기반으로 게임 밸런스를 자동 분석해줌.

[![npm version](https://img.shields.io/npm/v/radar_fun_meter.svg)](https://www.npmjs.com/package/radar_fun_meter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 설치

```bash
# npm 글로벌 설치
npm install -g radar_fun_meter

# 또는 로컬 프로젝트에 설치
npm install radar_fun_meter

# CLI 실행
funmeter --game=example --runs=100
```

개발 모드 (로컬 클론):
```bash
git clone https://github.com/on1659/radar_fun_meter.git
cd radar_fun_meter
node src/cli.js --game=example --runs=100
```

## 컨셉

> 재미 = 실력과 난이도의 균형 (Flow Theory)
> - 너무 쉬움 → 지루함
> - 딱 맞음 → FLOW (재밌음!)
> - 너무 어려움 → 불쾌함/포기

봇이 게임을 N번 자동 플레이 → 생존 시간/점수 분석 → Flow Zone 판정 → 파라미터 조정 제안

## 사용법

```bash
# 예제 게임 테스트 (기본: RandomBot)
node src/cli.js --game=example --runs=100

# HumanLikeBot 사용 (사람처럼 반응)
node src/cli.js --game=timing-jump --runs=100 --bot=humanlike

# 파라미터 조정하면서 비교
node src/cli.js --game=timing-jump --runs=100 --config.initialSpeed=150
node src/cli.js --game=timing-jump --runs=100 --config.initialSpeed=260

# 🚀 자동 최적화 (Flow Zone 도달까지 파라미터 탐색)
node src/cli.js --game=timing-jump --optimize --opt.runs=50 --opt.iter=15 --bot=humanlike

# 모든 게임 한번에
npm run test:all
```

### 봇 타입

| 봇 | 설명 | 용도 |
|------|------|------|
| `random` | 랜덤 확률로 입력 (기본) | 빠른 테스트, 극단적 난이도 체크 |
| `humanlike` | 장애물/이벤트 감지 후 반응 (100~300ms 지연) | 실제 사람 플레이 시뮬레이션, 정확한 밸런스 측정 |

### 자동 최적화

Flow Zone에 도달할 때까지 게임 파라미터를 자동 탐색합니다 (Binary Search 기반).

```bash
# 기본 (게임별 기본 파라미터 자동 적용)
node src/cli.js --game=timing-jump --optimize

# 옵션 조절
node src/cli.js --game=stack-tower --optimize \
  --opt.runs=30 \      # 반복당 실행 횟수 (기본 50)
  --opt.iter=20 \      # 최대 반복 횟수 (기본 20)
  --bot=humanlike      # 봇 타입 지정
```

지원 게임: `timing-jump`, `stack-tower`, `rhythm-tap`, `heartbeat` (예제)

## 새 게임 추가

1. `games/{게임이름}/` 폴더 생성
2. `GameAdapter`를 상속해서 구현:

```js
const GameAdapter = require('../../src/GameAdapter');

class MyGame extends GameAdapter {
  reset() { /* 게임 초기화 */ }
  update(input) { /* 한 프레임 진행 */ }
  getScore() { return this.score; }
  isAlive() { return this.alive; }
  getDifficulty() { return 0~1 사이 값; }
  getName() { return 'MyGame'; }
}

module.exports = MyGame;
```

3. `src/cli.js`의 GAMES 레지스트리에 등록
4. 실행: `node src/cli.js --game=mygame --runs=100`

## 현재 지원 게임

| 게임 | 파일 | 봇 타입 |
|------|------|---------|
| `example` | `games/example/ExampleGame.js` | 랜덤 점프 |
| `timing-jump` | `games/timing-jump/TimingJumpAdapter.js` | 랜덤 점프 / HumanLikeBot |
| `rhythm-tap` | `games/rhythm-tap/RhythmTapAdapter.js` | 자동 탭 (정확도 조절 가능) |
| `stack-tower` | `games/stack-tower/StackTowerAdapter.js` | 위치 기반 드롭 |
| `flappy-bird` | `games/flappy-bird/FlappyBirdAdapter.js` | FlappyBirdBot (기본) |

## 최신 기능 & 진단 결과

### 🎯 최신 추가 (2026-03-01 01:30 AM)

**진행률 표시** - 20회 이상 실행 시 자동으로 진행률 바 표시
```
진행: [████████████████░░░░] 82% (41/50)
```

**FlappyBird 예제 게임** - HumanLikeBot 호환 완전한 게임 구현
- 전용 FlappyBirdBot으로 파이프 간격 자동 통과
- Optimizer로 pipeSpeed 자동 탐색

### 기존 진단 결과

```
타이밍 점프: ✅ HumanLikeBot + Optimizer로 Flow Zone 도달!
  → initialSpeed=120으로 최적화 시 중앙값 5.3초 (FLOW)
  → 사람처럼 반응하는 봇으로 훨씬 정확한 밸런스 측정 가능

리듬 탭: 자동 탭 정확도 조절 가능
  → HumanLikeBot accuracy 파라미터로 실수율 조절
  → Optimizer로 botAccuracy 자동 탐색

스택 타워: ✅ 레벨 기반 측정 완벽 지원!
  → 레벨 중앙값 10으로 Flow Zone 판정 (5~25 범위)
  → Optimizer가 botError 자동 탐색하여 최적 난이도 찾음
```

## 결과 예시

```
📊 결과: ExampleGame
────────────────────────────────────────
생존 시간
  평균:   18.3초
  중앙값: 16.1초
  최소:   2.4초
  최대:   58.9초
점수
  평균:   2847
  최고:   12453
타임아웃: 3%
────────────────────────────────────────

✅ FLOW Zone! (재밌을 가능성 높음)
💡 균형 잘 잡혔어. 난이도 상승 곡선 유지하면 됨.
```

## 폴더 구조

```
radar_fun_meter/
├── src/
│   ├── GameAdapter.js    ← 인터페이스
│   ├── FunMeter.js       ← 분석 엔진
│   ├── cli.js            ← CLI 진입점
│   └── bots/
│       └── RandomBot.js  ← 랜덤 봇
├── games/
│   ├── example/
│   │   └── ExampleGame.js
│   ├── timing-jump/
│   │   └── TimingJumpAdapter.js
│   ├── rhythm-tap/
│   │   └── RhythmTapAdapter.js
│   └── stack-tower/
│       └── StackTowerAdapter.js
└── README.md
```
