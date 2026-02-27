#!/usr/bin/env node
/**
 * radar_fun_meter CLI
 * Usage: node src/cli.js --game=<name> --runs=<n> [--config.key=value ...]
 */

const FunMeter = require('./FunMeter');
const RandomBot = require('./bots/RandomBot');

// 게임 레지스트리
const GAMES = {
  example: () => require('../games/example/ExampleGame'),
  'timing-jump': () => require('../games/timing-jump/TimingJumpAdapter'),
  'rhythm-tap': () => require('../games/rhythm-tap/RhythmTapAdapter'),
  'stack-tower': () => require('../games/stack-tower/StackTowerAdapter'),
};

function parseArgs(argv) {
  const args = { config: {} };
  for (const arg of argv.slice(2)) {
    const [key, val] = arg.split('=');
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const parsed = isNaN(val) ? val : Number(val);
    if (name.startsWith('config.')) {
      args.config[name.slice(7)] = parsed;
    } else {
      args[name] = parsed;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const gameName = args.game || 'example';
  const runs = args.runs || 100;

  if (!GAMES[gameName]) {
    console.error(`❌ 알 수 없는 게임: ${gameName}`);
    console.error(`사용 가능: ${Object.keys(GAMES).join(', ')}`);
    process.exit(1);
  }

  console.log(`🎮 ${gameName} 테스트 시작... (${runs}회)`);
  if (Object.keys(args.config).length > 0) {
    console.log(`⚙️  설정:`, args.config);
  }

  const GameClass = GAMES[gameName]();
  const game = new GameClass(args.config);
  const bot = new RandomBot({ jumpProb: args['bot.jumpProb'] || 0.05 });

  const meter = new FunMeter({
    ticksPerSecond: 60,
    maxSeconds: 60,
  });

  const result = meter.run(game, bot, runs);
  meter.print(result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
