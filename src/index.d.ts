// ─── 공통 타입 ─────────────────────────────────────────────

/** 사망 패턴 분석 결과 */
export interface DeathPattern {
  skewness: number;
  kurtosis: number;
  cluster: 'early' | 'uniform' | 'late';
}

/** 장르 프리셋 이름 */
export type FlowCriteriaPreset = 'action' | 'rhythm' | 'puzzle' | 'survival';

/** Flow 판정 기준 커스터마이징 */
export interface FlowCriteria {
  minMedian?: number;
  maxTimeoutRate?: number;
}

/** 히스토그램 버킷 */
export interface HistogramBucket {
  from: number;
  to: number;
  count: number;
  bar: string;
}

/** 레벨 통계 (게임이 getLevel()을 구현할 때만 존재) */
export interface LevelStats {
  mean: number;
  median: number;
  max: number;
  p25: number;
  p75: number;
}

/** Bootstrap 신뢰구간 및 샘플 크기 적정성 */
export interface Confidence {
  /** 95% 신뢰구간 [low, high] (초 단위) */
  ci95: [number, number];
  /** CI 폭 = ci95[1] - ci95[0] */
  ciWidth: number;
  /** 샘플 크기 적정성 */
  sampleSizeAdequacy: 'adequate' | 'marginal' | 'insufficient';
  /** 현재 CI 폭을 ±1초로 줄이기 위한 권장 runs 수 */
  recommendedRuns: number;
}

/** FunMeter.run() 반환값 */
export interface RunResult {
  name: string;
  times: number[];
  scores: number[];
  levels: number[];
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  p25: number;
  p75: number;
  p90: number;
  p95: number;
  histogram: HistogramBucket[];
  timeoutRate: number;
  scoreMean: number;
  scoreMax: number;
  levelStats: LevelStats | null;
  levelMode: boolean;
  zone: 'FLOW' | 'TOO_HARD' | 'TOO_EASY';
  emoji: string;
  advice: string;
  runs: number;
  deathPattern: DeathPattern;
  confidence: Confidence;
}

// ─── Bot 인터페이스 ────────────────────────────────────────

/** 모든 봇이 구현해야 하는 인터페이스 */
export interface Bot {
  decide(game: GameAdapter): string | null;
  reset?(): void;
}

// ─── GameAdapter ───────────────────────────────────────────

/** 모든 게임 어댑터의 베이스 클래스 */
export declare class GameAdapter {
  config: Record<string, unknown>;
  constructor(config?: Record<string, unknown>);
  reset(): void;
  update(input: string | null): void;
  getScore(): number;
  isAlive(): boolean;
  getDifficulty(): number;
  getName(): string;
  getTime(): number;
  getLevel(): number | null;
  /** 현재 게임 상태를 [0, 1] 범위 숫자 배열로 반환 (선택 구현, 미구현 시 null) */
  getStateVector(): number[] | null;
}

// ─── FunMeter ──────────────────────────────────────────────

export interface FunMeterOptions {
  ticksPerSecond?: number;
  maxSeconds?: number;
  flowMinMedian?: number;
  flowMaxTimeout?: number;
  levelMode?: boolean;
  levelFlowMinMedian?: number;
  levelFlowMaxMedian?: number;
  genre?: FlowCriteriaPreset;
  flowCriteria?: FlowCriteria;
}

export declare const GENRE_PRESETS: Record<FlowCriteriaPreset, Required<FlowCriteria>>;

export declare class FunMeter {
  ticksPerSecond: number;
  maxSeconds: number;
  flowMinMedian: number;
  flowMaxTimeout: number;
  levelMode: boolean;
  levelFlowMinMedian: number;
  levelFlowMaxMedian: number;
  genre: FlowCriteriaPreset | null;

  constructor(options?: FunMeterOptions);

  /**
   * 게임을 N번 플레이하고 분석
   * @param game 게임 어댑터 인스턴스
   * @param bot 봇 인스턴스
   * @param runs 플레이 횟수 (기본 100)
   * @param options 추가 옵션
   */
  run(
    game: GameAdapter,
    bot: Bot,
    runs?: number,
    options?: { verbose?: boolean }
  ): RunResult;

  /**
   * 브라우저 게임을 비동기 폴링 루프로 N번 플레이하고 분석
   */
  runBrowser(
    adapter: BrowserGameAdapter,
    bot: BrowserBot,
    options?: BrowserRunOptions
  ): Promise<RunResult>;

  /** 사망 패턴 분석 */
  computeDeathPattern(times: number[]): DeathPattern;

  /** 결과를 콘솔에 보기 좋게 출력 */
  print(result: RunResult): void;
}

// ─── BrowserGameAdapter ────────────────────────────────────

export interface BrowserGameAdapterConfig {
  url: string;
  actions?: string[];
  scoreSelector?: string;
  deathSelector?: string;
  restartSelector?: string | null;
  usePostMessage?: boolean;
  pollInterval?: number;
  timeout?: number;
  headless?: boolean;
  name?: string;
}

export declare class BrowserGameAdapter {
  config: BrowserGameAdapterConfig;
  constructor(config: BrowserGameAdapterConfig);
  init(): Promise<void>;
  reset(): Promise<void>;
  update(action: string | null): Promise<void>;
  getScore(): Promise<number>;
  isAlive(): Promise<boolean>;
  getName(): string;
  close(): Promise<void>;
}

// ─── BrowserBot ────────────────────────────────────────────

export interface BrowserBotConfig {
  actions?: string[];
  jumpProb?: number;
}

export declare class BrowserBot {
  actions: string[];
  jumpProb: number;
  constructor(config?: BrowserBotConfig);
  act(state: { score: number; elapsed: number }): string | null;
  reset(): void;
}

export interface BrowserRunOptions {
  pollInterval?: number;
  maxSeconds?: number;
  runs?: number;
}

// ─── Optimizer ─────────────────────────────────────────────

export interface OptimizerParam {
  name: string;
  min: number;
  max: number;
  /** 값이 높을수록 어려울 때 'higher', 낮을수록 어려울 때 'lower' */
  hardDirection: 'higher' | 'lower';
}

export interface OptimizerOptions {
  maxIterations?: number;
  runs?: number;
  verbose?: boolean;
  flowOptions?: FunMeterOptions;
}

export interface OptimizeResult {
  config: Record<string, number>;
  result: RunResult;
  found: boolean;
}

type GameClass = new (config: Record<string, unknown>) => GameAdapter;
type BotClass = new (options: Record<string, unknown>) => Bot;

export declare class Optimizer {
  maxIterations: number;
  runs: number;
  verbose: boolean;
  flowOptions: FunMeterOptions;

  constructor(options?: OptimizerOptions);

  /**
   * Flow Zone 도달까지 파라미터 이진 탐색
   */
  optimize(
    GameClass: GameClass,
    BotClass: BotClass,
    botOptions: Record<string, unknown>,
    param: OptimizerParam
  ): OptimizeResult;

  /**
   * 게임 이름으로 기본 파라미터 사용 (timing-jump, stack-tower, rhythm-tap, flappy-bird, heartbeat)
   */
  optimizeByName(
    gameName: string,
    GameClass: GameClass,
    BotClass: BotClass,
    botOptions?: Record<string, unknown>
  ): OptimizeResult;
}

export declare const DEFAULT_PARAMS: Record<string, OptimizerParam & {
  defaultBotOptions?: Record<string, unknown>;
  flowOptions?: FunMeterOptions;
}>;

// ─── RandomBot ─────────────────────────────────────────────

export interface RandomBotOptions {
  /** 매 틱당 액션 실행 확률 (기본 0.05 = 5%) */
  jumpProb?: number;
}

export declare class RandomBot implements Bot {
  jumpProb: number;
  constructor(options?: RandomBotOptions);
  decide(game: GameAdapter): string | null;
}

// ─── HumanLikeBot ──────────────────────────────────────────

export interface HumanLikeBotOptions {
  /** 정확도 0~1 (기본 0.9 = 90%) */
  accuracy?: number;
  /** 최소 반응 시간 ms (기본 100) */
  reactionMin?: number;
  /** 최대 반응 시간 ms (기본 300) */
  reactionMax?: number;
  /** 게임 틱레이트 (기본 60) */
  ticksPerSecond?: number;
}

export declare class HumanLikeBot implements Bot {
  accuracy: number;
  reactionMin: number;
  reactionMax: number;
  ticksPerSecond: number;

  constructor(options?: HumanLikeBotOptions);
  decide(game: GameAdapter): string | null;
  reset(): void;
}

// ─── SmartBot ───────────────────────────────────────────────

export interface SmartBotOptions {
  /** 장르 힌트 (기본 'auto'). 'auto'는 첫 호출 시 자동 감지 */
  hint?: 'platformer' | 'rhythm' | 'tower' | 'auto';
  /** 점수 트렌드 추적 윈도우 틱 수 (기본 60) */
  scoreWindow?: number;
}

export declare class SmartBot implements Bot {
  hint: string;
  scoreWindow: number;
  constructor(options?: SmartBotOptions);
  decide(game: GameAdapter): string | null;
  reset(): void;
}

// ─── MLBot ──────────────────────────────────────────────────

export interface MLBotOptions {
  actions?: (string | null)[];
  buckets?: number;
  alpha?: number;
  gamma?: number;
  epsilon?: number;
  scoreScale?: number;
}

export interface MLBotTrainOptions {
  epsilonStart?: number;
  epsilonEnd?: number;
  epsilonDecay?: number;
  maxTicks?: number;
  verbose?: boolean;
}

export declare class MLBot implements Bot {
  actions: (string | null)[];
  buckets: number;
  alpha: number;
  gamma: number;
  epsilon: number;
  scoreScale: number;

  constructor(options?: MLBotOptions);
  decide(game: GameAdapter): string | null;
  reset(): void;
  train(game: GameAdapter, episodes?: number, options?: MLBotTrainOptions): void;
  save(filePath: string): this;
  static load(filePath: string, options?: MLBotOptions): MLBot;
}
