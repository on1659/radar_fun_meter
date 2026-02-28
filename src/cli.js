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
const FlappyBirdBot = require('./bots/FlappyBirdBot');
const SmartBot = require('./bots/SmartBot');
const { Optimizer, DEFAULT_PARAMS } = require('./Optimizer');

function printHelp() {
  console.log(`
radar_fun_meter — Flow Theory 기반 게임 재미 측정 도구

사용법:
  funmeter --game=<이름> [옵션]
  funmeter --game=<이름> --optimize [최적화 옵션]
  funmeter --help

기본 옵션:
  --game=<이름>           게임 선택 (기본: example)
                          가능한 값: example, timing-jump, rhythm-tap,
                                    stack-tower, flappy-bird, heartbeat
  --runs=<n>              실행 횟수 (기본: 100)
  --bot=random|human|smart  봇 종류 (기본: random)
  --output=<파일>         결과를 파일로 저장 (.json / .html / .md)
  --list-games            사용 가능한 게임 목록 출력

봇 옵션:
  --bot.jumpProb=<0~1>    RandomBot 점프 확률 (기본: 0.05)
  --bot.accuracy=<0~1>    HumanLikeBot 정확도 (기본: 0.9)
  --bot.reactionMin=<ms>  반응 지연 최소 (기본: 100)
  --bot.reactionMax=<ms>  반응 지연 최대 (기본: 300)
  --config.hint=<장르>    SmartBot 장르 힌트 (platformer|rhythm|tower|auto)

게임 파라미터:
  --config.<키>=<값>      게임 생성자에 전달 (예: --config.initialSpeed=120)

최적화 옵션:
  --optimize              최적화 모드 활성화
  --opt.runs=<n>          반복당 실행 횟수 (기본: 50)
  --opt.iter=<n>          최대 탐색 횟수 (기본: 20)
  --opt.param=<이름>      탐색할 파라미터 이름 (커스텀)
  --opt.min=<값>          탐색 최솟값
  --opt.max=<값>          탐색 최댓값
  --opt.direction=higher|lower  어려워지는 방향

예시:
  funmeter --game=timing-jump --runs=100 --bot=human
  funmeter --game=timing-jump --optimize --opt.runs=50
  funmeter --game=example --runs=50 --output=result.json
  funmeter --game=timing-jump --runs=50 --output=report.html
  funmeter --game=stack-tower --runs=50 --output=report.md
`);
  process.exit(0);
}

function printListGames() {
  console.log('\n사용 가능한 게임:');
  for (const name of Object.keys(GAMES)) {
    const p = DEFAULT_PARAMS[name];
    if (!p) {
      console.log(`  ${name.padEnd(14)}(기본 파라미터 없음)`);
    } else {
      const levelTag = p.flowOptions?.levelMode ? '  [레벨 모드]' : '';
      console.log(
        `  ${name.padEnd(14)}${p.name} [${p.min}~${p.max}, ${p.hardDirection}]${levelTag}`
      );
    }
  }
  console.log('');
  process.exit(0);
}

function saveResult(filePath, result) {
  const fs = require('fs');
  const path = require('path');
  const ext = path.extname(filePath).toLowerCase();
  let content;

  if (ext === '.html') {
    const { toHTML } = require('./reporters/htmlReporter');
    content = toHTML(result);
  } else if (ext === '.md' || ext === '.markdown') {
    const { toMarkdown } = require('./reporters/mdReporter');
    content = toMarkdown(result);
  } else {
    content = JSON.stringify({ ...result, generatedAt: new Date().toISOString() }, null, 2);
  }

  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`💾 결과 저장됨: ${filePath}`);
  } catch (err) {
    console.error(`❌ 저장 실패 (${filePath}): ${err.message}`);
  }
}

// 게임 레지스트리
const GAMES = {
  example: () => require('../games/example/ExampleGame'),
  'timing-jump': () => require('../games/timing-jump/TimingJumpAdapter'),
  'rhythm-tap': () => require('../games/rhythm-tap/RhythmTapAdapter'),
  'stack-tower': () => require('../games/stack-tower/StackTowerAdapter'),
  'flappy-bird': () => require('../games/flappy-bird/FlappyBirdAdapter'),
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
  const botType = args.bot || (gameName === 'flappy-bird' ? 'flappy' : 'random');
  if (botType === 'human') {
    return new HumanLikeBot({
      accuracy: args['bot.accuracy'] ?? 0.9,
      reactionMin: args['bot.reactionMin'] ?? 100,
      reactionMax: args['bot.reactionMax'] ?? 300,
    });
  }
  if (botType === 'flappy') {
    return new FlappyBirdBot({
      accuracy: args['bot.accuracy'] ?? 0.9,
      reactionMin: args['bot.reactionMin'] ?? 100,
      reactionMax: args['bot.reactionMax'] ?? 300,
    });
  }
  if (botType === 'smart') {
    return new SmartBot({
      hint: args.config.hint ?? 'auto',
      scoreWindow: args.config.scoreWindow ?? 60,
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

  const botType = args.bot || (gameName === 'flappy-bird' ? 'flappy' : 'random');
  const BotClass = botType === 'human' ? HumanLikeBot
                 : botType === 'flappy' ? FlappyBirdBot
                 : botType === 'smart'  ? SmartBot
                 : RandomBot;
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

  // --help
  if (args.help) printHelp(); // 내부에서 process.exit(0)
  if (args['list-games']) printListGames();

  const runs = args.runs || 100;
  const maxSeconds = args.maxSeconds || 60;

  // --url 모드: 브라우저 자동화
  if (args.url) {
    let playwright;
    try {
      playwright = await import('playwright');
    } catch {
      console.error([
        '❌ Playwright가 설치되지 않았습니다.',
        '브라우저 모드를 사용하려면 아래 명령어를 실행하세요:',
        '',
        '  npm install playwright',
        '  npx playwright install chromium',
      ].join('\n'));
      process.exit(1);
    }

    const { BrowserGameAdapter } = await import('./BrowserGameAdapter.js');
    const { BrowserBot } = await import('./bots/BrowserBot.js');

    const actions = (args.actions ?? 'Space').toString().split(',').map(s => s.trim());
    const scoreSelector = args.scoreSelector ?? '#score';
    const deathSelector = args.deathSelector ?? '.game-over';
    const restartSelector = args.restartSelector ?? null;

    const adapter = new BrowserGameAdapter({
      url: args.url,
      actions,
      scoreSelector,
      deathSelector,
      restartSelector,
      headless: !args.headed,
    });

    const botJumpProb = args['bot.jumpProb'] ?? 0.05;
    const bot = new BrowserBot({ actions, jumpProb: botJumpProb });
    const meter = new FunMeter({ ticksPerSecond: 60, maxSeconds });

    console.log(`🌐 브라우저 모드: ${args.url}`);
    const result = await meter.runBrowser(adapter, bot, { runs, maxSeconds });
    meter.print(result);

    if (args.output) saveResult(args.output, result);
    return;
  }

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
  console.log(`🎮 ${gameName} 테스트 시작... (${runs}회, bot=${args.bot || 'random'})`);
  if (Object.keys(args.config).length > 0) {
    console.log(`⚙️  설정:`, args.config);
  }

  const game = new GameClass(args.config);
  const bot = makeBot(args, gameName);

  // 게임별 기본 flowOptions 자동 적용 (stack-tower의 levelMode 등)
  const gameFlowOptions = (DEFAULT_PARAMS[gameName] || {}).flowOptions || {};
  const meter = new FunMeter({ ticksPerSecond: 60, maxSeconds: 60, ...gameFlowOptions });
  const result = meter.run(game, bot, runs, { verbose: runs >= 20 });
  meter.print(result);

  // --output
  if (args.output) saveResult(args.output, result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
