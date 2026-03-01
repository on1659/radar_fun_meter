'use strict';
/**
 * funmeter init <name> [--template=basic|human|levels] [--dir=<path>]
 *
 * 새 게임 어댑터 스캐폴딩을 생성하고 cli.js 레지스트리에 자동 등록합니다.
 */
const fs = require('fs');
const path = require('path');

/**
 * 게임 이름(kebab-case)을 PascalCase 클래스명으로 변환
 * "my-game" → "MyGameAdapter"
 */
function toClassName(name) {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') + 'Adapter';
}

/**
 * 템플릿 문자열 생성
 * @param {string} name     - 게임 이름 (kebab-case)
 * @param {string} template - 'basic' | 'human' | 'levels'
 * @returns {string}        - 게임 어댑터 소스코드
 */
function generateTemplate(name, template) {
  const className = toClassName(name);
  const displayName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  if (template === 'human') {
    return `'use strict';
/**
 * ${className} - HumanLikeBot 호환 게임 어댑터
 *
 * HumanLikeBot이 필요한 필드:
 *   game.isOnGround  - 액션 가능 여부
 *   game.speed       - px/s 단위 속도
 *   game.obstacles   - [{ id, x, width, height, passed }]
 *   game._cfg        - playerX, playerWidth, margin 등
 */
const GameAdapter = require('radar_fun_meter/src/GameAdapter');

class ${className} extends GameAdapter {
  constructor(config = {}) {
    super(config);
    this._cfg = {
      playerX: 80,
      playerWidth: 28,
      playerHeight: 36,
      gameWidth: 400,
      obstacleWidth: 22,
      margin: 3,
      initialSpeed: 130,
      ...config,
    };
  }

  reset() {
    this.alive = true;
    this._score = 0;
    this._time = 0;
    this.tick = 0;
    this.speed = this._cfg.initialSpeed;
    this.isOnGround = true;
    this.obstacles = [];
    this._obstacleIdCounter = 0;
    // TODO: 추가 초기화 로직
  }

  update(input) {
    if (!this.alive) return;
    this.tick++;
    this._time = this.tick / 60;
    this.speed = this._cfg.initialSpeed + this.tick * 0.04;

    // input === 'action' 이면 점프/탭/클릭
    if (input === 'action' && this.isOnGround) {
      // TODO: 점프/액션 로직
    }

    // TODO: 장애물 이동 + 충돌 검사 로직
    // obstacles 배열: [{ id, x, width, height, passed }]
  }

  getScore()      { return this._score; }
  isAlive()       { return this.alive; }
  getDifficulty() { return Math.min(this.speed / 400, 1); }
  getName()       { return '${displayName}'; }
}

module.exports = ${className};
`;
  }

  if (template === 'levels') {
    return `'use strict';
/**
 * ${className} - 레벨 시스템 포함 게임 어댑터
 */
const GameAdapter = require('radar_fun_meter/src/GameAdapter');

class ${className} extends GameAdapter {
  constructor(config = {}) {
    super(config);
    // TODO: 게임 초기 파라미터 정의
    this.difficulty = config.difficulty ?? 1.0;
  }

  reset() {
    this.alive = true;
    this._score = 0;
    this._time = 0;
    this._level = 1;
    // TODO: 게임 상태 초기화
  }

  update(input) {
    if (!this.alive) return;
    this._time += 1 / 60;
    // TODO: input에 따른 게임 로직
    // input === 'action' 이면 점프/탭/클릭

    // 레벨업 조건 예시 (30초마다)
    if (this._time > this._level * 30) {
      this._level++;
      // TODO: 레벨업 시 난이도 조정
    }
  }

  getScore()      { return this._score; }
  isAlive()       { return this.alive; }
  getDifficulty() { return Math.min(this.difficulty, 1); }
  getName()       { return '${displayName}'; }
  getLevel()      { return this._level; }
}

module.exports = ${className};
`;
  }

  // basic (기본)
  return `'use strict';
/**
 * ${className} - 기본 게임 어댑터 (RandomBot 호환)
 */
const GameAdapter = require('radar_fun_meter/src/GameAdapter');

class ${className} extends GameAdapter {
  constructor(config = {}) {
    super(config);
    // TODO: 게임 초기 파라미터 정의
    this.difficulty = config.difficulty ?? 1.0;
  }

  reset() {
    this.alive = true;
    this._score = 0;
    this._time = 0;
    // TODO: 게임 상태 초기화
  }

  update(input) {
    if (!this.alive) return;
    this._time += 1 / 60;
    // TODO: input에 따른 게임 로직
    // input === 'action' 이면 점프/탭/클릭
  }

  getScore()      { return this._score; }
  isAlive()       { return this.alive; }
  getDifficulty() { return Math.min(this.difficulty, 1); }
  getName()       { return '${displayName}'; }
}

module.exports = ${className};
`;
}

/**
 * 파일 시스템 생성: 디렉터리 + 어댑터 파일
 * 이미 존재하면 Error('Game "name" already exists') throw
 * @returns {{ dir: string, file: string }}  생성된 경로들
 */
function createGameFiles(name, template, outDir) {
  const className = toClassName(name);
  const gameDir = path.join(outDir, name);

  if (fs.existsSync(gameDir)) {
    throw new Error(`Game "${name}" already exists at ${gameDir}`);
  }

  fs.mkdirSync(gameDir, { recursive: true });

  const content = generateTemplate(name, template || 'basic');
  const filePath = path.join(gameDir, `${className}.js`);
  fs.writeFileSync(filePath, content, 'utf8');

  return { dir: gameDir, file: filePath };
}

/**
 * cli.js의 GAMES/GAME_FILE_MAP에 새 게임 항목 삽입
 * 정규식 기반 텍스트 패치 (AST 불필요)
 */
function insertEntry(code, blockEndMarker, newEntry) {
  const blockStart = code.indexOf(blockEndMarker);
  if (blockStart === -1) return code;
  const bracePos = code.indexOf('\n};', blockStart);
  if (bracePos === -1) return code;
  return code.slice(0, bracePos) + `\n${newEntry}` + code.slice(bracePos);
}

function patchCliRegistry(name, adapterRelPath) {
  const cliPath = path.resolve(__dirname, '../cli.js');
  let content = fs.readFileSync(cliPath, 'utf8');

  // 이미 등록된 경우 스킵
  if (content.includes(`'${name}':`)) {
    return;
  }

  // GAME_FILE_MAP 패치
  content = insertEntry(
    content,
    'GAME_FILE_MAP',
    `  '${name}': '${adapterRelPath}',`
  );

  // GAMES 패치
  content = insertEntry(
    content,
    'const GAMES',
    `  '${name}': () => require('${adapterRelPath}'),`
  );

  fs.writeFileSync(cliPath, content, 'utf8');
}

/**
 * 메인 진입점 (cli.js에서 호출)
 */
async function runInit(args) {
  // 이름: --init=<name> 또는 positional args._[1] 등
  // cli.js 파싱 기준: node cli.js init <name> → args._[0]==='init', args._[1]===<name>
  // 실제로는 parseArgs가 _ 배열을 지원하지 않으므로 args.init 또는 args._
  let name = typeof args.init === 'string' ? args.init : undefined;
  if (!name && args._ && args._[1]) {
    name = args._[1];
  }

  if (!name) {
    console.error('❌ 게임 이름을 지정하세요: funmeter init <이름>');
    console.error('   예시: funmeter init my-game');
    process.exit(1);
  }

  // 이름 유효성 검사 (kebab-case: 알파벳, 숫자, 하이픈)
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(`❌ 게임 이름은 소문자, 숫자, 하이픈만 사용할 수 있습니다: ${name}`);
    console.error('   올바른 예: my-game, platformer2, jump-king');
    process.exit(1);
  }

  const template = args.template || 'basic';
  if (!['basic', 'human', 'levels'].includes(template)) {
    console.error(`❌ 알 수 없는 템플릿: ${template}`);
    console.error('   가능한 값: basic, human, levels');
    process.exit(1);
  }

  // 출력 디렉터리 결정
  const projectRoot = path.resolve(__dirname, '../..');
  const defaultOutDir = path.join(projectRoot, 'games');
  const outDir = args.dir ? path.resolve(args.dir) : defaultOutDir;

  let result;
  try {
    result = createGameFiles(name, template, outDir);
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const className = toClassName(name);
  console.log(`✅ 게임 어댑터 생성됨:`);
  console.log(`   디렉터리: ${result.dir}`);
  console.log(`   파일:     ${result.file}`);

  // cli.js 레지스트리 자동 등록 (games/ 기본 디렉터리인 경우만)
  if (outDir === defaultOutDir) {
    const relPath = `../games/${name}/${className}`;
    try {
      patchCliRegistry(name, relPath);
      console.log(`📝 cli.js 레지스트리에 '${name}' 등록 완료`);
    } catch (err) {
      console.warn(`⚠️  cli.js 레지스트리 자동 등록 실패: ${err.message}`);
      console.warn(`   수동으로 GAMES와 GAME_FILE_MAP에 '${name}'를 추가하세요.`);
    }
  } else {
    console.log(`ℹ️  커스텀 디렉터리 사용 — cli.js 레지스트리는 수동으로 등록하세요.`);
  }

  console.log(`\n🚀 다음 명령어로 테스트하세요:`);
  console.log(`   node src/cli.js --game=${name} --runs=10`);
}

module.exports = { runInit, generateTemplate, toClassName, createGameFiles, patchCliRegistry };
