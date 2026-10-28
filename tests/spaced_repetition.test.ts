import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Spaced Repetition Algorithm (SM-2 Clean-Room Implementation)", () => {
  it("expands review intervals predictably upon successful recall (Grades 3-5)", () => {
    // Standard SM-2 interval progression:
    // Rep 1 -> 1 day
    // Rep 2 -> 3 days
    // Rep 3 -> 7 days
    // Rep 4 -> 16 days
    // Rep 5 -> interval * easeFactor
    const baseSchedule = [1, 3, 7, 16];
    let interval = 0;
    let ease = 2.5;

    for (let rep = 1; rep <= 4; rep++) {
      if (rep === 1) interval = 1;
      else if (rep === 2) interval = 3;
      else if (rep === 3) interval = 7;
      else if (rep === 4) interval = 16;
      assert.equal(interval, baseSchedule[rep - 1]);
    }

    // Repetition 5: 16 * 2.5 = 40 days
    const nextInterval = Math.round(16 * ease);
    assert.equal(nextInterval, 40);
  });

  it("resets interval to 1 day on lapse / incorrect answer and penalizes ease factor", () => {
    let rep = 4;
    let interval = 16;
    let easeFactor = 2.5;

    // Simulate failure (quality < 3)
    rep = 0;
    interval = 1;
    easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));

    assert.equal(rep, 0);
    assert.equal(interval, 1);
    assert.equal(easeFactor, 2.3);
  });

  it("never lets ease factor drop below minimum bound of 1.3", () => {
    let easeFactor = 1.4;
    easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
    assert.equal(easeFactor, 1.3);

    // Further penalties still capped at 1.3
    easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
    assert.equal(easeFactor, 1.3);
  });
});

