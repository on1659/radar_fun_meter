/**
 * Optimizer - Flow Zone 도달까지 게임 파라미터 자동 탐색
 *
 * 전략:
 * - 단일 파라미터에 대해 이진 탐색 (binary search)
 * - TOO_HARD → 파라미터 값 낮춤 (또는 높임, hardDirection에 따라)
 * - TOO_EASY → 파라미터 값 높임 (또는 낮춤)
 * - FLOW → 탐색 완료
 */

const FunMeter = require('./FunMeter');

// 게임별 기본 탐색 파라미터
const DEFAULT_PARAMS = {
  'timing-jump': {
    name: 'initialSpeed',
    min: 80,
    max: 400,
    hardDirection: 'higher', // 값이 높을수록 어려움
  },
  'stack-tower': {
    name: 'botError',
    min: 2,
    max: 40,
    hardDirection: 'higher',    // 값이 높을수록 어려움 (오차 커짐 → 블록 빠르게 소멸)
    defaultBotOptions: { jumpProb: 0 }, // 내부 auto-bot만 사용 (외부 random drop 금지)
    flowOptions: {              // 레벨 기반 FLOW 판정 (생존 시간보다 적합)
      levelMode: true,
      levelFlowMinMedian: 5,
      levelFlowMaxMedian: 25,
    },
  },
  'rhythm-tap': {
    name: 'botAccuracy',
    min: 0.05,
    max: 0.9,
    hardDirection: 'lower', // 값이 낮을수록 어려움 (정확도 오차 적음)
  },
};

class Optimizer {
  /**
   * @param {object} options
   * @param {number} options.maxIterations - 최대 반복 횟수 (기본 20)
   * @param {number} options.runs - 반복당 게임 실행 횟수 (기본 50)
   * @param {boolean} options.verbose - 진행 상황 출력 (기본 true)
   * @param {object} options.flowOptions - FunMeter Flow 판정 기준 (선택)
   */
  constructor(options = {}) {
    this.maxIterations = options.maxIterations ?? 20;
    this.runs = options.runs ?? 50;
    this.verbose = options.verbose ?? true;
    this.flowOptions = options.flowOptions ?? {};
  }

  /**
   * Flow Zone 도달까지 파라미터 탐색
   *
   * @param {Function} GameClass - 게임 클래스 (new GameClass(config))
   * @param {Function} BotClass  - 봇 클래스 (new BotClass(botOptions))
   * @param {object}   botOptions - 봇 생성 옵션
   * @param {object}   param - 탐색할 파라미터 설명
   *   { name: string, min: number, max: number, hardDirection: 'higher'|'lower' }
   * @returns {{ config: object, result: object, found: boolean }}
   */
  optimize(GameClass, BotClass, botOptions, param) {
    const meter = new FunMeter({
      ticksPerSecond: 60,
      maxSeconds: 60,
      ...this.flowOptions,
    });

    let low = param.min;
    let high = param.max;
    let bestResult = null;
    let bestConfig = null;
    let found = false;

    if (this.verbose) {
      console.log(`\n🔍 최적화 시작: ${param.name} ∈ [${param.min}, ${param.max}]`);
      console.log(`   runs/iter=${this.runs}, maxIter=${this.maxIterations}`);
      if (this.flowOptions.levelMode) {
        console.log(`   판정 모드: 레벨 기반 (FLOW: ${this.flowOptions.levelFlowMinMedian}~${this.flowOptions.levelFlowMaxMedian}레벨)`);
      }
      console.log('─'.repeat(50));
    }

    for (let iter = 1; iter <= this.maxIterations; iter++) {
      const mid = (low + high) / 2;
      const config = { [param.name]: mid };

      const game = new GameClass(config);
      const bot = new BotClass(botOptions);
      const result = meter.run(game, bot, this.runs);

      if (this.verbose) {
        const dir = result.zone === 'FLOW' ? '✅' : result.zone === 'TOO_HARD' ? '😵' : '😴';
        // 레벨 모드일 때는 레벨 중앙값, 아니면 생존 시간 표시
        const stat = (result.levelMode && result.levelStats)
          ? `레벨 중앙값: ${result.levelStats.median.toFixed(1)}`
          : `중앙값: ${result.median.toFixed(1)}s, timeout: ${(result.timeoutRate * 100).toFixed(0)}%`;
        console.log(
          `  iter ${String(iter).padStart(2)}: ${param.name}=${mid.toFixed(3).padStart(8)}` +
          ` → ${dir} ${result.zone.padEnd(10)} (${stat})`
        );
      }

      bestResult = result;
      bestConfig = config;

      if (result.zone === 'FLOW') {
        found = true;
        break;
      }

      // 이진 탐색: 어렵다 → 값을 "쉬운 방향"으로, 쉽다 → "어려운 방향"으로
      const isHarderWhenHigher = param.hardDirection === 'higher';
      if (result.zone === 'TOO_HARD') {
        // 쉽게 만들기
        if (isHarderWhenHigher) high = mid; else low = mid;
      } else {
        // 어렵게 만들기 (TOO_EASY)
        if (isHarderWhenHigher) low = mid; else high = mid;
      }

      // 수렴 검사
      if (Math.abs(high - low) < 0.001) {
        if (this.verbose) console.log('  (수렴 완료)');
        break;
      }
    }

    if (this.verbose) {
      console.log('─'.repeat(50));
      if (found) {
        console.log(`\n✅ Flow Zone 발견! 최적 설정:`);
      } else {
        console.log(`\n⚠️  최대 반복 도달. 가장 근접한 설정:`);
      }
      console.log(`   ${param.name} = ${bestConfig[param.name].toFixed(4)}`);
      meter.print(bestResult);
    }

    return { config: bestConfig, result: bestResult, found };
  }

  /**
   * 게임 이름으로 기본 파라미터를 사용해 최적화
   * 게임별 기본 flowOptions (예: stack-tower의 levelMode)가 자동 적용됨
   * @param {string} gameName
   * @param {Function} GameClass
   * @param {Function} BotClass
   * @param {object} botOptions
   * @returns {{ config, result, found }}
   */
  optimizeByName(gameName, GameClass, BotClass, botOptions = {}) {
    const param = DEFAULT_PARAMS[gameName];
    if (!param) {
      throw new Error(
        `게임 '${gameName}'의 기본 최적화 파라미터가 없습니다. optimize()에 직접 param을 전달하세요.`
      );
    }
    // defaultBotOptions 적용 (호출자 옵션이 우선)
    const mergedBotOptions = { ...(param.defaultBotOptions || {}), ...botOptions };

    // 게임별 기본 flowOptions 적용 (사용자 지정 flowOptions가 우선)
    const savedFlowOptions = this.flowOptions;
    this.flowOptions = { ...(param.flowOptions || {}), ...savedFlowOptions };

    const result = this.optimize(GameClass, BotClass, mergedBotOptions, param);

    this.flowOptions = savedFlowOptions; // 복원
    return result;
  }
}

module.exports = { Optimizer, DEFAULT_PARAMS };
