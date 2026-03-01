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
                          외부 패키지: @scope/radar-game-<name>
  --yes                   외부 패키지 로드 시 확인 프롬프트 스킵
  --runs=<n>              실행 횟수 (기본: 100)
  --bot=random|human|smart|ml  봇 종류 (기본: random)
  --output=<파일>         결과를 파일로 저장 (.json / .html / .md)
  --list-games            사용 가능한 게임 목록 출력

서버 옵션:
  --serve                 로컬 대시보드 서버 기동 (http://127.0.0.1:4567)
  --port=<n>              서버 포트 (기본: 4567)
  --history               저장된 실행 이력 출력 후 종료

봇 옵션:
  --bot.jumpProb=<0~1>    RandomBot 점프 확률 (기본: 0.05)
  --bot.accuracy=<0~1>    HumanLikeBot 정확도 (기본: 0.9)
  --bot.reactionMin=<ms>  반응 지연 최소 (기본: 100)
  --bot.reactionMax=<ms>  반응 지연 최대 (기본: 300)
  --config.hint=<장르>    SmartBot 장르 힌트 (platformer|rhythm|tower|auto)

ML 봇 옵션 (--bot=ml):
  --ml.train              학습 모드 활성화
  --ml.episodes=<n>       학습 에피소드 수 (기본: 300)
  --ml.save=<파일>        학습 후 모델 저장 경로
  --ml.load=<파일>        학습된 모델 로드 경로
  --ml.epsilon=<0~1>      탐험율 (학습 기본: 0.3, 추론 기본: 0.0)
  --ml.buckets=<n>        상태 이산화 구간 수 (기본: 10)

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
  funmeter --game=timing-jump --serve --runs=100
  funmeter --history
  funmeter --game=example --bot=ml --ml.train --ml.episodes=500 --ml.save=model.json
  funmeter --game=example --bot=ml --ml.load=model.json --runs=100
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

function promptConfirm(question) {
  return new Promise((resolve) => {
    const rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/**
 * 게임 클래스 로드.
 * - 내장 게임: GAMES 레지스트리에서 동기 로드
 * - 외부 패키지: require() → import() 순서로 시도
 * @param {string} gameName  게임 이름 또는 npm 패키지명 (e.g. '@user/radar-game-platformer')
 * @param {{ yes?: boolean }} args  CLI 인자
 * @returns {Promise<Function>}  GameAdapter 서브클래스
 */
async function loadGame(gameName, args) {
  // 내장 게임
  if (GAMES[gameName]) {
    return GAMES[gameName]();
  }

  // 외부 패키지 감지
  const isExternal = gameName.startsWith('@') || gameName.includes('/');
  if (!isExternal) {
    console.error(`❌ 알 수 없는 게임: ${gameName}`);
    console.error(`사용 가능: ${Object.keys(GAMES).join(', ')}`);
    console.error(`외부 패키지는 @scope/name 또는 패키지명/경로 형식으로 지정하세요.`);
    process.exit(1);
  }

  // 사용자 확인 프롬프트
  if (!args.yes) {
    const confirmed = await promptConfirm(
      `외부 패키지 "${gameName}"을 로드합니다. 계속하시겠습니까? (y/N) `
    );
    if (!confirmed) {
      console.log('취소됨.');
      process.exit(0);
    }
  }

  // require() 시도 → ESM import() 폴백
  try {
    return require(gameName);
  } catch (requireErr) {
    if (requireErr.code === 'MODULE_NOT_FOUND' && requireErr.message.includes(gameName)) {
      console.error(`❌ 패키지 "${gameName}"를 찾을 수 없습니다.`);
      console.error(`   npm install ${gameName}  으로 먼저 설치하세요.`);
      process.exit(1);
    }
    // ERR_REQUIRE_ESM 등 → 동적 import() 시도
    try {
      const mod = await import(gameName);
      return mod.default ?? mod;
    } catch (importErr) {
      console.error(`❌ 패키지 로드 실패: ${importErr.message}`);
      process.exit(1);
    }
  }
}

function parseArgs(argv) {
  const args = { config: {}, opt: {}, ml: {} };
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
    } else if (name.startsWith('ml.')) {
      args.ml[name.slice(3)] = parsed;
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
  if (botType === 'ml') {
    const MLBot = require('./bots/MLBot');
    if (args.ml && args.ml.load) {
      return MLBot.load(args.ml.load, { epsilon: args.ml.epsilon ?? 0.0 });
    }
    return new MLBot({
      epsilon: args.ml?.epsilon ?? 0.3,
      buckets: args.ml?.buckets ?? 10,
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

  // --history: 저장된 실행 이력 출력
  if (args.history) {
    const { FunMeterServer } = require('./server/index');
    const srv = new FunMeterServer();
    const entries = srv.getHistory();
    if (entries.length === 0) {
      console.log('히스토리 없음 (.funmeter-history/ 디렉터리를 확인하세요)');
    } else {
      console.log('\n최근 실행 이력 (최신순):');
      for (const entry of entries) {
        const date = new Date(entry.savedAt).toLocaleString('ko-KR');
        const { name, zone, median } = entry.result || {};
        console.log(
          `  ${date}  ${(name || '?').padEnd(14)}  ${(zone || '?').padEnd(10)}  중앙값: ${median != null ? median.toFixed(1) + 's' : '?'}`
        );
      }
      if (entries.length >= 2) {
        const prev = entries[1].result; // 이전 실행 (index 1 = 두 번째 최신)
        const curr = entries[0].result; // 최신 실행 (index 0)
        if (prev && curr) {
          const mDiff  = curr.median - prev.median;
          const tDiff  = (curr.timeoutRate - prev.timeoutRate) * 100;
          const mSign  = mDiff >= 0 ? '+' : '';
          const tSign  = tDiff >= 0 ? '+' : '';
          const mArrow = mDiff > 0 ? '▲' : mDiff < 0 ? '▼' : '─';
          const tArrow = tDiff < 0 ? '▼' : tDiff > 0 ? '▲' : '─';
          console.log('\n이전 실행 대비 변화:');
          console.log(`  중앙값:   ${prev.median.toFixed(1)}s → ${curr.median.toFixed(1)}s  (${mSign}${mDiff.toFixed(1)}s ${mArrow})`);
          if (prev.zone !== curr.zone) {
            const zoneEmoji = { FLOW: '✅', TOO_HARD: '😵', TOO_EASY: '😴' }[curr.zone] ?? '';
            console.log(`  Zone:     ${prev.zone} → ${curr.zone} ${zoneEmoji}`);
          }
          console.log(`  타임아웃: ${(prev.timeoutRate * 100).toFixed(0)}% → ${(curr.timeoutRate * 100).toFixed(0)}%  (${tSign}${tDiff.toFixed(0)}%p ${tArrow})`);
        }
      }
    }
    console.log('');
    process.exit(0);
  }

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

  const GameClass = await loadGame(gameName, args);

  // --optimize 모드
  if (args.optimize) {
    return runOptimize(args, gameName, GameClass);
  }

  // ML 학습 모드
  if (args.bot === 'ml' && args.ml && args.ml.train) {
    const MLBot = require('./bots/MLBot');
    const mlEpisodes = args.ml.episodes ?? 300;
    const game = new GameClass(args.config);
    const bot = new MLBot({
      epsilon:    args.ml.epsilon ?? 0.3,
      buckets:    args.ml.buckets ?? 10,
    });

    console.log(`🧠 MLBot 학습 시작 (${mlEpisodes} episodes)...`);
    bot.train(game, mlEpisodes, { verbose: true });

    if (args.ml.save) {
      bot.save(args.ml.save);
      console.log(`💾 모델 저장됨: ${args.ml.save}`);
    }

    // 학습 결과 검증
    bot.epsilon = 0.0;
    const gameFlowOptions2 = (DEFAULT_PARAMS[gameName] || {}).flowOptions || {};
    const meter2 = new FunMeter({ ticksPerSecond: 60, maxSeconds: 60, ...gameFlowOptions2 });
    const game2  = new GameClass(args.config);
    console.log(`\n🎮 학습 결과 측정 (${runs}회)...`);
    const result2 = meter2.run(game2, bot, runs, { verbose: runs >= 20 });
    meter2.print(result2);
    if (args.output) saveResult(args.output, result2);
    return;
  }

  // --bot=ml (학습/로드 없음): 경고 후 무학습 측정
  if (args.bot === 'ml' && args.ml && !args.ml.load) {
    console.warn('⚠️  MLBot: 학습 없이 사용 중. --ml.train 또는 --ml.load 권장');
  }

  // 게임 인스턴스 / 봇 / flowOptions (--serve + 일반 모드 공용)
  const game = new GameClass(args.config);
  const bot = makeBot(args, gameName);
  const gameFlowOptions = (DEFAULT_PARAMS[gameName] || {}).flowOptions || {};

  // --serve: 로컬 HTTP 서버 + 실시간 대시보드
  if (args.serve) {
    const { FunMeterServer } = require('./server/index'); // lazy require
    const srv = new FunMeterServer({ port: args.port ?? 4567 });
    const { url } = await srv.start();
    console.log(`🌐 대시보드: ${url}`);

    // 브라우저 자동 열기 (macOS/Linux/Windows 대응)
    const open = { darwin: 'open', linux: 'xdg-open', win32: 'start' }[process.platform];
    if (open) require('child_process').spawn(open, [url], { detached: true, stdio: 'ignore' });

    const meter = new FunMeter({
      ticksPerSecond: 60,
      maxSeconds: 60,
      ...gameFlowOptions,
      onProgress: (data) => srv.sendProgress(data),
    });

    console.log(`🎮 ${gameName} 테스트 시작... (${runs}회, bot=${args.bot || 'random'})`);
    if (Object.keys(args.config).length > 0) {
      console.log(`⚙️  설정:`, args.config);
    }

    const result = meter.run(game, bot, runs, { verbose: runs >= 20 });
    srv.sendResult(result);
    srv.saveHistory(result);
    meter.print(result);
    if (args.output) saveResult(args.output, result);
    console.log('Ctrl+C 로 서버 종료');
    return;
  }

  // 일반 실행 모드
  console.log(`🎮 ${gameName} 테스트 시작... (${runs}회, bot=${args.bot || 'random'})`);
  if (Object.keys(args.config).length > 0) {
    console.log(`⚙️  설정:`, args.config);
  }

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
