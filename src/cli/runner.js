'use strict';

const path = require('path');
const FunMeter = require('../FunMeter');
const RandomBot = require('../bots/RandomBot');
const HumanLikeBot = require('../bots/HumanLikeBot');
const FlappyBirdBot = require('../bots/FlappyBirdBot');
const SmartBot = require('../bots/SmartBot');
const { Optimizer, DEFAULT_PARAMS } = require('../Optimizer');
const { saveResult } = require('./formatter');

// Worker 병렬 실행을 위한 게임 파일 경로 맵 (runner.js 기준 상대 경로)
const GAME_FILE_MAP = {
  example:       '../../games/example/ExampleGame',
  'timing-jump': '../../games/timing-jump/TimingJumpAdapter',
  'rhythm-tap':  '../../games/rhythm-tap/RhythmTapAdapter',
  'stack-tower': '../../games/stack-tower/StackTowerAdapter',
  'flappy-bird': '../../games/flappy-bird/FlappyBirdAdapter',
  heartbeat:     '../../examples/heartbeat/HeartBeatAdapter',
};

// 게임 레지스트리
const GAMES = {
  example:       () => require('../../games/example/ExampleGame'),
  'timing-jump': () => require('../../games/timing-jump/TimingJumpAdapter'),
  'rhythm-tap':  () => require('../../games/rhythm-tap/RhythmTapAdapter'),
  'stack-tower': () => require('../../games/stack-tower/StackTowerAdapter'),
  'flappy-bird': () => require('../../games/flappy-bird/FlappyBirdAdapter'),
  heartbeat:     () => require('../../examples/heartbeat/HeartBeatAdapter'),
};

function promptConfirm(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      console.error('⚠️  비대화형 환경 감지. 외부 패키지 로드를 건너뜁니다.');
      console.error('   --yes 플래그를 사용하면 확인 없이 진행됩니다.');
      resolve(false);
      return;
    }
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
 * @param {string} gameName  게임 이름 또는 npm 패키지명
 * @param {{ yes?: boolean }} args  CLI 인자
 * @returns {Promise<Function>}  GameAdapter 서브클래스
 */
async function loadGame(gameName, args) {
  if (GAMES[gameName]) {
    return GAMES[gameName]();
  }

  const isExternal = gameName.startsWith('@') || gameName.includes('/');
  if (!isExternal) {
    console.error(`❌ 알 수 없는 게임: ${gameName}`);
    console.error(`사용 가능: ${Object.keys(GAMES).join(', ')}`);
    console.error(`외부 패키지는 @scope/name 또는 패키지명/경로 형식으로 지정하세요.`);
    process.exit(1);
  }

  if (!args.yes) {
    const confirmed = await promptConfirm(
      `외부 패키지 "${gameName}"을 로드합니다. 계속하시겠습니까? (y/N) `
    );
    if (!confirmed) {
      console.log('취소됨.');
      process.exit(0);
    }
  }

  try {
    return require(gameName);
  } catch (requireErr) {
    if (requireErr.code === 'MODULE_NOT_FOUND' && requireErr.message.includes(gameName)) {
      console.error(`❌ 패키지 "${gameName}"를 찾을 수 없습니다.`);
      console.error(`   npm install ${gameName}  으로 먼저 설치하세요.`);
      process.exit(1);
    }
    try {
      const mod = await import(gameName);
      return mod.default ?? mod;
    } catch (importErr) {
      console.error(`❌ 패키지 로드 실패: ${importErr.message}`);
      process.exit(1);
    }
  }
}

/**
 * 봇 인스턴스 생성
 * @param {object} args      parseArgs() 반환값
 * @param {string} gameName  게임 이름 (기본 botOptions 적용용)
 */
function makeBot(args, gameName) {
  const botType = args.bot || (gameName === 'flappy-bird' ? 'flappy' : 'random');

  if (botType === 'human') {
    return new HumanLikeBot({
      accuracy:     args['bot.accuracy']     ?? 0.9,
      reactionMin:  args['bot.reactionMin']  ?? 100,
      reactionMax:  args['bot.reactionMax']  ?? 300,
    });
  }
  if (botType === 'flappy') {
    return new FlappyBirdBot({
      accuracy:     args['bot.accuracy']     ?? 0.9,
      reactionMin:  args['bot.reactionMin']  ?? 100,
      reactionMax:  args['bot.reactionMax']  ?? 300,
    });
  }
  if (botType === 'smart') {
    return new SmartBot({
      hint:        args.config.hint        ?? 'auto',
      scoreWindow: args.config.scoreWindow ?? 60,
    });
  }
  if (botType === 'ml') {
    const MLBot = require('../bots/MLBot');
    if (args.ml && args.ml.load) {
      return MLBot.load(args.ml.load, { epsilon: args.ml.epsilon ?? 0.0 });
    }
    return new MLBot({
      epsilon: args.ml?.epsilon ?? 0.3,
      buckets:  args.ml?.buckets ?? 10,
    });
  }

  // RandomBot: 게임 기본 botOptions → 사용자 명시 값으로 덮어쓰기
  const gameDefaults = (DEFAULT_PARAMS[gameName] || {}).defaultBotOptions || {};
  const jumpProb = args['bot.jumpProb'] !== undefined
    ? args['bot.jumpProb']
    : (gameDefaults.jumpProb !== undefined ? gameDefaults.jumpProb : 0.05);
  return new RandomBot({ jumpProb });
}

/**
 * 최적화 모드 실행
 */
async function runOptimize(args, gameName, GameClass) {
  const optRuns = args.opt.runs || 50;
  const optIter = args.opt.iter || 20;

  let param;
  if (args.opt.param) {
    param = {
      name:          args.opt.param,
      min:           args.opt.min  ?? 0,
      max:           args.opt.max  ?? 100,
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
  const BotClass = botType === 'human'  ? HumanLikeBot
                 : botType === 'flappy' ? FlappyBirdBot
                 : botType === 'smart'  ? SmartBot
                 : RandomBot;

  const gameDefaultBotOpts = (DEFAULT_PARAMS[gameName] || {}).defaultBotOptions || {};
  const botOptions = { ...gameDefaultBotOpts };
  if (botType === 'human') {
    botOptions.accuracy = args['bot.accuracy'] ?? 0.9;
  } else if (args['bot.jumpProb'] !== undefined) {
    botOptions.jumpProb = args['bot.jumpProb'];
  } else if (gameDefaultBotOpts.jumpProb === undefined) {
    botOptions.jumpProb = 0.05;
  }

  const gameFlowOptions = (DEFAULT_PARAMS[gameName] || {}).flowOptions || {};

  const optimizer = new Optimizer({
    maxIterations: optIter,
    runs:          optRuns,
    verbose:       true,
    flowOptions:   gameFlowOptions,
  });

  console.log(`\n🎮 ${gameName} 최적화 시작 (bot=${botType})`);
  const { config, result, found } = optimizer.optimize(GameClass, BotClass, botOptions, param);

  if (found) {
    console.log('\n💡 이 설정으로 게임을 실행하려면:');
    const cfgArgs = Object.entries(config)
      .map(([k, v]) => `--config.${k}=${v.toFixed(4)}`).join(' ');
    console.log(`   node src/cli.js --game=${gameName} ${cfgArgs}`);
  }
}

/**
 * Gist 업로드 공유
 */
async function shareResult(result) {
  const { uploadGist, GistAuthError, GistUploadError } = require('../reporters/gistReporter');
  const token = process.env.FUNMETER_GITHUB_TOKEN;
  try {
    console.log('📤 Gist 업로드 중...');
    const { url, id } = await uploadGist(result, { token });
    console.log(`✅ 공유 완료: ${url}`);
    console.log(`   터미널 보기: funmeter --view=${id}`);
  } catch (err) {
    if (err instanceof GistAuthError) {
      console.error(`❌ ${err.message}`);
      console.error('   로컬 저장을 사용하려면: funmeter --output=result.json');
    } else if (err instanceof GistUploadError) {
      console.error(`❌ 업로드 실패: ${err.message}`);
      console.error('   네트워크 오류이면 --output=result.json 으로 저장하세요.');
    } else {
      console.error(`❌ 예상치 못한 오류: ${err.message}`);
    }
  }
}

/**
 * 일반 실행 모드 (--view, --trend, --history, --url, ML, --serve, 일반/병렬 포함)
 */
async function runNormal(args, gameName, GameClass) {
  const runs      = args.runs      || 100;
  const maxSeconds = args.maxSeconds || 60;

  // --view=<gist-id>
  if (args.view) {
    const { viewGist, GistNotFoundError, GistFormatError } = require('../reporters/gistReporter');
    const token = process.env.FUNMETER_GITHUB_TOKEN;
    try {
      const result = await viewGist(String(args.view), { token });
      const meter = new FunMeter({ ticksPerSecond: 60, maxSeconds: 60 });
      meter.print(result);
    } catch (err) {
      if (err instanceof GistNotFoundError || err instanceof GistFormatError) {
        console.error(`❌ ${err.message}`);
      } else {
        console.error(`❌ 조회 실패: ${err.message}`);
      }
      process.exit(1);
    }
    process.exit(0);
  }

  // --trend: 히스토리 트렌드 분석
  if (args.trend) {
    const { FunMeterServer } = require('../server/index');
    const srv = new FunMeterServer();
    const { slope, feedback, outliers, entries } = srv.getTrend(args.game);

    if (entries.length === 0) {
      console.log('히스토리 없음 (.funmeter-history/ 를 확인하세요)');
    } else {
      console.log('\n📈 히스토리 트렌드 분석');
      console.log('─'.repeat(50));
      console.log(`  분석 데이터: ${entries.length}개`);
      if (slope !== null) {
        console.log(`  회귀 기울기: ${slope >= 0 ? '+' : ''}${slope.toFixed(3)}초/회`);
      }
      console.log(`\n  ${feedback}`);
      if (outliers.length > 0) {
        console.log('\n  이상치 목록:');
        for (const o of outliers) {
          const date = new Date(o.savedAt).toLocaleString('ko-KR');
          console.log(`    ${date}  중앙값: ${o.result.median.toFixed(1)}s  zone: ${o.result.zone}`);
        }
      }
    }
    console.log('');
    process.exit(0);
  }

  // --history: 저장된 실행 이력 출력
  if (args.history) {
    const { FunMeterServer } = require('../server/index');
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
        const prev = entries[1].result;
        const curr = entries[0].result;
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

    const { BrowserGameAdapter } = await import('../BrowserGameAdapter.js');
    const { BrowserBot }         = await import('../bots/BrowserBot.js');

    const actions         = (args.actions ?? 'Space').toString().split(',').map(s => s.trim());
    const scoreSelector   = args.scoreSelector  ?? '#score';
    const deathSelector   = args.deathSelector  ?? '.game-over';
    const restartSelector = args.restartSelector ?? null;

    const adapter = new BrowserGameAdapter({
      url: args.url, actions, scoreSelector, deathSelector, restartSelector,
      headless: !args.headed,
    });

    const botJumpProb = args['bot.jumpProb'] ?? 0.05;
    const bot  = new BrowserBot({ actions, jumpProb: botJumpProb });
    const meter = new FunMeter({ ticksPerSecond: 60, maxSeconds });

    console.log(`🌐 브라우저 모드: ${args.url}`);
    const result = await meter.runBrowser(adapter, bot, { runs, maxSeconds });
    meter.print(result);
    if (args.output) saveResult(args.output, result);
    return;
  }

  // ML 학습 모드
  if (args.bot === 'ml' && args.ml && args.ml.train) {
    const MLBot = require('../bots/MLBot');
    const mlEpisodes = args.ml.episodes ?? 300;
    const game = new GameClass(args.config);
    const bot = new MLBot({
      epsilon: args.ml.epsilon ?? 0.3,
      buckets:  args.ml.buckets ?? 10,
    });

    console.log(`🧠 MLBot 학습 시작 (${mlEpisodes} episodes)...`);
    bot.train(game, mlEpisodes, { verbose: true });

    if (args.ml.save) {
      bot.save(args.ml.save);
      console.log(`💾 모델 저장됨: ${args.ml.save}`);
    }

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

  // --bot=ml (학습/로드 없음): 경고
  if (args.bot === 'ml' && args.ml && !args.ml.load) {
    console.warn('⚠️  MLBot: 학습 없이 사용 중. --ml.train 또는 --ml.load 권장');
  }

  const game           = new GameClass(args.config);
  const bot            = makeBot(args, gameName);
  const gameFlowOptions = (DEFAULT_PARAMS[gameName] || {}).flowOptions || {};

  // --serve: 로컬 HTTP 서버 + 실시간 대시보드
  if (args.serve) {
    const { FunMeterServer } = require('../server/index');
    const srv = new FunMeterServer({ port: args.port ?? 4567 });
    const { url } = await srv.start();
    console.log(`🌐 대시보드: ${url}`);

    const open = { darwin: 'open', linux: 'xdg-open', win32: 'start' }[process.platform];
    if (open) require('child_process').spawn(open, [url], { detached: true, stdio: 'ignore' });

    const meter = new FunMeter({
      ticksPerSecond: 60,
      maxSeconds:     60,
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
    if (args.share)  await shareResult(result);
    console.log('Ctrl+C 로 서버 종료');
    return;
  }

  // 일반 실행 모드
  console.log(`🎮 ${gameName} 테스트 시작... (${runs}회, bot=${args.bot || 'random'})`);
  if (Object.keys(args.config).length > 0) {
    console.log(`⚙️  설정:`, args.config);
  }

  const meter = new FunMeter({ ticksPerSecond: 60, maxSeconds: 60, ...gameFlowOptions });

  let parallel = args.parallel ? Math.max(1, Math.floor(Number(args.parallel))) : 1;

  const botType = args.bot || 'random';
  const parallelUnsupportedBots = ['smart', 'ml'];
  if (parallel >= 2 && parallelUnsupportedBots.includes(botType)) {
    console.warn(`⚠️  --bot=${botType}은 --parallel과 호환되지 않습니다. 단일 스레드로 실행합니다.`);
    parallel = 1;
  }

  let result;
  if (parallel >= 2) {
    const relGameFile = GAME_FILE_MAP[gameName];
    if (!relGameFile) {
      console.error(`❌ '${gameName}'은 --parallel 모드를 지원하지 않습니다. (외부 패키지 제한)`);
      process.exit(1);
    }
    const gameFile = require.resolve(path.resolve(__dirname, relGameFile));
    const botTypeMap = {
      random: path.resolve(__dirname, '../bots/RandomBot.js'),
      human:  path.resolve(__dirname, '../bots/HumanLikeBot.js'),
      flappy: path.resolve(__dirname, '../bots/FlappyBirdBot.js'),
    };
    const botFile = botTypeMap[botType] ?? botTypeMap.random;

    const gameDefaultBotOpts = (DEFAULT_PARAMS[gameName] || {}).defaultBotOptions || {};
    const botOptions = { ...gameDefaultBotOpts };
    if (botType === 'human' || botType === 'flappy') {
      botOptions.accuracy    = args['bot.accuracy']    ?? 0.9;
      botOptions.reactionMin = args['bot.reactionMin'] ?? 100;
      botOptions.reactionMax = args['bot.reactionMax'] ?? 300;
    } else {
      if (args['bot.jumpProb'] !== undefined) {
        botOptions.jumpProb = args['bot.jumpProb'];
      } else if (gameDefaultBotOpts.jumpProb === undefined) {
        botOptions.jumpProb = 0.05;
      }
    }
    console.log(`🚀 병렬 실행: ${parallel}개 Worker (${runs}회 / Worker당 ~${Math.floor(runs / parallel)}회)`);
    result = await meter.runParallel(gameFile, botFile, args.config, botOptions, runs, parallel);
  } else {
    result = meter.run(game, bot, runs, { verbose: runs >= 20 });
  }

  meter.print(result);
  if (args.output) saveResult(args.output, result);
  if (args.share)  await shareResult(result);
}

module.exports = { loadGame, makeBot, runOptimize, runNormal, shareResult, GAMES, GAME_FILE_MAP };
