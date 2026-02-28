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
class FunMeter {
  constructor(options = {}) {
    this.ticksPerSecond = options.ticksPerSecond ?? 60;
    this.maxSeconds = options.maxSeconds ?? 60;  // 이 이상 생존하면 "너무 쉬움"
    this.flowMinMedian = options.flowMinMedian ?? 5;   // 중앙값 최소 (초)
    this.flowMaxTimeout = options.flowMaxTimeout ?? 0.5; // 타임아웃 비율 최대

    // 레벨 기반 FLOW 판정 (StackTower 등 레벨이 핵심 지표인 게임)
    this.levelMode = options.levelMode ?? false;
    this.levelFlowMinMedian = options.levelFlowMinMedian ?? 5;   // FLOW 최소 레벨 중앙값
    this.levelFlowMaxMedian = options.levelFlowMaxMedian ?? 25;  // FLOW 최대 레벨 중앙값
  }

  /**
   * 게임을 N번 플레이하고 분석
   * @param {GameAdapter} game
   * @param {Bot} bot
   * @param {number} runs
   * @returns {object} 분석 결과
   */
  run(game, bot, runs = 100) {
    const times = [];
    const scores = [];
    const levels = [];
    let timeouts = 0;
    const maxTicks = this.maxSeconds * this.ticksPerSecond;
    const supportsLevel = typeof game.getLevel === 'function';

    for (let i = 0; i < runs; i++) {
      game.reset();
      if (bot.reset) bot.reset(); // 봇 상태 초기화 (HumanLikeBot 등)
      let ticks = 0;

      while (game.isAlive() && ticks < maxTicks) {
        const input = bot.decide(game);
        game.update(input);
        ticks++;
      }

      const elapsed = ticks / this.ticksPerSecond;
      if (ticks >= maxTicks) timeouts++;

      times.push(elapsed);
      scores.push(game.getScore());
      if (supportsLevel) {
        const lv = game.getLevel();
        if (lv !== null) levels.push(lv);
      }
    }

    return this._analyze(game.getName(), times, scores, levels, timeouts, runs);
  }

  _analyze(name, times, scores, levels, timeouts, runs) {
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
    };
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
  }
}

module.exports = FunMeter;
