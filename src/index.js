// src/index.js
const FunMeter = require('./FunMeter');
const { generateSuggestions, GENRE_PRESETS } = require('./FunMeter');
const GameAdapter = require('./GameAdapter');
const { Optimizer, DEFAULT_PARAMS } = require('./Optimizer');
const RandomBot = require('./bots/RandomBot');
const HumanLikeBot = require('./bots/HumanLikeBot');
const SmartBot = require('./bots/SmartBot');
const BrowserGameAdapter = require('./BrowserGameAdapter');
const BrowserBot = require('./bots/BrowserBot');

module.exports = {
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
