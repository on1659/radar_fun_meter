// src/index.js
const FunMeter = require('./FunMeter');
const { generateSuggestions } = require('./FunMeter');
const GameAdapter = require('./GameAdapter');
const { Optimizer, DEFAULT_PARAMS } = require('./Optimizer');
const RandomBot = require('./bots/RandomBot');
const HumanLikeBot = require('./bots/HumanLikeBot');
const SmartBot = require('./bots/SmartBot');

module.exports = {
  FunMeter,
  generateSuggestions,
  GameAdapter,
  Optimizer,
  DEFAULT_PARAMS,
  RandomBot,
  HumanLikeBot,
  SmartBot,
};
