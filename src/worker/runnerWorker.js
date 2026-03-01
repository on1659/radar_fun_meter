const { parentPort, workerData } = require('worker_threads');

// workerData: { gameFile, botFile, botOptions, gameConfig, runs, maxTicks, sampleInterval, CURVE_BUCKETS, ticksPerSecond }
const { gameFile, botFile, botOptions, gameConfig, runs, maxTicks, sampleInterval, CURVE_BUCKETS, ticksPerSecond } = workerData;

const GameClass = require(gameFile);
const BotClass = require(botFile);

const game = new GameClass(gameConfig);
const bot = new BotClass(botOptions);
const supportsLevel = typeof game.getLevel === 'function';

const times = [];
const scores = [];
const levels = [];
let timeouts = 0;
const allCurves = [];

for (let i = 0; i < runs; i++) {
  game.reset();
  if (bot.reset) bot.reset();
  let ticks = 0;
  const curveSamples = [];

  while (game.isAlive() && ticks < maxTicks) {
    if (ticks % sampleInterval === 0) curveSamples.push(game.getScore());
    game.update(bot.decide(game));
    ticks++;
  }

  const finalScore = game.getScore();
  while (curveSamples.length < CURVE_BUCKETS) curveSamples.push(finalScore);
  allCurves.push(curveSamples.slice(0, CURVE_BUCKETS));

  const elapsed = ticks / ticksPerSecond;
  if (ticks >= maxTicks) timeouts++;
  times.push(elapsed);
  scores.push(finalScore);
  if (supportsLevel) {
    const lv = game.getLevel();
    if (lv !== null) levels.push(lv);
  }

  // 진행 상황 메시지 (메인 스레드 집계용)
  parentPort.postMessage({ type: 'progress', run: i + 1, elapsed, score: finalScore });
}

parentPort.postMessage({ type: 'result', times, scores, levels, timeouts, allCurves });
