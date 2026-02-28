import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const {
  FunMeter,
  GameAdapter,
  Optimizer,
  DEFAULT_PARAMS,
  RandomBot,
  HumanLikeBot,
} = require('../index.js');

export {
  FunMeter,
  GameAdapter,
  Optimizer,
  DEFAULT_PARAMS,
  RandomBot,
  HumanLikeBot,
};
