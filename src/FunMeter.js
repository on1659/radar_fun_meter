/**
 * FunMeter - Flow Theory 기반 게임 재미 분석 엔진
 *
 * Flow Zone 판정 기준:
 * - 생존 시간 분포로 난이도 균형 측정
 * - 너무 빨리 죽음 (중앙값 < 5초) → 너무 어려움
 * - 너무 오래 생존 (타임아웃 > 50%) → 너무 쉬움
 * - 그 사이 → FLOW Zone
 */
class FunMeter {
  constructor(options = {}) {
    this.ticksPerSecond = options.ticksPerSecond ?? 60;
    this.maxSeconds = options.maxSeconds ?? 60;  // 이 이상 생존하면 "너무 쉬움"
    this.flowMinMedian = options.flowMinMedian ?? 5;   // 중앙값 최소 (초)
    this.flowMaxTimeout = options.flowMaxTimeout ?? 0.5; // 타임아웃 비율 최대
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
    let timeouts = 0;
    const maxTicks = this.maxSeconds * this.ticksPerSecond;

    for (let i = 0; i < runs; i++) {
      game.reset();
      let ticks = 0;
      let timedOut = false;

      while (game.isAlive() && ticks < maxTicks) {
        const input = bot.decide(game);
        game.update(input);
        ticks++;
      }

      const elapsed = ticks / this.ticksPerSecond;
      if (ticks >= maxTicks) {
        timedOut = true;
        timeouts++;
      }

      times.push(elapsed);
      scores.push(game.getScore());
    }

    return this._analyze(game.getName(), times, scores, timeouts, runs);
  }

  _analyze(name, times, scores, timeouts, runs) {
    const sorted = [...times].sort((a, b) => a - b);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const timeoutRate = timeouts / runs;

    const sortedScores = [...scores].sort((a, b) => a - b);
    const scoreMean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const scoreMax = sortedScores[sortedScores.length - 1];

    // Flow Zone 판정
    let zone, emoji, advice;
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

    return { name, times, scores, mean, median, min, max, timeoutRate, scoreMean, scoreMax, zone, emoji, advice, runs };
  }

  /**
   * 결과를 보기 좋게 출력
   */
  print(result) {
    const bar = '─'.repeat(40);
    console.log(`\n📊 결과: ${result.name}`);
    console.log(bar);
    console.log(`생존 시간`);
    console.log(`  평균:   ${result.mean.toFixed(1)}초`);
    console.log(`  중앙값: ${result.median.toFixed(1)}초`);
    console.log(`  최소:   ${result.min.toFixed(1)}초`);
    console.log(`  최대:   ${result.max.toFixed(1)}초`);
    console.log(`점수`);
    console.log(`  평균:   ${Math.round(result.scoreMean)}`);
    console.log(`  최고:   ${result.scoreMax}`);
    console.log(`타임아웃: ${(result.timeoutRate * 100).toFixed(0)}%`);
    console.log(bar);
    console.log(`\n${result.emoji} ${result.zone === 'FLOW' ? 'FLOW Zone! (재밌을 가능성 높음)' : result.zone === 'TOO_HARD' ? '너무 어려움' : '너무 쉬움'}`);
    console.log(`💡 ${result.advice}\n`);
  }
}

module.exports = FunMeter;
