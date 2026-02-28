import { FunMeter, RandomBot, GameAdapter } from '../../src/esm/index.js';
import assert from 'node:assert/strict';

assert.equal(typeof FunMeter, 'function');
assert.equal(typeof RandomBot, 'function');
assert.equal(typeof GameAdapter, 'function');

const meter = new FunMeter({ maxSeconds: 5 });
assert.ok(meter instanceof FunMeter);
console.log('ESM import: OK');
