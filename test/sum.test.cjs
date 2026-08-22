"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sum } = require("../lib/sum.cjs");

test("sum adds two positive numbers", () => {
  assert.equal(sum(2, 3), 5);
});

test("sum handles negative numbers", () => {
  assert.equal(sum(-2, 5), 3);
});
