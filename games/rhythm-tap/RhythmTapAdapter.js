/**
 * 리듬 탭 어댑터
 * 봇은 타겟 존에 노트가 가까워지면 탭
 */
const GameAdapter = require('../../src/GameAdapter');

const GAME_CONFIG = {
  gameWidth: 600,
  gameHeight: 400,
  laneCount: 4,
  noteHeight: 20,
  noteSpeed: 3,
  speedIncrement: 0.0005,
  targetY: 320,
  targetHeight: 40,
  perfectRange: 15,
  greatRange: 30,
  goodRange: 50,
  perfectScore: 100,
  greatScore: 50,
  goodScore: 20,
};

class RhythmTapAdapter extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this._cfg = { ...GAME_CONFIG, ...config };
    // 봇 정확도 (0=완벽, 1=랜덤): 기본 중간 수준
    this.botAccuracy = config.botAccuracy ?? 0.3; // 오차 범위 (px)
  }

  reset() {
    const cfg = this._cfg;
    this.notes = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.frameCount = 0;
    this.speed = cfg.noteSpeed;
    this.alive = true;
    this.missCount = 0;
    this.nextNoteIn = 10;
    this._noteIdCounter = 0;
    this.stats = { perfect: 0, great: 0, good: 0, miss: 0 };
  }

  update(input) {
    if (!this.alive) return;

    const cfg = this._cfg;
    this.frameCount++;
    this._time = this.frameCount / 60;
    this.speed = cfg.noteSpeed + this.frameCount * cfg.speedIncrement;

    // 노트 스폰
    this.nextNoteIn--;
    if (this.nextNoteIn <= 0) {
      const lane = Math.floor(Math.random() * cfg.laneCount);
      this.notes.push({ id: ++this._noteIdCounter, lane, y: 0, hit: false });
      this.nextNoteIn = Math.max(30, 80 - Math.floor(this.frameCount / 100));
    }

    // 봇 자동 탭: 타겟 존에 가까운 노트 탭
    const lanesWithNotes = new Set();
    for (const note of this.notes) {
      if (!note.hit) {
        const dist = Math.abs(note.y - cfg.targetY);
        // 봇 정확도에 따른 오차 포함
        const effectiveRange = cfg.perfectRange + this.botAccuracy * cfg.goodRange;
        if (dist <= effectiveRange) {
          lanesWithNotes.add(note.lane);
        }
      }
    }

    // 해당 레인 탭
    for (const lane of lanesWithNotes) {
      this._tap(lane);
    }

    // 노트 이동 + 미스 처리
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if (!note.hit) {
        note.y += this.speed;
        if (note.y > cfg.targetY + cfg.goodRange) {
          note.hit = true;
          this.combo = 0;
          this.stats.miss++;
          this.missCount++;
        }
      }
      if (note.y > cfg.gameHeight) {
        this.notes.splice(i, 1);
      }
    }

    // 게임 오버 조건
    if (this.frameCount >= 60 * 60 || this.missCount >= 20) {
      this.alive = false;
    }
  }

  _tap(lane) {
    const cfg = this._cfg;
    let closestNote = null;
    let minDist = Infinity;

    for (const note of this.notes) {
      if (note.lane === lane && !note.hit) {
        const d = Math.abs(note.y - cfg.targetY);
        if (d < minDist) { minDist = d; closestNote = note; }
      }
    }

    if (!closestNote || minDist > cfg.goodRange) {
      this.combo = 0;
      return;
    }

    closestNote.hit = true;
    let baseScore = 0;
    if (minDist <= cfg.perfectRange) { baseScore = cfg.perfectScore; this.stats.perfect++; }
    else if (minDist <= cfg.greatRange) { baseScore = cfg.greatScore; this.stats.great++; }
    else { baseScore = cfg.goodScore; this.stats.good++; }

    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.score += baseScore;
  }

  getScore() { return this.score; }
  isAlive() { return this.alive; }
  getDifficulty() { return Math.min(this.speed / 10, 1); }
  getName() { return 'RhythmTap'; }
}

module.exports = RhythmTapAdapter;
