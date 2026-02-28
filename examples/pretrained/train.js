#!/usr/bin/env node
/**
 * 사전 학습 모델 생성 스크립트
 * 실행: node examples/pretrained/train.js
 *
 * timing-jump 게임에 대해 MLBot을 500 에피소드 학습 후
 * examples/pretrained/timing-jump.json 에 저장합니다.
 */

'use strict';

const MLBot = require('../../src/bots/MLBot');
const FunMeter = require('../../src/FunMeter');
const TimingJumpAdapter = require('../../games/timing-jump/TimingJumpAdapter');
const path = require('path');

async function main() {
  const game = new TimingJumpAdapter({ initialSpeed: 120 });
  // maxSeconds=60 기준 점수 정규화
  const bot = new MLBot({ buckets: 10, alpha: 0.1, gamma: 0.9, scoreScale: 60 });

  console.log('🧠 timing-jump 학습 시작 (500 episodes)...');
  bot.train(game, 500, { verbose: true });

  const outPath = path.join(__dirname, 'timing-jump.json');
  bot.save(outPath);
  console.log(`💾 모델 저장: ${outPath}`);

  // 학습 결과 검증
  bot.epsilon = 0.0;
  const meter = new FunMeter({ maxSeconds: 60 });
  const result = meter.run(new TimingJumpAdapter({ initialSpeed: 120 }), bot, 50);
  meter.print(result);
}

main().catch(console.error);
