#!/usr/bin/env node
/**
 * radar_fun_meter CLI
 * 사용법: node src/cli.js --game=example --runs=100
 */

const FunMeter = require('./FunMeter');
const RandomBot = require('./bots/RandomBot');

// CLI 인자 파싱
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
);

const gameName = args.game || 'example';
const runs = parseInt(args.runs || '100');
const verbose = args.verbose === 'true';

// 게임 로드
let GameClass;
try {
  GameClass = require(`../games/${gameName}/${capitalize(gameName)}Game`);
} catch (e) {
  // 대소문자 없는 파일명 시도
  try {
    const files = require('fs').readdirSync(`./games/${gameName}`);
    const jsFile = files.find(f => f.endsWith('.js'));
    GameClass = require(`../games/${gameName}/${jsFile}`);
  } catch (e2) {
    console.error(`❌ 게임을 찾을 수 없어: games/${gameName}/`);
    console.error('사용 가능한 게임:', require('fs').readdirSync('./games').join(', '));
    process.exit(1);
  }
}

// 설정 파싱 (--config.initialSpeed=22 등)
const config = {};
Object.entries(args).forEach(([key, value]) => {
  if (key.startsWith('config.')) {
    config[key.slice(7)] = isNaN(value) ? value : parseFloat(value);
  }
});

console.log(`\n🎮 radar_fun_meter`);
console.log(`${'─'.repeat(40)}`);
console.log(`게임: ${gameName}`);
console.log(`시뮬레이션: ${runs}회`);
if (Object.keys(config).length > 0) {
  console.log(`설정:`, config);
}
console.log(`${'─'.repeat(40)}\n`);

// 분석 실행
const game = new GameClass(config);
const bot = new RandomBot({ inputChance: 0.05, inputs: ['jump'] });
const meter = new FunMeter({ runs });

process.stdout.write('분석 중 ');
const interval = setInterval(() => process.stdout.write('.'), 200);

const report = meter.analyze(game, (g, t) => bot.decide(g, t));
clearInterval(interval);
console.log(' 완료!\n');

// 결과 출력
console.log(`📊 결과: ${report.gameName}`);
console.log(`${'─'.repeat(40)}`);
console.log(`생존 시간`);
console.log(`  평균:   ${report.survival.avg}초`);
console.log(`  중앙값: ${report.survival.median}초`);
console.log(`  최소:   ${report.survival.min}초`);
console.log(`  최대:   ${report.survival.max}초`);
console.log(`점수`);
console.log(`  평균:   ${report.score.avg}`);
console.log(`  최고:   ${report.score.max}`);
console.log(`타임아웃: ${report.timeoutRate}`);
console.log(`${'─'.repeat(40)}`);
console.log(`\n${report.verdict}`);
console.log(`💡 ${report.suggestion}\n`);

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
