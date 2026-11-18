import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleMotion } from "../shared/smoothing.js";
test("motion interpolates between network packets and bounds prediction during a stall", () => {
  const samples = [
    { time: 10, x: 100, y: 600, vx: 200 },
    { time: 10.05, x: 110, y: 590, vx: 200 },
  ];
  assert.equal(sampleMotion(samples, 10.025).x, 105);
  assert.equal(sampleMotion(samples, 10.025).y, 595);
  assert.ok(Math.abs(sampleMotion(samples, 10.075).x - 115) < 0.001);
  assert.equal(sampleMotion(samples, 11).x, 126);
  assert.equal(sampleMotion(samples, 9).x, 100);
});
