#!/usr/bin/env node
/**
 * radar_fun_meter CLI
 * Usage:
 *   node src/cli.js --game=<name> --runs=<n> [--bot=random|human] [--config.key=value ...]
 *   node src/cli.js --game=<name> --optimize [--opt.runs=<n>] [--opt.iter=<n>]
 */

const FunMeter = require('./FunMeter');
const RandomBot = require('./bots/RandomBot');
const HumanLikeBot = require('./bots/HumanLikeBot');
const { Optimizer, DEFAULT_PARAMS } = require('./Optimizer');

// 게임 레지스트리
const GAMES = {
  example: () => require('../games/example/ExampleGame'),
  'timing-jump': () => require('../games/timing-jump/TimingJumpAdapter'),
  'rhythm-tap': () => require('../games/rhythm-tap/RhythmTapAdapter'),
  'stack-tower': () => require('../games/stack-tower/StackTowerAdapter'),
  // 튜토리얼 예제 게임 (examples/ 폴더)
  heartbeat: () => require('../examples/heartbeat/HeartBeatAdapter'),
};

function parseArgs(argv) {
  const args = { config: {}, opt: {} };
  for (const arg of argv.slice(2)) {
    const eqIdx = arg.indexOf('=');
    const key = eqIdx >= 0 ? arg.slice(0, eqIdx) : arg;
    const val = eqIdx >= 0 ? arg.slice(eqIdx + 1) : true;
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const parsed = val === true ? true : isNaN(val) ? val : Number(val);
    if (name.startsWith('config.')) {
      args.config[name.slice(7)] = parsed;
    } else if (name.startsWith('opt.')) {
      args.opt[name.slice(4)] = parsed;
    } else {
      args[name] = parsed;
    }
  }
  return args;
}

function makeBot(args, gameName) {
  const botType = args.bot || 'random';
  if (botType === 'human') {
    return new HumanLikeBot({
      accuracy: args['bot.accuracy'] ?? 0.9,
      reactionMin: args['bot.reactionMin'] ?? 100,
      reactionMax: args['bot.reactionMax'] ?? 300,
    });
  }
  // 게임별 기본 botOptions 적용 (명시적 인자가 우선)
  const gameDefaults = (DEFAULT_PARAMS[gameName] || {}).defaultBotOptions || {};
  const jumpProb = args['bot.jumpProb'] !== undefined
    ? args['bot.jumpProb']
    : (gameDefaults.jumpProb !== undefined ? gameDefaults.jumpProb : 0.05);
  return new RandomBot({ jumpProb });
}

async function runOptimize(args, gameName, GameClass) {
  const optRuns = args.opt.runs || 50;
  const optIter = args.opt.iter || 20;

  // 커스텀 파라미터 탐색 지원: --opt.param=name --opt.min=0 --opt.max=100 --opt.direction=higher
  let param;
  if (args.opt.param) {
    param = {
      name: args.opt.param,
      min: args.opt.min ?? 0,
      max: args.opt.max ?? 100,
      hardDirection: args.opt.direction ?? 'higher',
    };
  } else if (DEFAULT_PARAMS[gameName]) {
    param = DEFAULT_PARAMS[gameName];
  } else {
    console.error(`❌ '${gameName}'의 기본 최적화 파라미터가 없습니다.`);
    console.error(`   --opt.param, --opt.min, --opt.max, --opt.direction 으로 직접 지정하세요.`);
    process.exit(1);
  }

  const botType = args.bot || 'random';
  const BotClass = botType === 'human' ? HumanLikeBot : RandomBot;
  // 게임 기본 botOptions → 사용자 명시 값으로 덮어쓰기
  const gameDefaultBotOpts = (DEFAULT_PARAMS[gameName] || {}).defaultBotOptions || {};
  const botOptions = { ...gameDefaultBotOpts };
  if (botType === 'human') {
    botOptions.accuracy = args['bot.accuracy'] ?? 0.9;
  } else if (args['bot.jumpProb'] !== undefined) {
    botOptions.jumpProb = args['bot.jumpProb']; // 명시적 지정만 적용
  } else if (gameDefaultBotOpts.jumpProb === undefined) {
    botOptions.jumpProb = 0.05; // 게임 기본값 없으면 기본값 사용
  }

  // 게임별 기본 flowOptions 적용 (stack-tower의 levelMode 등)
  const gameFlowOptions = (DEFAULT_PARAMS[gameName] || {}).flowOptions || {};

  const optimizer = new Optimizer({
    maxIterations: optIter,
    runs: optRuns,
    verbose: true,
    flowOptions: gameFlowOptions,
  });

  console.log(`\n🎮 ${gameName} 최적화 시작 (bot=${botType})`);
  const { config, result, found } = optimizer.optimize(GameClass, BotClass, botOptions, param);

  if (found) {
    console.log('\n💡 이 설정으로 게임을 실행하려면:');
    const cfgArgs = Object.entries(config).map(([k, v]) => `--config.${k}=${v.toFixed(4)}`).join(' ');
    console.log(`   node src/cli.js --game=${gameName} ${cfgArgs}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const gameName = args.game || 'example';

  if (!GAMES[gameName]) {
    console.error(`❌ 알 수 없는 게임: ${gameName}`);
    console.error(`사용 가능: ${Object.keys(GAMES).join(', ')}`);
    process.exit(1);
  }

  const GameClass = GAMES[gameName]();

  // --optimize 모드
  if (args.optimize) {
    return runOptimize(args, gameName, GameClass);
  }

  // 일반 실행 모드
  const runs = args.runs || 100;
  console.log(`🎮 ${gameName} 테스트 시작... (${runs}회, bot=${args.bot || 'random'})`);
  if (Object.keys(args.config).length > 0) {
    console.log(`⚙️  설정:`, args.config);
  }

  const game = new GameClass(args.config);
  const bot = makeBot(args, gameName);

  // 게임별 기본 flowOptions 자동 적용 (stack-tower의 levelMode 등)
  const gameFlowOptions = (DEFAULT_PARAMS[gameName] || {}).flowOptions || {};
  const meter = new FunMeter({ ticksPerSecond: 60, maxSeconds: 60, ...gameFlowOptions });
  const result = meter.run(game, bot, runs);
  meter.print(result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
