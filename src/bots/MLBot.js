'use strict';

/**
 * MLBot — ε-greedy Q-Learning 기반 범용 강화학습 봇
 *
 * 사용법:
 *   const bot = new MLBot({ epsilon: 0.3, buckets: 10 });
 *   bot.train(game, 300);
 *   bot.epsilon = 0.0;  // 추론 모드
 *   const action = bot.decide(game);
 */
class MLBot {
  /**
   * @param {object} [options]
   * @param {(string|null)[]} [options.actions]    가능한 행동 목록 (기본: ['action', null])
   * @param {number} [options.buckets]             상태 차원당 이산화 구간 수 (기본: 10)
   * @param {number} [options.alpha]               학습률 (기본: 0.1)
   * @param {number} [options.gamma]               할인율 (기본: 0.9)
   * @param {number} [options.epsilon]             탐험율 0=순수추론 (기본: 0.0)
   * @param {number} [options.scoreScale]          점수 정규화 분모 (기본: 100)
   */
  constructor(options = {}) {
    this.actions    = options.actions    ?? ['action', null];
    this.buckets    = options.buckets    ?? 10;
    this.alpha      = options.alpha      ?? 0.1;
    this.gamma      = options.gamma      ?? 0.9;
    this.epsilon    = options.epsilon    ?? 0.0;
    this.scoreScale = options.scoreScale ?? 100;
    this._qTable    = {};
  }

  /** 에피소드 간 내부 상태 초기화 (Q-테이블은 유지) */
  reset() { /* Q-Learning에서는 에피소드 간 초기화할 임시 상태 없음 */ }

  /**
   * 게임 상태 벡터 획득
   * game.getStateVector()가 null이 아니면 우선 사용,
   * null이면 [score/scoreScale, difficulty] 폴백
   * @param {object} game
   * @returns {number[]}
   */
  _getStateVector(game) {
    const v = typeof game.getStateVector === 'function' ? game.getStateVector() : null;
    if (v) return v;
    return [Math.min(game.getScore() / this.scoreScale, 1), game.getDifficulty()];
  }

  /**
   * 연속 상태 벡터를 이산 키 문자열로 변환
   * 각 값을 [0, buckets-1] 정수로 클램핑/플로어 후 콤마로 결합
   * @param {number[]} vec
   * @returns {string}
   */
  _discretize(vec) {
    return vec
      .map(v => Math.min(Math.floor(Math.max(v, 0) * this.buckets), this.buckets - 1))
      .join(',');
  }

  /**
   * Q-테이블에서 값 조회 (없으면 0.0)
   * @param {string} key   상태 키
   * @param {string|null} action
   * @returns {number}
   */
  _getQ(key, action) {
    return this._qTable[key]?.[String(action)] ?? 0;
  }

  /**
   * Q-테이블 갱신
   * @param {string} key   상태 키
   * @param {string|null} action
   * @param {number} value
   */
  _setQ(key, action, value) {
    (this._qTable[key] ??= {})[String(action)] = value;
  }

  /**
   * 현재 상태에서 Q값 최대인 행동 반환
   * @param {string} key
   * @returns {string|null}
   */
  _bestAction(key) {
    return this.actions.reduce(
      (best, a) => this._getQ(key, a) > this._getQ(key, best) ? a : best,
      this.actions[0]
    );
  }

  /**
   * ε-greedy 행동 선택
   * @param {string} key
   * @param {number} [eps]  탐험율 (기본: this.epsilon)
   * @returns {string|null}
   */
  _selectAction(key, eps = this.epsilon) {
    if (Math.random() < eps)
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    return this._bestAction(key);
  }

  /**
   * 현재 게임 상태를 이산화해 행동 결정 (Q-테이블 갱신 없음)
   * FunMeter.run()에서 추론 전용으로 사용
   * @param {object} game
   * @returns {string|null}
   */
  decide(game) {
    const key = this._discretize(this._getStateVector(game));
    return this._selectAction(key);  // this.epsilon 사용
  }

  /**
   * Q-Learning 학습 루프 (FunMeter 없이 자체 실행)
   * @param {object} game          게임 어댑터 인스턴스
   * @param {number} [episodes]    학습 에피소드 수 (기본: 300)
   * @param {object} [options]
   * @param {number} [options.epsilonStart]  초기 탐험율 (기본: 0.3)
   * @param {number} [options.epsilonEnd]    최소 탐험율 (기본: 0.05)
   * @param {number} [options.epsilonDecay]  감쇠율 (기본: 0.995)
   * @param {number} [options.maxTicks]      에피소드 최대 틱 수 (기본: 3600)
   * @param {boolean} [options.verbose]      진행 로그 출력 여부 (기본: false)
   */
  train(game, episodes = 300, options = {}) {
    const {
      epsilonStart = 0.3,
      epsilonEnd   = 0.05,
      epsilonDecay = 0.995,
      maxTicks     = 3600,
      verbose      = false,
    } = options;

    let eps = epsilonStart;

    for (let ep = 0; ep < episodes; ep++) {
      game.reset();
      let prevKey = null, prevAction = null, prevScore = 0, tick = 0;

      while (game.isAlive() && tick < maxTicks) {
        const key = this._discretize(this._getStateVector(game));

        if (prevKey !== null) {
          const reward   = game.getScore() - prevScore;
          const bestNext = Math.max(...this.actions.map(a => this._getQ(key, a)));
          const oldQ     = this._getQ(prevKey, prevAction);
          this._setQ(prevKey, prevAction, oldQ + this.alpha * (reward + this.gamma * bestNext - oldQ));
        }

        const action = this._selectAction(key, eps);  // 감쇠 eps 명시적 전달

        game.update(action);
        prevKey    = key;
        prevAction = action;
        prevScore  = game.getScore();
        tick++;
      }

      // 종료 상태 패널티
      if (prevKey !== null) {
        const oldQ = this._getQ(prevKey, prevAction);
        this._setQ(prevKey, prevAction, oldQ + this.alpha * (-10 - oldQ));
      }

      eps = Math.max(epsilonEnd, eps * epsilonDecay);

      if (verbose && (ep + 1) % 100 === 0)
        console.log(`[MLBot] ep ${ep + 1}/${episodes} ε=${eps.toFixed(3)} states=${Object.keys(this._qTable).length}`);
    }
  }

  /**
   * Q-테이블 + 하이퍼파라미터를 JSON 파일로 저장
   * @param {string} filePath
   * @returns {this}
   */
  save(filePath) {
    const fs = require('fs');
    fs.writeFileSync(filePath, JSON.stringify({
      version: '1.0',
      actions: this.actions,
      buckets: this.buckets,
      alpha:   this.alpha,
      gamma:   this.gamma,
      qTable:  this._qTable,
    }, null, 2), 'utf8');
    return this;
  }

  /**
   * JSON 파일에서 학습된 Q-테이블을 로드해 MLBot 인스턴스 반환
   * @param {string} filePath
   * @param {object} [options]   MLBotOptions (epsilon 등 오버라이드)
   * @returns {MLBot}
   */
  static load(filePath, options = {}) {
    const fs   = require('fs');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const bot  = new MLBot({ ...data, epsilon: options.epsilon ?? 0.0, ...options });
    bot._qTable = data.qTable;
    // 방어적: 수동 JSON 편집 시 "null" 문자열 → null 역변환
    bot.actions = data.actions.map(a => a === 'null' ? null : a);
    return bot;
  }
}

module.exports = MLBot;
