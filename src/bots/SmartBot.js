class SmartBot {
  /**
   * @param {object} options
   * @param {'platformer'|'rhythm'|'tower'|'auto'} options.hint - 장르 힌트 (기본 'auto')
   * @param {number} options.scoreWindow - 점수 트렌드 추적 윈도우 틱 (기본 60)
   */
  constructor(options = {}) {
    this.hint = options.hint ?? 'auto';
    this.scoreWindow = options.scoreWindow ?? 60;

    this._tick = 0;
    this._scoreHistory = [];
    this._actionCooldown = 0;
    this._detectedHint = null;
  }

  reset() {
    this._tick = 0;
    this._scoreHistory = [];
    this._actionCooldown = 0;
    this._detectedHint = null;
  }

  decide(game) {
    this._tick++;

    const score = game.getScore();
    this._scoreHistory.push(score);
    if (this._scoreHistory.length > this.scoreWindow) {
      this._scoreHistory.shift();
    }

    if (this._actionCooldown > 0) {
      this._actionCooldown--;
      return null;
    }

    const d = game.getDifficulty();
    const trend = this._getScoreTrend();
    const hint = this._resolveHint(game);

    if (hint === 'platformer') return this._decidePlatformer(d, trend);
    if (hint === 'rhythm')     return this._decideRhythm(d, trend);
    if (hint === 'tower')      return this._decideTower(d, trend);
    return this._decideDefault(d, trend);
  }

  _getScoreTrend() {
    const h = this._scoreHistory;
    if (h.length < 20) return 0;
    const half = Math.floor(h.length / 2);
    const oldAvg = h.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const newAvg = h.slice(half).reduce((a, b) => a + b, 0) / (h.length - half);
    return newAvg - oldAvg;
  }

  _resolveHint(game) {
    if (this.hint !== 'auto') return this.hint;
    if (this._detectedHint) return this._detectedHint;
    // 내부 필드 한 번만 체크 (auto 감지)
    if (game.obstacles && Array.isArray(game.obstacles)) this._detectedHint = 'platformer';
    else if (game.notes && Array.isArray(game.notes))    this._detectedHint = 'rhythm';
    else if (game.stackedBlocks)                          this._detectedHint = 'tower';
    else                                                  this._detectedHint = 'platformer';
    return this._detectedHint;
  }

  _decidePlatformer(d, trend) {
    let prob = d < 0.3 ? 0.25 : d < 0.6 ? 0.15 : 0.08;
    if (trend < 0) prob += 0.05;
    if (Math.random() < prob) {
      this._actionCooldown = Math.round(15 + d * 25);
      return 'action';
    }
    return null;
  }

  _decideRhythm(d, trend) {
    let interval = Math.round(15 + d * 45);
    if (trend < 0) interval = Math.max(10, interval - 5);
    return this._tick % interval === 0 ? 'action' : null;
  }

  _decideTower(d, trend) {
    let prob = 0.02 + (1 - d) * 0.03;
    if (trend < 0) prob += 0.01;
    return Math.random() < prob ? 'action' : null;
  }

  _decideDefault(d, trend) {
    const prob = 0.04 * (1 - d * 0.5);
    return Math.random() < prob ? 'action' : null;
  }
}

module.exports = SmartBot;
