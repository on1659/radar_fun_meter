'use strict';

/**
 * CLI 인자 파싱
 * @param {string[]} argv  process.argv
 * @returns {{ config: object, opt: object, ml: object, _: string[], [key: string]: any }}
 */
function parseArgs(argv = process.argv) {
  const args = { config: {}, opt: {}, ml: {}, _: [] };
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const eqIdx = arg.indexOf('=');
    const key  = eqIdx >= 0 ? arg.slice(0, eqIdx) : arg;
    const val  = eqIdx >= 0 ? arg.slice(eqIdx + 1) : true;
    const name = key.slice(2);
    const parsed = val === true ? true : isNaN(val) ? val : Number(val);

    if      (name.startsWith('config.')) args.config[name.slice(7)] = parsed;
    else if (name.startsWith('opt.'))    args.opt[name.slice(4)]    = parsed;
    else if (name.startsWith('ml.'))     args.ml[name.slice(3)]     = parsed;
    else                                  args[name]                 = parsed;
  }
  return args;
}

/**
 * 인자 유효성 검사 — 실패 시 Error throw
 * @param {object} args  parseArgs() 반환값
 */
function _validateOrThrow(args) {
  if (args.port !== undefined) {
    const port = Number(args.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new RangeError(`--port 범위 오류: 1024~65535 사이여야 합니다 (입력: ${args.port})`);
    }
  }

  if (args.output) {
    const path = require('path');
    const resolved = path.resolve(String(args.output));
    const cwd = process.cwd();
    if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
      throw new Error(`--output 경로 오류: 현재 디렉터리 밖에 저장할 수 없습니다 (${args.output})`);
    }
  }

  if (args.opt && args.opt.runs !== undefined && Number(args.opt.runs) > 10000) {
    throw new RangeError(`--opt.runs 상한 초과: 최대 10000 (입력: ${args.opt.runs})`);
  }

  if (args.opt && args.opt.iter !== undefined && Number(args.opt.iter) > 100) {
    throw new RangeError(`--opt.iter 상한 초과: 최대 100 (입력: ${args.opt.iter})`);
  }

  for (const [key, val] of Object.entries(args.config || {})) {
    if (typeof val === 'number' && !Number.isFinite(val)) {
      throw new TypeError(`--config.${key} 값이 유효하지 않습니다 (NaN/Infinity 불허)`);
    }
  }
}

/**
 * 인자 유효성 검사 — 실패 시 process.exit(1)
 * @param {object} args  parseArgs() 반환값
 */
function validateArgs(args) {
  try {
    _validateOrThrow(args);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

module.exports = { parseArgs, validateArgs, _validateOrThrow };
