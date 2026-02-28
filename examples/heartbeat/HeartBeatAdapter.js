/**
 * =============================================================================
 * 새 게임 만들기 튜토리얼 - HeartBeat 어댑터
 * =============================================================================
 *
 * 이 파일은 radar_fun_meter에 새 게임을 연결하는 방법을 단계별로 보여줍니다.
 *
 * [ 게임 규칙 ]
 *   - 생명력(hearts) 바가 시간이 지날수록 점점 빠르게 감소합니다.
 *   - 봇이 'action'을 입력하면 생명력이 회복됩니다.
 *   - 생명력이 0이 되면 게임 오버.
 *
 * [ 실행 방법 ]
 *   node src/cli.js --game=heartbeat --runs=100
 *   node src/cli.js --game=heartbeat --runs=100 --bot=human
 *   node src/cli.js --game=heartbeat --runs=100 --config.drainRate=0.5
 *   node src/cli.js --game=heartbeat --optimize
 *
 * [ 학습 포인트 ]
 *   STEP 1 - 상수 정의: 어떤 값을 config로 받을지 결정한다
 *   STEP 2 - 클래스 선언: GameAdapter 상속
 *   STEP 3 - reset(): 매 run마다 완전한 초기화
 *   STEP 4 - update(input): 한 틱(프레임)의 게임 로직
 *   STEP 5 - 필수 게터: FunMeter가 읽는 값들
 */

const GameAdapter = require('../../src/GameAdapter');

// =============================================================================
// STEP 1: 상수 정의
//
// 바꾸지 않을 값은 여기에 고정합니다.
// 난이도를 조절할 값은 config로 받을 수 있게 DEFAULTS에 넣고
// constructor에서 오버라이드를 허용합니다.
// =============================================================================
const DEFAULTS = {
  maxHearts: 100,          // 최대 생명력 (상한선)
  startHearts: 80,         // 시작 생명력
  tapHeal: 8,              // 탭 1회당 회복량

  // ★ 이 값이 핵심 난이도 파라미터입니다 ★
  // Optimizer가 이 값을 조정해서 FLOW Zone을 찾습니다.
  // 값이 클수록 생명력이 빠르게 줄어 → 어려움
  drainRate: 0.35,         // 틱당 초기 소모량 (px 단위 아님, 순수 수치)

  drainIncrement: 0.0004,  // 틱마다 drainRate 증가량 (시간이 지날수록 점점 어려워짐)
};

// =============================================================================
// STEP 2: GameAdapter 상속
//
// 모든 게임 어댑터는 GameAdapter를 상속해야 합니다.
// GameAdapter는 필수 메서드의 인터페이스를 정의합니다.
// =============================================================================
class HeartBeatAdapter extends GameAdapter {

  constructor(config = {}) {
    super(config);

    // config로 외부에서 파라미터를 덮어씁니다.
    // 예: new HeartBeatAdapter({ drainRate: 0.8 }) → 더 어렵게
    // CLI에서: --config.drainRate=0.8
    this._cfg = { ...DEFAULTS, ...config };
  }

  // ===========================================================================
  // STEP 3: reset() - 필수 구현
  //
  // FunMeter.run()이 각 run을 시작할 때마다 이 메서드를 호출합니다.
  // 게임 상태를 완전히 초기화해야 합니다.
  // "이전 run의 흔적이 남으면 안 된다"는 규칙입니다.
  // ===========================================================================
  reset() {
    const cfg = this._cfg;

    // 기본 상태
    this.score = 0;
    this.alive = true;
    this.tick = 0;
    this._time = 0;

    // 게임 고유 상태
    this.hearts = cfg.startHearts;   // 현재 생명력
    this._drain = cfg.drainRate;     // 현재 소모 속도 (매 틱 증가)
  }

  // ===========================================================================
  // STEP 4: update(input) - 필수 구현
  //
  // 한 프레임(틱)의 모든 게임 로직을 여기에 작성합니다.
  // input은 봇이 결정한 문자열입니다.
  //   - RandomBot: 설정한 확률로 'action' 또는 null
  //   - HumanLikeBot: 위협 감지 후 'action' 또는 null
  //
  // 이 게임에서 'action' = 탭하여 생명력 회복
  // ===========================================================================
  update(input) {
    if (!this.alive) return;

    const cfg = this._cfg;
    this.tick++;
    this._time = this.tick / 60;  // 초 단위 시간 (60틱 = 1초)

    // --- 입력 처리 ---
    // 봇이 'action'을 선택하면 생명력 회복
    if (input === 'action') {
      this.hearts = Math.min(cfg.maxHearts, this.hearts + cfg.tapHeal);
      this.score += 5;  // 탭 보상
    }

    // --- 게임 로직 ---
    // 소모 속도가 매 틱 조금씩 증가 → 시간이 지날수록 어려워짐
    this._drain += cfg.drainIncrement;
    this.hearts -= this._drain;

    // --- 게임 오버 조건 ---
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.alive = false;
      return;
    }

    // 생존 보상 (10틱마다 1점)
    if (this.tick % 10 === 0) this.score += 1;
  }

  // ===========================================================================
  // STEP 5: 필수 게터 메서드
  //
  // FunMeter가 각 run 결과를 집계할 때 이 값들을 읽습니다.
  // ===========================================================================

  /** 현재 점수 (단조 증가 또는 의미 있는 값) */
  getScore() { return this.score; }

  /** 생존 여부 (false가 되면 FunMeter가 run을 종료) */
  isAlive() { return this.alive; }

  /**
   * 현재 난이도 (0~1 범위)
   * FunMeter의 분석에는 직접 사용되지 않지만,
   * 게임이 얼마나 어려운 상태인지를 표현합니다.
   */
  getDifficulty() {
    // 현재 drain이 최대(초기값의 5배)에 가까울수록 난이도 1에 가까워짐
    return Math.min(this._drain / (this._cfg.drainRate * 5), 1);
  }

  /** 게임 이름 (FunMeter 출력에 표시) */
  getName() { return 'HeartBeat'; }
}

module.exports = HeartBeatAdapter;
