/**
 * FunMeter - 범용 게임 재미 측정 엔진
 * Flow Theory 기반: 실력 vs 난이도 균형이 재미를 결정
 */

class FunMeter {
  constructor(options = {}) {
    this.runs = options.runs || 100;        // 시뮬레이션 횟수
    this.maxTicks = options.maxTicks || 3600; // 최대 프레임 (60fps * 60초)
    this.ticksPerSecond = options.ticksPerSecond || 60;
  }

  /**
   * 메인 분석 실행
   * @param {GameAdapter} gameAdapter - 게임 어댑터 인스턴스
   * @param {Function} botStrategy - 봇 전략 함수 (game) => input
   * @returns {Object} 분석 결과
   */
  analyze(gameAdapter, botStrategy) {
    const results = [];

    for (let run = 0; run < this.runs; run++) {
      gameAdapter.reset();
      const runData = this._playOneRun(gameAdapter, botStrategy);
      results.push(runData);
    }

    return this._buildReport(gameAdapter.getName(), results);
  }

  /**
   * 단일 게임 실행
   */
  _playOneRun(game, botStrategy) {
    const scoreHistory = [];
    const difficultyHistory = [];
    let tick = 0;

    while (game.isAlive() && tick < this.maxTicks) {
      const input = botStrategy(game, tick);
      game.update(input);
      tick++;

      if (tick % 10 === 0) { // 10프레임마다 샘플링
        scoreHistory.push(game.getScore());
        difficultyHistory.push(game.getDifficulty());
      }
    }

    const survivalSeconds = tick / this.ticksPerSecond;
    const finalScore = game.getScore();
    const peakDifficulty = Math.max(...difficultyHistory, 0);
    const avgDifficulty = difficultyHistory.length > 0
      ? difficultyHistory.reduce((a, b) => a + b, 0) / difficultyHistory.length
      : 0;

    return {
      survivalSeconds,
      finalScore,
      peakDifficulty,
      avgDifficulty,
      scoreHistory,
      difficultyHistory,
      timedOut: tick >= this.maxTicks,
    };
  }

  /**
   * 분석 리포트 생성
   */
  _buildReport(gameName, results) {
    const survivals = results.map(r => r.survivalSeconds);
    const scores = results.map(r => r.finalScore);
    const timeouts = results.filter(r => r.timedOut).length;

    const avgSurvival = this._avg(survivals);
    const medianSurvival = this._median(survivals);
    const avgScore = this._avg(scores);
    const maxScore = Math.max(...scores);
    const timeoutRate = timeouts / results.length;

    // Flow Zone 판정
    const flowZone = this._calcFlowZone(avgSurvival, timeoutRate, results);

    return {
      gameName,
      runs: results.length,
      survival: {
        avg: Math.round(avgSurvival * 10) / 10,
        median: Math.round(medianSurvival * 10) / 10,
        min: Math.round(Math.min(...survivals) * 10) / 10,
        max: Math.round(Math.max(...survivals) * 10) / 10,
      },
      score: {
        avg: Math.round(avgScore),
        max: Math.round(maxScore),
      },
      timeoutRate: Math.round(timeoutRate * 100) + '%',
      flowZone,
      verdict: flowZone.verdict,
      suggestion: flowZone.suggestion,
    };
  }

  /**
   * Flow Zone 계산
   * - 봇이 너무 빨리 죽음 → 너무 어려움
   * - 봇이 타임아웃까지 생존 → 너무 쉬움
   * - 그 사이 → Flow (재밌을 가능성 높음)
   */
  _calcFlowZone(avgSurvival, timeoutRate, results) {
    const maxSeconds = this.maxTicks / this.ticksPerSecond;

    // 타임아웃 비율 기준
    if (timeoutRate > 0.5) {
      return {
        zone: 'TOO_EASY',
        verdict: '😴 너무 쉬움',
        suggestion: '난이도를 올려야 해. 초기 속도 증가 or 장애물 빈도 증가.',
        score: 0.2,
      };
    }

    if (avgSurvival < 5) {
      return {
        zone: 'TOO_HARD',
        verdict: '😤 너무 어려움',
        suggestion: '너무 빨리 죽어. 초기 속도 낮추거나 장애물 간격 늘려야 해.',
        score: 0.2,
      };
    }

    if (avgSurvival < 15) {
      return {
        zone: 'CHALLENGING',
        verdict: '🔥 도전적 (약간 어려움)',
        suggestion: '캐주얼 유저엔 어려울 수 있어. 초반 5초 정도 여유 구간 추가 고려.',
        score: 0.7,
      };
    }

    if (avgSurvival < 45) {
      return {
        zone: 'FLOW',
        verdict: '✅ FLOW Zone! (재밌을 가능성 높음)',
        suggestion: '균형 잘 잡혔어. 난이도 상승 곡선 유지하면 됨.',
        score: 1.0,
      };
    }

    return {
      zone: 'TOO_EASY',
      verdict: '😴 약간 쉬움',
      suggestion: '오래 살아남네. 후반 난이도 상승 속도를 높여봐.',
      score: 0.5,
    };
  }

  _avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  _median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}

module.exports = FunMeter;
