# radar - 범용 게임 QA 라이브러리 설계 문의

## 배경

`radar`는 웹 기반 게임의 재미와 밸런스를 자동으로 측정하는 npm 라이브러리야.
Flow Theory (Csikszentmihalyi) 기반으로 난이도-실력 균형을 분석해서 게임이 재미있는지 판단해.

**타겟 사용자:** 웹 게임 개발자 (혼자든, 팀이든)
**핵심 가치:** 게임 코드 or URL만 있으면 자동으로 QA 리포트 생성

---

## 현재 구현 (v0.1.0)

```
radar_fun_meter/
├── src/
│   ├── GameAdapter.js    ← 게임이 구현해야 하는 인터페이스
│   ├── FunMeter.js       ← N번 시뮬레이션 + Flow Zone 분석
│   ├── cli.js            ← CLI 진입점
│   └── bots/
│       └── RandomBot.js  ← 랜덤 입력 봇
├── games/
│   └── example/
│       └── ExampleGame.js ← 예제 (타이밍 점프 스타일)
```

**GameAdapter 인터페이스:**
```js
class GameAdapter {
  reset()           // 게임 초기화
  update(input)     // 한 프레임 진행
  getScore()        // 현재 점수
  isAlive()         // 생존 여부
  getDifficulty()   // 0.0~1.0 난이도
  getName()         // 게임 이름
}
```

**현재 분석 방식:**
- 봇이 N번 플레이 (기본 100회)
- 생존 시간, 점수 분포 측정
- Flow Zone 판정: TOO_EASY / CHALLENGING / FLOW / TOO_HARD

---

## 원하는 것

**목표:** 다른 개발자들이 `npm install radar`로 설치해서 쓸 수 있는 제대로 된 라이브러리

**사용 시나리오:**

```js
// 시나리오 1: 게임 로직 직접 테스트
const { radar } = require('radar');
const result = await radar.simulate(MyGameClass, {
  runs: 100,
  bot: 'random' // or 'smart'
});
console.log(result.verdict); // "✅ FLOW Zone!"
console.log(result.suggestions); // 파라미터 조정 제안

// 시나리오 2: 실제 웹게임 브라우저 테스트 (Playwright)
const result = await radar.test('http://localhost:3000/game', {
  actions: ['Space', 'ArrowLeft', 'ArrowRight'],
  runs: 30,
  scoreSelector: '#score',  // 점수 DOM 셀렉터
  deathCondition: '.game-over' // 게임오버 DOM 셀렉터
});
```

---

## 질문들

1. **아키텍처 설계**
   - 위의 두 시나리오(로직 시뮬 vs 브라우저 자동화)를 하나의 라이브러리로 어떻게 통합해야 잘 설계된 거야?
   - GameAdapter 인터페이스가 충분히 범용적인가? 어떻게 개선하면 좋을까?

2. **봇 전략**
   - RandomBot 외에 어떤 봇 전략이 필요해? (SmartBot? MLBot?)
   - 게임 장르별로 봇 전략이 달라야 하는데 어떻게 추상화하면 좋을까?

3. **Flow Zone 분석 고도화**
   - 현재: 평균 생존 시간으로만 판단
   - 더 정확하게 하려면? (점수 곡선, 사망 패턴, 난이도 상승률 등)
   - 게임 장르별로 "재미" 기준이 다른데 어떻게 처리할까?

4. **npm 라이브러리답게**
   - TypeScript 지원해야 하나?
   - CommonJS vs ESM?
   - 테스트 프레임워크 (Jest 등)?
   - API 설계가 직관적인가? 개선점은?

5. **브라우저 자동화 (Phase 2)**
   - Playwright로 웹게임 자동 테스트할 때 어떤 점이 어려울까?
   - 게임 상태(점수, 생사)를 DOM에서 읽는 게 현실적인가?
   - 대안이 있을까?

6. **리포트 형식**
   - CLI 출력 외에 어떤 형식이 유용할까? (JSON, HTML, Markdown?)
   - CI/CD (GitHub Actions 등)에 연동하려면 어떻게 해야 할까?

---

## 현재 코드 참고

**FunMeter.js (핵심 로직):**
Flow Zone 판정 기준:
- 타임아웃 > 50% → TOO_EASY
- 평균 생존 < 5초 → TOO_HARD  
- 평균 생존 5~15초 → CHALLENGING
- 평균 생존 15~45초 → FLOW ✅
- 평균 생존 > 45초 → TOO_EASY

**질문:** 이 기준이 합리적인가? Flow Theory 논문 기반으로 더 정확하게 만들려면?
