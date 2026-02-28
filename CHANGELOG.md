# Changelog

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
