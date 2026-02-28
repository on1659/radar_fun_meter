// src/index.js
const FunMeter = require('./FunMeter');
const GameAdapter = require('./GameAdapter');
const { Optimizer, DEFAULT_PARAMS } = require('./Optimizer');
const RandomBot = require('./bots/RandomBot');
const HumanLikeBot = require('./bots/HumanLikeBot');

module.exports = {
  FunMeter,
  GameAdapter,
  Optimizer,
  DEFAULT_PARAMS,
  RandomBot,
  HumanLikeBot,
};
