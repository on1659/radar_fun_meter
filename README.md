# 🎮 radar_fun_meter

**범용 게임 재미 측정 도구**  
Flow Theory 기반으로 게임 밸런스를 자동 분석해줌.

## 컨셉

> 재미 = 실력과 난이도의 균형 (Flow Theory)
> - 너무 쉬움 → 지루함
> - 딱 맞음 → FLOW (재밌음!)
> - 너무 어려움 → 불쾌함/포기

봇이 게임을 N번 자동 플레이 → 생존 시간/점수 분석 → Flow Zone 판정 → 파라미터 조정 제안

## 사용법

```bash
# 예제 게임 테스트
node src/cli.js --game=example --runs=100

# 타이밍 점프 테스트
node src/cli.js --game=timing-jump --runs=100

# 파라미터 조정하면서 비교
node src/cli.js --game=timing-jump --runs=100 --config.initialSpeed=150
node src/cli.js --game=timing-jump --runs=100 --config.initialSpeed=260

# 모든 게임 한번에
npm run test:all
```

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
| `timing-jump` | `games/timing-jump/TimingJumpAdapter.js` | 랜덤 점프 |
| `rhythm-tap` | `games/rhythm-tap/RhythmTapAdapter.js` | 자동 탭 (정확도 조절 가능) |
| `stack-tower` | `games/stack-tower/StackTowerAdapter.js` | 위치 기반 드롭 |

## 현재 진단 결과 (2026-02-28)

```
타이밍 점프: 😵 너무 어려움 (봇 중앙값 3.5초)
  → initialSpeed=260이 랜덤봇에겐 과함
  → 실제 사람은 더 오래 살지만 체감 검증 필요

리듬 탭: 😴 너무 쉬움 (봇 타임아웃 100%)  
  → 봇이 자동 탭이라 miss가 거의 없음
  → 봇 정확도 낮추거나 miss 기준 강화 필요

스택 타워: 😵 생존 시간 측정 부적합
  → 레벨 기반 측정이 더 적합한 게임
  → TODO: 레벨 어댑터 추가
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
