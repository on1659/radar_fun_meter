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

# 파라미터 조정하면서 테스트
node src/cli.js --game=example --runs=100 --config.initialSpeed=22
node src/cli.js --game=example --runs=100 --config.initialSpeed=130
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

3. 실행: `node src/cli.js --game=mygame --runs=100`

## 현재 지원 게임

- `example` - 타이밍 점프 스타일 예제
- `timing-jump` - Gamzaworld 타이밍 점프 (TODO)
- `rhythm-tap` - Gamzaworld 리듬 탭 (TODO)
- `stack-tower` - Gamzaworld 스택 타워 (TODO)

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
│   └── example/
│       └── ExampleGame.js
└── README.md
```
