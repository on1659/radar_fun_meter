#!/usr/bin/env node
/**
 * 병렬 실행 성능 벤치마크
 * 사용법: node tests/benchmark.js
 */
const { execSync } = require('child_process');

const RUNS = 1000;
const GAME = 'timing-jump';

function measure(label, cmd) {
  const start = Date.now();
  execSync(cmd, { stdio: 'pipe' });
  const ms = Date.now() - start;
  console.log(`${label.padEnd(20)} ${ms}ms`);
  return ms;
}

console.log(`\n벤치마크: ${GAME} × ${RUNS}회\n`);
const t1 = measure('single (parallel=1)', `node src/cli.js --game=${GAME} --runs=${RUNS} --parallel=1`);
const t2 = measure('parallel=2',          `node src/cli.js --game=${GAME} --runs=${RUNS} --parallel=2`);
const t4 = measure('parallel=4',          `node src/cli.js --game=${GAME} --runs=${RUNS} --parallel=4`);

console.log(`\n속도 향상:`);
console.log(`  parallel=2: ${(t1/t2).toFixed(2)}x`);
console.log(`  parallel=4: ${(t1/t4).toFixed(2)}x`);
