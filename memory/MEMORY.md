# radar_fun_meter 프로젝트 메모리

## 프로젝트 개요
Flow Theory 기반 게임 재미 측정 도구. 봇이 게임을 N번 플레이하고 생존 시간 분포로 FLOW/TOO_HARD/TOO_EASY 판정.

## 주요 파일 구조
- `src/FunMeter.js` - 핵심 엔진 (생존 시간 분석, 통계, Flow 판정)
- `src/GameAdapter.js` - 게임 인터페이스 (reset/update/getScore/isAlive/getDifficulty/getName/getLevel)
- `src/bots/RandomBot.js` - 랜덤 봇 (jumpProb 파라미터)
- `src/bots/HumanLikeBot.js` - 인간형 봇 (accuracy, reactionMin/Max ms)
- `src/Optimizer.js` - 파라미터 이진 탐색으로 Flow Zone 자동 최적화
- `src/cli.js` - CLI 진입점

## 게임 어댑터
- `games/timing-jump/` - 장애물 점프. initialSpeed 조정으로 난이도 변경
- `games/stack-tower/` - 블록 쌓기. botError 조정 (내부 auto-drop 봇 있음)
- `games/rhythm-tap/` - 리듬 탭. botAccuracy 조정 (내부 탭 봇 있음)

## 핵심 설계 결정사항

### StackTower 특성
- 내부 auto-drop 봇 보유 → 외부 RandomBot jumpProb=0 필요
- DEFAULT_PARAMS에 `defaultBotOptions: { jumpProb: 0 }` 설정됨
- `getLevel()` 구현됨 → FunMeter가 레벨 통계 자동 표시

### HumanLikeBot 설계
- `reset()` 필수 → FunMeter.run()이 각 게임마다 bot.reset() 호출
- TimingJump: `idealLeadTicks=18`으로 타이밍 계산 (detectionDist = dangerEntryX + totalLeadTicks * speed)
- StackTower: block center 정렬 감지 (speed * avgDelayTicks 기반 threshold)
- RhythmTap: note.y 기반 감지 (goodRange + 이동거리)

### Optimizer 설계
- 이진 탐색 (binary search) 방식
- DEFAULT_PARAMS: timing-jump=initialSpeed[80-400 higher], stack-tower=botError[2-40 higher], rhythm-tap=botAccuracy[0.05-0.9 lower]
- `defaultBotOptions.jumpProb=0` falsy 체크 주의 → `=== undefined` 사용

## CLI 사용법
```bash
# 기본 실행
node src/cli.js --game=timing-jump --runs=100 --bot=human

# 최적화
node src/cli.js --game=timing-jump --optimize --opt.runs=50 --opt.iter=15

# 커스텀 파라미터 최적화
node src/cli.js --game=timing-jump --optimize --opt.param=speedIncrement --opt.min=0 --opt.max=0.2 --opt.direction=higher
```

## 알려진 패턴
- FunMeter 기본 FLOW 기준: 중앙값 ≥ 5s, 타임아웃 ≤ 50%
- TimingJump FLOW를 위한 initialSpeed: ~120 (HumanLikeBot accuracy=0.9 기준)
- StackTower FLOW를 위한 botError: ~21
