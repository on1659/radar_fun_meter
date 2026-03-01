'use strict';

/**
 * --help 텍스트 출력 (process.exit은 호출자 책임)
 */
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

공유 옵션:
  --share                 결과를 GitHub Gist로 업로드 (FUNMETER_GITHUB_TOKEN 필요)
  --view=<gist-id>        저장된 Gist 결과 터미널 출력

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
}

/**
 * 사용 가능한 게임 목록 출력 (process.exit은 호출자 책임)
 * @param {object} GAMES        게임 레지스트리 맵
 * @param {object} DEFAULT_PARAMS  게임별 기본 파라미터
 */
function printListGames(GAMES, DEFAULT_PARAMS) {
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
}

/**
 * 결과를 파일로 저장 (.json / .html / .md)
 * @param {string} filePath  저장 경로
 * @param {object} result    FunMeter.run() 결과
 */
function saveResult(filePath, result) {
  const fs = require('fs');
  const path = require('path');
  const ext = path.extname(filePath).toLowerCase();
  let content;

  if (ext === '.html') {
    const { toHTML } = require('../reporters/htmlReporter');
    content = toHTML(result);
  } else if (ext === '.md' || ext === '.markdown') {
    const { toMarkdown } = require('../reporters/mdReporter');
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

module.exports = { printHelp, printListGames, saveResult };
