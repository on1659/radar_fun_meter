# Changelog

## [3.0.0] - 2026-03-01

### Added
- **Worker threads 병렬 실행** (`--parallel=N`)
  - `--parallel=1` (기본값): 기존 동기 루프, 하위 호환 완전 보장
  - `--parallel=N` (N≥2): Node.js `worker_threads`로 N개 Worker에 runs 균등 분배
  - 각 Worker는 독립 게임 인스턴스 생성 (팩토리 함수 패턴)
  - SmartBot/MLBot은 병렬 미지원 — 경고 후 단일 스레드 자동 폴백
- **`src/worker/runnerWorker.js`**: Worker 스크립트 (게임 로드 → N회 플레이 → 결과 전송)
- **`FunMeter.runParallel()`**: Worker threads 기반 병렬 실행 메서드
- **`tests/benchmark.js`**: 단일 vs 병렬 성능 비교 측정 스크립트

---

## [2.3.1] - 2026-03-01

### Added
- **GitHub Gist 공유** (`src/reporters/gistReporter.js`)
  - `--share`: 결과를 GitHub Gist로 업로드 (`FUNMETER_GITHUB_TOKEN` 환경변수 필요)
  - `--view=<gist-id>`: Gist에 저장된 결과를 터미널에서 조회
  - `GistAuthError`, `GistUploadError`, `GistNotFoundError`, `GistFormatError` 커스텀 오류 클래스

### Fixed
- **stdin TTY 버그 수정**: 비대화형 환경(CI/파이프)에서 `readline` 오류 발생 문제 수정
  - `process.stdin.isTTY` 체크 후 비TTY 환경에서 자동 거부 처리
  - `--yes` 플래그로 비대화형 환경에서도 확인 없이 진행 가능

---

## [2.2.0] - 2026-03-01

### Changed
- **대시보드 UX 개선** (`src/server/index.js`):
  - 히스토리 라인 차트: 과거 실행 중앙값 추이를 Canvas로 시각화
  - Zone 색상 코딩: FLOW(초록), TOO_HARD(빨강), TOO_EASY(파랑)
  - 반응형 레이아웃: 모바일 뷰포트 대응
- **CLI `--history` diff 출력**: 직전 실행 대비 중앙값·Zone·타임아웃율 변화 표시

---

## [2.0.0] - 2026-03-01

### Added
- **FunMeterServer** (`src/server/index.js`): 로컬 HTTP 서버 + SSE 실시간 스트리밍
  - `GET /` → 웹 대시보드 (Canvas 라이브 차트)
  - `GET /events` → SSE 스트림 (`progress` / `result` 이벤트)
  - `GET /history` → 최근 실행 이력 JSON (기본 최대 10개)
- **히스토리 저장**: `.funmeter-history/` 디렉터리 자동 생성 및 JSON 저장
- **CLI `--serve`**: 실행 중 대시보드 기동 + 브라우저 자동 열기
- **CLI `--port=<n>`**: 서버 포트 지정 (기본: 4567)
- **CLI `--history`**: 저장된 이력 터미널 출력 후 종료

---

## [1.5.0] - 2026-02-28

### Added
- **MLBot** (`src/bots/MLBot.js`): ε-greedy Q-Learning 범용 강화학습 봇
  - `train(game, episodes, options)`: 자체 학습 루프 (엡실론 감쇠 지원)
  - `decide(game)`: 이산화 상태 기반 greedy 행동 선택
  - `save(filePath)`: Q-테이블 + 하이퍼파라미터 JSON 저장
  - `MLBot.load(filePath, options)`: 저장된 모델 로드
  - `game.getStateVector()` 훅: 게임이 구현 시 커스텀 상태 벡터 사용
- **examples/pretrained/train.js**: timing-jump 사전학습 실행 스크립트
- **CLI `--bot=ml`**: MLBot 사용
  - `--ml.train`, `--ml.episodes=<n>`: 학습 모드
  - `--ml.save=<파일>`, `--ml.load=<파일>`: 모델 저장/로드
  - `--ml.epsilon=<0~1>`, `--ml.buckets=<n>`: 하이퍼파라미터 조정

---

## [1.4.0] - 2026-03-01

### Added
- **deathPattern analysis**: `RunResult.deathPattern` 필드 추가
  - `skewness`: 생존 시간 분포의 왜도 (Fisher-Pearson g1)
  - `kurtosis`: 초과 첨도 (정규분포 대비)
  - `cluster`: `'early' | 'uniform' | 'late'` — 사망 집중 패턴
- **GENRE_PRESETS**: 장르별 Flow 기준 사전 정의
  - `action`: `{ minMedian: 5, maxTimeoutRate: 0.3 }`
  - `rhythm`: `{ minMedian: 10, maxTimeoutRate: 0.4 }`
  - `puzzle`: `{ minMedian: 15, maxTimeoutRate: 0.6 }`
  - `survival`: `{ minMedian: 8, maxTimeoutRate: 0.2 }`
- **FlappyBirdAdapter** (`games/flappy-bird/`)와 **FlappyBirdBot** (`src/bots/FlappyBirdBot.js`)
- **진행률 표시 바**: runs ≥ 20 실행 시 CLI에서 자동 표시
- **scoreCurve 통계**: `RunResult`에 점수 곡선 데이터 포함
- **suggestions 피드백**: `RunResult.advice`에 구체적 파라미터 조정 제안
- **SmartBot** (`src/bots/SmartBot.js`): 게임 장르 힌트 기반 휴리스틱 봇
- **BrowserGameAdapter** (`src/BrowserGameAdapter.js`): Playwright 기반 실제 웹게임 테스트 지원
- **BrowserBot** (`src/bots/BrowserBot.js`): 브라우저 모드용 봇
- **FunMeter.runBrowser()**: 비동기 브라우저 게임 실행 메서드
- **CLI `--url` 옵션**: URL + DOM 셀렉터로 실제 웹게임 분석

### Changed
- `FunMeter` 생성자에 `genre` / `flowCriteria` 옵션 추가 (GENRE_PRESETS 연동)
- `FunMeter.run()` 반환값에 `deathPattern` 필드 추가
- `GENRE_PRESETS` 이제 `radar_fun_meter` 메인 export에 포함

## [1.3.0] - 2026-01-15

- Initial stable release (GameAdapter, FunMeter, Optimizer, HTML/MD reporters, ESM support)
