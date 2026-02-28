import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const {
  FunMeter,
  generateSuggestions,
  GENRE_PRESETS,
  GameAdapter,
  Optimizer,
  DEFAULT_PARAMS,
  RandomBot,
  HumanLikeBot,
  SmartBot,
  BrowserGameAdapter,
  BrowserBot,
} = require('../index.js');

export {
  FunMeter,
  generateSuggestions,
  GENRE_PRESETS,
  GameAdapter,
  Optimizer,
  DEFAULT_PARAMS,
  RandomBot,
  HumanLikeBot,
  SmartBot,
  BrowserGameAdapter,
  BrowserBot,
};
