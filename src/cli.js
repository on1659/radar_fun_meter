#!/usr/bin/env node
'use strict';

const { parseArgs, validateArgs }          = require('./cli/parser');
const { printHelp, printListGames }        = require('./cli/formatter');
const { loadGame, runOptimize, runNormal, GAMES } = require('./cli/runner');
const { DEFAULT_PARAMS }                   = require('./Optimizer');

async function main() {
  const args = parseArgs(process.argv);
  validateArgs(args);

  if (args.help)          { printHelp(); process.exit(0); }
  if (args['list-games']) { printListGames(GAMES, DEFAULT_PARAMS); process.exit(0); }

  // init 서브커맨드
  if (args._[0] === 'init') {
    args.init = args._[1] || args.init;
    const { runInit } = require('./commands/init');
    await runInit(args);
    process.exit(0);
  }

  const gameName  = args.game || 'example';
  const GameClass = args.url ? null : await loadGame(gameName, args);

  if (args.optimize) return runOptimize(args, gameName, GameClass);

  await runNormal(args, gameName, GameClass);
}

main().catch(err => { console.error(err); process.exit(1); });
