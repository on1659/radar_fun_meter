/**
 * FunMeter - Flow Theory 기반 게임 재미 분석 엔진
 *
 * Flow Zone 판정 기준 (시간 모드, 기본):
 * - 생존 시간 분포로 난이도 균형 측정
 * - 너무 빨리 죽음 (중앙값 < 5초) → 너무 어려움
 * - 너무 오래 생존 (타임아웃 > 50%) → 너무 쉬움
 * - 그 사이 → FLOW Zone
 *
 * Flow Zone 판정 기준 (레벨 모드, levelMode=true):
 * - 달성 레벨 중앙값으로 판정 (StackTower 등 레벨 기반 게임에 적합)
 * - 중앙값 < levelFlowMinMedian → 너무 어려움
 * - 중앙값 > levelFlowMaxMedian → 너무 쉬움
 */

const GENRE_PRESETS = {
  action:   { minMedian: 5,  maxTimeoutRate: 0.3 },
  rhythm:   { minMedian: 10, maxTimeoutRate: 0.4 },
  puzzle:   { minMedian: 15, maxTimeoutRate: 0.6 },
  survival: { minMedian: 8,  maxTimeoutRate: 0.2 },
};

class FunMeter {
  constructor(options = {}) {
    this.ticksPerSecond = options.ticksPerSecond ?? 60;
    this.maxSeconds = options.maxSeconds ?? 60;  // 이 이상 생존하면 "너무 쉬움"

    // genre + flowCriteria 병합
    const preset = GENRE_PRESETS[options.genre] ?? {};
    const criteria = { ...preset, ...(options.flowCriteria ?? {}) };

    this.flowMinMedian  = criteria.minMedian     ?? options.flowMinMedian  ?? 5;
    this.flowMaxTimeout = criteria.maxTimeoutRate ?? options.flowMaxTimeout ?? 0.5;

    // 레벨 기반 FLOW 판정 (StackTower 등 레벨이 핵심 지표인 게임)
    this.levelMode = options.levelMode ?? false;
    this.levelFlowMinMedian = options.levelFlowMinMedian ?? 5;   // FLOW 최소 레벨 중앙값
    this.levelFlowMaxMedian = options.levelFlowMaxMedian ?? 25;  // FLOW 최대 레벨 중앙값

    // 메타 저장 (print·리포터에서 표시용)
    this.genre = options.genre ?? null;

    // 진행률 콜백 (서버 SSE 연동용)
    this.onProgress = options.onProgress ?? null;
  }

  /**
   * 게임을 N번 플레이하고 분석
   * @param {GameAdapter} game
   * @param {Bot} bot
   * @param {number} runs
   * @param {object} options - { verbose: boolean }
   * @returns {object} 분석 결과
   */
  run(game, bot, runs = 100, options = {}) {
    const times = [];
    const scores = [];
    const levels = [];
    let timeouts = 0;
    const maxTicks = this.maxSeconds * this.ticksPerSecond;
    const supportsLevel = typeof game.getLevel === 'function';
    const verbose = options.verbose ?? true;

    const CURVE_BUCKETS = 20;
    const sampleInterval = Math.max(1, Math.floor(maxTicks / CURVE_BUCKETS));
    const allCurves = [];

    for (let i = 0; i < runs; i++) {
      game.reset();
      if (bot.reset) bot.reset(); // 봇 상태 초기화 (HumanLikeBot 등)
      let ticks = 0;
      const curveSamples = [];

      while (game.isAlive() && ticks < maxTicks) {
        if (ticks % sampleInterval === 0) {
          curveSamples.push(game.getScore());
        }
        const input = bot.decide(game);
        game.update(input);
        ticks++;
      }

      // 마지막 점수로 빈 버킷 채우기 (게임이 일찍 종료된 경우)
      const finalScore = game.getScore();
      while (curveSamples.length < CURVE_BUCKETS) curveSamples.push(finalScore);
      allCurves.push(curveSamples.slice(0, CURVE_BUCKETS));

      const elapsed = ticks / this.ticksPerSecond;
      if (ticks >= maxTicks) timeouts++;

      times.push(elapsed);
      scores.push(game.getScore());
      if (supportsLevel) {
        const lv = game.getLevel();
        if (lv !== null) levels.push(lv);
      }

      // 진행률 표시 (10회마다 또는 마지막)
      if (verbose && (i % 10 === 0 || i === runs - 1)) {
        const pct = Math.round(((i + 1) / runs) * 100);
        const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
        process.stdout.write(`\r진행: [${bar}] ${pct}% (${i + 1}/${runs})`);
      }
      if (this.onProgress) {
        this.onProgress({ run: i + 1, total: runs, elapsed, score: game.getScore() });
      }
    }

    if (verbose) process.stdout.write('\n'); // 진행률 라인 마무리
    return this._analyze(game.getName(), times, scores, levels, timeouts, runs, allCurves);
  }

  _analyze(name, times, scores, levels, timeouts, runs, allCurves) {
    const sorted = [...times].sort((a, b) => a - b);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const median = this._percentile(sorted, 50);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const timeoutRate = timeouts / runs;

    // 표준편차
    const variance = times.reduce((acc, t) => acc + (t - mean) ** 2, 0) / times.length;
    const stddev = Math.sqrt(variance);

    // 퍼센타일
    const p25 = this._percentile(sorted, 25);
    const p75 = this._percentile(sorted, 75);
    const p90 = this._percentile(sorted, 90);
    const p95 = this._percentile(sorted, 95);

    // 히스토그램 (10개 버킷)
    const histogram = this._histogram(times, min, max, 10);

    // 점수 통계
    const sortedScores = [...scores].sort((a, b) => a - b);
    const scoreMean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const scoreMax = sortedScores[sortedScores.length - 1];

    // 레벨 통계 (게임이 실제 레벨 값을 반환할 때만)
    let levelStats = null;
    if (levels.length > 0) {
      const sortedLevels = [...levels].sort((a, b) => a - b);
      levelStats = {
        mean: levels.reduce((a, b) => a + b, 0) / levels.length,
        median: this._percentile(sortedLevels, 50),
        max: sortedLevels[sortedLevels.length - 1],
        p25: this._percentile(sortedLevels, 25),
        p75: this._percentile(sortedLevels, 75),
      };
    }

    // Flow Zone 판정
    let zone, emoji, advice;
    if (this.levelMode && levelStats) {
      // 레벨 기반 판정 (StackTower 등)
      const lm = levelStats.median;
      if (lm < this.levelFlowMinMedian) {
        zone = 'TOO_HARD';
        emoji = '😵';
        advice = `너무 어려워. 봇 오차 또는 초기 난이도를 낮춰봐. (중앙값 레벨: ${lm.toFixed(1)})`;
      } else if (lm > this.levelFlowMaxMedian) {
        zone = 'TOO_EASY';
        emoji = '😴';
        advice = `너무 쉬워. 난이도 상승 속도를 높여봐. (중앙값 레벨: ${lm.toFixed(1)})`;
      } else {
        zone = 'FLOW';
        emoji = '✅';
        advice = `균형 잘 잡혔어. 레벨 ${this.levelFlowMinMedian}~${this.levelFlowMaxMedian} 범위 유지하면 됨.`;
      }
    } else {
      // 시간 기반 판정 (기본)
      if (median < this.flowMinMedian) {
        zone = 'TOO_HARD';
        emoji = '😵';
        advice = `너무 어려워. 초기 난이도를 낮춰봐. (중앙값 생존: ${median.toFixed(1)}초)`;
      } else if (timeoutRate > this.flowMaxTimeout) {
        zone = 'TOO_EASY';
        emoji = '😴';
        advice = `너무 쉬워. 난이도 상승 속도를 높여봐. (타임아웃: ${(timeoutRate*100).toFixed(0)}%)`;
      } else {
        zone = 'FLOW';
        emoji = '✅';
        advice = '균형 잘 잡혔어. 난이도 상승 곡선 유지하면 됨.';
      }
    }

    // scoreCurve 분석 (allCurves가 있을 때만)
    const scoreCurve = allCurves && allCurves.length > 0
      ? this._analyzeScoreCurve(allCurves, this.maxSeconds)
      : null;

    // 사망 패턴 분석
    const deathPattern = this.computeDeathPattern(times);

    // suggestions 생성
    const suggestions = this._generateSuggestions(zone, {
      median, timeoutRate, levelStats,
      scoreCurve, deathPattern,
    });

    return {
      name, times, scores, levels,
      mean, median, min, max, stddev,
      p25, p75, p90, p95,
      histogram,
      timeoutRate,
      scoreMean, scoreMax,
      levelStats,
      levelMode: this.levelMode,
      zone, emoji, advice, runs,
      suggestions,
      scoreCurve,
      deathPattern,
    };
  }

  /**
   * 점수 곡선 분석
   * @param {number[][]} allCurves - runs × CURVE_BUCKETS 2D 배열
   * @param {number} maxSeconds
   * @returns {object} { buckets, pattern, growth1H, growth2H, growthRatio }
   */
  _analyzeScoreCurve(allCurves, maxSeconds) {
    const CURVE_BUCKETS = allCurves[0]?.length ?? 20;
    const buckets = Array.from({ length: CURVE_BUCKETS }, (_, i) => {
      const vals = allCurves.map(curve => curve[i] ?? 0);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });

    const halfIdx = Math.floor(CURVE_BUCKETS / 2);
    const timePerBucket = maxSeconds / CURVE_BUCKETS;

    // 전반부: 버킷 0 → halfIdx
    const growth1H = halfIdx > 0
      ? (buckets[halfIdx] - buckets[0]) / (halfIdx * timePerBucket)
      : 0;

    // 후반부: halfIdx → CURVE_BUCKETS-1
    const growth2H = (CURVE_BUCKETS - halfIdx - 1) > 0
      ? (buckets[CURVE_BUCKETS - 1] - buckets[halfIdx])
          / ((CURVE_BUCKETS - halfIdx - 1) * timePerBucket)
      : 0;

    const growthRatio = growth1H > 0.001 ? growth2H / growth1H : 1;

    // 패턴 분류
    const totalGrowth = (buckets[CURVE_BUCKETS - 1] - buckets[0]);
    let pattern;
    if (totalGrowth < 1) {
      pattern = 'FLAT';          // 점수가 거의 안 오름 → 너무 어렵거나 점수 시스템 없음
    } else if (growthRatio >= 1.5) {
      pattern = 'EXPONENTIAL';   // 후반에 폭발적 성장 → 생존자 편향
    } else {
      pattern = 'LINEAR';        // 균등 성장 → 건강한 게임플레이
    }

    return { buckets, pattern, growth1H, growth2H, growthRatio };
  }

  /**
   * 사망 패턴 분석 (왜도·첨도·클러스터)
   * @param {number[]} times - 생존 시간 배열
   * @returns {{ skewness: number, kurtosis: number, cluster: string }}
   */
  computeDeathPattern(times) {
    const n = times.length;
    if (n < 2) return { skewness: 0, kurtosis: 0, cluster: 'uniform' };

    const mean = times.reduce((a, b) => a + b, 0) / n;
    const variance = times.reduce((acc, t) => acc + (t - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);

    if (stddev < 1e-9) {
      return { skewness: 0, kurtosis: 0, cluster: 'uniform' };
    }

    // 표본 왜도 (Fisher-Pearson g1)
    const skewness = n < 3 ? 0
      : (n / ((n - 1) * (n - 2)))
        * times.reduce((acc, t) => acc + ((t - mean) / stddev) ** 3, 0);

    // 초과 첨도
    const kurtosis = (times.reduce((acc, t) => acc + ((t - mean) / stddev) ** 4, 0) / n) - 3;

    const cluster = skewness > 1.0 ? 'early'
      : skewness < -1.0 ? 'late'
      : 'uniform';

    return {
      skewness: Math.round(skewness * 1000) / 1000,
      kurtosis: Math.round(kurtosis * 1000) / 1000,
      cluster,
    };
  }

  /**
   * 파라미터 조정 제안 생성
   * @param {string} zone - 'TOO_HARD' | 'TOO_EASY' | 'FLOW'
   * @param {object} stats - { median, timeoutRate, levelStats, scoreCurve, deathPattern }
   * @returns {string[]}
   */
  _generateSuggestions(zone, stats) {
    const suggestions = [];
    const { median, timeoutRate, scoreCurve, deathPattern } = stats;

    if (zone === 'TOO_HARD') {
      suggestions.push('초기 난이도를 낮추거나 초반 진입 장벽을 줄여보세요.');
      if (median < 2) {
        suggestions.push('봇이 2초 이내에 사망합니다. 난이도 파라미터를 20~30% 이상 낮춰야 효과가 있을 수 있습니다.');
      }
      if (scoreCurve?.pattern === 'FLAT') {
        suggestions.push('점수가 거의 쌓이지 않습니다. 생존 시간 자체를 늘리는 것이 우선입니다.');
      }
    } else if (zone === 'TOO_EASY') {
      suggestions.push('난이도 상승 속도를 높이거나 초기 난이도를 올려보세요.');
      if (timeoutRate > 0.8) {
        suggestions.push(`${Math.round(timeoutRate * 100)}%가 제한 시간까지 생존합니다. 타임아웃 기준 또는 난이도를 조정하세요.`);
      }
      if (scoreCurve?.pattern === 'EXPONENTIAL') {
        suggestions.push('후반 점수 성장이 매우 가파릅니다. 시간이 갈수록 쉬워지는 구조인지 확인하세요.');
      }
    } else {
      // FLOW
      suggestions.push('현재 설정이 Flow Zone에 있습니다. 이 난이도 범위를 유지하세요.');
      if (scoreCurve?.pattern === 'EXPONENTIAL') {
        suggestions.push('점수 증가가 후반에 집중됩니다. 초반 보상 구조도 점검해보세요.');
      }
    }

    // 패턴 기반 추가 제안
    if (deathPattern?.cluster === 'early') {
      suggestions.push('초반 사망이 집중됩니다. 첫 10초의 장애물 밀도나 속도를 줄여보세요.');
    } else if (deathPattern?.cluster === 'late') {
      suggestions.push('대부분 후반까지 생존합니다. 후반 난이도 상승 구간을 점검하세요.');
    }

    return suggestions;
  }

  /**
   * 정렬된 배열에서 퍼센타일 값 반환 (선형 보간)
   */
  _percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  /**
   * 히스토그램 생성
   * @returns {Array<{from, to, count, bar}>}
   */
  _histogram(values, min, max, buckets) {
    if (min === max) return [{ from: min, to: max, count: values.length, bar: '█'.repeat(10) }];
    const step = (max - min) / buckets;
    const hist = Array.from({ length: buckets }, (_, i) => ({
      from: min + i * step,
      to: min + (i + 1) * step,
      count: 0,
    }));
    for (const v of values) {
      const idx = Math.min(Math.floor((v - min) / step), buckets - 1);
      hist[idx].count++;
    }
    const maxCount = Math.max(...hist.map(h => h.count), 1);
    for (const h of hist) {
      h.bar = '█'.repeat(Math.round((h.count / maxCount) * 15));
    }
    return hist;
  }

  /**
   * 결과를 보기 좋게 출력
   */
  print(result) {
    const bar = '─'.repeat(50);
    const modeTag = result.levelMode ? ' [레벨 모드]' : '';
    console.log(`\n📊 결과: ${result.name} (${result.runs}회)${modeTag}`);
    console.log(bar);

    console.log(`생존 시간`);
    console.log(`  평균:   ${result.mean.toFixed(1)}s  (σ=${result.stddev.toFixed(1)}s)`);
    console.log(`  중앙값: ${result.median.toFixed(1)}s`);
    console.log(`  범위:   ${result.min.toFixed(1)}s ~ ${result.max.toFixed(1)}s`);
    console.log(`  p25/p75/p90: ${result.p25.toFixed(1)}s / ${result.p75.toFixed(1)}s / ${result.p90.toFixed(1)}s`);

    // 히스토그램
    console.log(`\n분포 (히스토그램)`);
    for (const h of result.histogram) {
      const label = `${h.from.toFixed(1)}~${h.to.toFixed(1)}s`.padEnd(14);
      console.log(`  ${label} ${h.bar} (${h.count})`);
    }

    console.log(`\n점수`);
    console.log(`  평균:   ${Math.round(result.scoreMean)}`);
    console.log(`  최고:   ${result.scoreMax}`);

    // 레벨 통계 (지원 시)
    if (result.levelStats) {
      const ls = result.levelStats;
      console.log(`\n레벨`);
      console.log(`  평균:   ${ls.mean.toFixed(1)}`);
      console.log(`  중앙값: ${ls.median.toFixed(1)}`);
      console.log(`  범위:   p25=${ls.p25.toFixed(1)} / p75=${ls.p75.toFixed(1)} / max=${ls.max}`);
    }

    console.log(`\n타임아웃: ${(result.timeoutRate * 100).toFixed(0)}%`);
    console.log(bar);
    console.log(`\n${result.emoji} ${result.zone === 'FLOW' ? 'FLOW Zone! (재밌을 가능성 높음)' : result.zone === 'TOO_HARD' ? '너무 어려움' : '너무 쉬움'}`);
    console.log(`💡 ${result.advice}\n`);

    // suggestions 출력
    if (result.suggestions?.length > 0) {
      console.log('\n제안');
      for (const s of result.suggestions) {
        console.log(`  • ${s}`);
      }
    }

    // scoreCurve 패턴 출력
    if (result.scoreCurve) {
      const { pattern, growth1H, growth2H } = result.scoreCurve;
      console.log(`\n점수 곡선: ${pattern} (전반 ${growth1H.toFixed(1)}/s → 후반 ${growth2H.toFixed(1)}/s)`);
    }
  }

  /**
   * Worker threads를 이용한 병렬 실행
   * @param {string} gameFile  - 절대 경로 (require 가능)
   * @param {string} botFile   - 절대 경로 (require 가능)
   * @param {object} gameConfig
   * @param {object} botOptions
   * @param {number} runs
   * @param {number} parallel  - Worker 수
   * @returns {Promise<object>} _analyze() 결과
   */
  async runParallel(gameFile, botFile, gameConfig, botOptions, runs, parallel) {
    const { Worker } = require('worker_threads');
    const path = require('path');
    const workerScript = path.join(__dirname, 'worker', 'runnerWorker.js');

    const maxTicks = this.maxSeconds * this.ticksPerSecond;
    const CURVE_BUCKETS = 20;
    const sampleInterval = Math.max(1, Math.floor(maxTicks / CURVE_BUCKETS));

    // runs를 Worker 수로 균등 분배
    const chunkSize = Math.floor(runs / parallel);
    const remainder = runs % parallel;
    const chunks = Array.from({ length: parallel }, (_, i) =>
      chunkSize + (i < remainder ? 1 : 0)
    );

    let completedRuns = 0;
    const allTimes = [], allScores = [], allLevels = [];
    let totalTimeouts = 0;
    const allCurves = [];

    const workerPromises = chunks.map((chunkRuns) =>
      new Promise((resolve, reject) => {
        const w = new Worker(workerScript, {
          workerData: {
            gameFile, botFile, botOptions, gameConfig,
            runs: chunkRuns, maxTicks, sampleInterval, CURVE_BUCKETS,
            ticksPerSecond: this.ticksPerSecond,
          },
        });

        // 타임아웃: 지정 시간 초과 시 Worker 강제 종료
        const timeoutMs = module.exports.WORKER_TIMEOUT_MS;
        const timer = setTimeout(() => {
          w.terminate();
          reject(new Error(`Worker 타임아웃 (${timeoutMs / 1000}초 초과)`));
        }, timeoutMs);

        const cleanup = () => clearTimeout(timer);

        w.on('message', (msg) => {
          if (msg.type === 'progress') {
            completedRuns++;
            if (this.onProgress) {
              this.onProgress({ run: completedRuns, total: runs, elapsed: msg.elapsed, score: msg.score });
            }
            // 진행률 바 출력
            if (completedRuns % 10 === 0 || completedRuns === runs) {
              const pct = Math.round((completedRuns / runs) * 100);
              const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
              process.stdout.write(`\r진행: [${bar}] ${pct}% (${completedRuns}/${runs})`);
            }
          } else if (msg.type === 'result') {
            cleanup();
            resolve(msg);
          } else if (msg.type === 'error') {
            cleanup();
            reject(new Error(`Worker 에러: ${msg.message}`));
          }
        });

        w.on('error', (err) => { cleanup(); reject(err); });
        w.on('exit', (code) => {
          cleanup();
          if (code !== 0) reject(new Error(`Worker 종료 코드: ${code}`));
        });
      })
    );

    const results = await Promise.all(workerPromises);
    process.stdout.write('\n');

    // 결과 집계
    for (const r of results) {
      allTimes.push(...r.times);
      allScores.push(...r.scores);
      allLevels.push(...r.levels);
      totalTimeouts += r.timeouts;
      allCurves.push(...r.allCurves);
    }

    // 게임 이름 취득 (인스턴스 없이)
    const GameClass = require(gameFile);
    const tempGame = new GameClass(gameConfig);
    const name = tempGame.getName();

    return this._analyze(name, allTimes, allScores, allLevels, totalTimeouts, runs, allCurves);
  }

  /**
   * 브라우저 게임을 비동기 폴링 루프로 N번 플레이하고 분석
   * @param {BrowserGameAdapter} browserAdapter
   * @param {BrowserBot} bot
   * @param {object} [options]
   * @param {number} [options.pollInterval] - 폴링 주기 ms (기본: 50)
   * @param {number} [options.maxSeconds] - 최대 생존 시간 초 (기본: this.maxSeconds)
   * @param {number} [options.runs] - 실행 횟수 (기본: 30)
   * @returns {Promise<object>} RunResult
   */
  async runBrowser(browserAdapter, bot, options = {}) {
    const {
      pollInterval = 50,
      maxSeconds = this.maxSeconds,
      runs = 30,
    } = options;

    await browserAdapter.init();

    const times = [];
    const scores = [];
    let timeouts = 0;

    for (let i = 0; i < runs; i++) {
      await browserAdapter.reset();
      if (bot.reset) bot.reset();

      const startTime = Date.now();

      while (true) {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= maxSeconds) {
          times.push(maxSeconds);
          timeouts++;
          break;
        }

        const alive = await browserAdapter.isAlive();
        if (!alive) {
          times.push(elapsed);
          break;
        }

        const score = await browserAdapter.getScore();
        const action = await Promise.resolve(
          bot.act ? bot.act({ score, elapsed }) : bot.update(null)
        );
        await browserAdapter.update(action);

        await new Promise(r => setTimeout(r, pollInterval));
      }

      scores.push(await browserAdapter.getScore());
    }

    await browserAdapter.close();

    return this._analyze(browserAdapter.getName(), times, scores, [], timeouts, runs, []);
  }
}

/**
 * 파라미터 정보가 있을 때 더 구체적인 제안 생성
 * @param {object} result - FunMeter.run() 결과
 * @param {object} param  - { name, min, max, hardDirection, currentValue }
 * @returns {string[]}
 */
function generateSuggestions(result, param) {
  const suggestions = [...(result.suggestions ?? [])];

  if (!param?.name || param.currentValue === undefined) return suggestions;

  const { name, min, max, hardDirection, currentValue } = param;
  const range = max - min;
  const pct10 = range * 0.1;

  if (result.zone === 'TOO_HARD') {
    // 어렵게 만드는 방향의 반대로 조정
    if (hardDirection === 'higher') {
      const suggested = Math.max(min, currentValue - pct10).toFixed(2);
      suggestions.push(`'${name}'를 ${currentValue.toFixed(2)} → ${suggested} 으로 낮추면 FLOW Zone에 가까워질 수 있습니다.`);
    } else {
      const suggested = Math.min(max, currentValue + pct10).toFixed(2);
      suggestions.push(`'${name}'를 ${currentValue.toFixed(2)} → ${suggested} 으로 높이면 FLOW Zone에 가까워질 수 있습니다.`);
    }
  } else if (result.zone === 'TOO_EASY') {
    if (hardDirection === 'higher') {
      const suggested = Math.min(max, currentValue + pct10).toFixed(2);
      suggestions.push(`'${name}'를 ${currentValue.toFixed(2)} → ${suggested} 으로 높이면 FLOW Zone에 가까워질 수 있습니다.`);
    } else {
      const suggested = Math.max(min, currentValue - pct10).toFixed(2);
      suggestions.push(`'${name}'를 ${currentValue.toFixed(2)} → ${suggested} 으로 낮추면 FLOW Zone에 가까워질 수 있습니다.`);
    }
  }

  return suggestions;
}

module.exports = FunMeter;
module.exports.generateSuggestions = generateSuggestions;
module.exports.GENRE_PRESETS = GENRE_PRESETS;
module.exports.WORKER_TIMEOUT_MS = 5 * 60 * 1000; // 5분 (테스트에서 monkey-patch 가능)
