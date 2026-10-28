import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Exam Intelligence Engine Logic", () => {
  it("computes topic appearance likelihood from past exam paper frequency", () => {
    // If a topic appeared 3 times across 3 exam papers -> likelihood = min(99, round(3/3 * 100)) = 99%
    const totalPapers = 3;
    const frequency = 3;
    const likelihood = Math.min(99, Math.round((frequency / totalPapers) * 100));
    assert.equal(likelihood, 99);

    // If a topic appeared 1 time across 4 exam papers -> 25%
    const likelihood2 = Math.min(99, Math.round((1 / 4) * 100));
    assert.equal(likelihood2, 25);
  });

  it("identifies critical weak areas when likelihood >= 60% and student accuracy < 65%", () => {
    const isCriticalWeakArea = (likelihood: number, accuracy: number, attempted: number) => {
      if (attempted === 0 && likelihood >= 60) return true;
      if (likelihood >= 60 && accuracy < 65) return true;
      return false;
    };

    // High yield topic, low accuracy (45%) -> Critical Weak Area
    assert.equal(isCriticalWeakArea(85, 45, 10), true);

    // High yield topic, untouched (0 attempts) -> Critical Weak Area
    assert.equal(isCriticalWeakArea(75, 0, 0), true);

    // High yield topic, high accuracy (90%) -> NOT a weak area (Mastered)
    assert.equal(isCriticalWeakArea(90, 90, 20), false);

    // Low yield topic (30% likelihood), low accuracy (40%) -> NOT critical
    assert.equal(isCriticalWeakArea(30, 40, 5), false);
  });
});

