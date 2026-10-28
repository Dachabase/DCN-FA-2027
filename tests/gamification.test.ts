import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateLevelFromXp,
  getXpThresholdForLevel,
  calculateDailyQuestGrade,
} from "../src/modules/gamification/gamification.service";

describe("Gamification Mathematical Engine (Phase 7 & mbprep parity)", () => {
  it("matches observed Level 1 to 13 XP thresholds exactly", () => {
    const expected = [0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400, 6500, 8000, 10000];
    for (let lvl = 1; lvl <= 13; lvl++) {
      assert.equal(
        getXpThresholdForLevel(lvl),
        expected[lvl - 1],
        `Level ${lvl} threshold mismatch`
      );
    }
  });

  it("calculates quadratic progression for levels 14 to 45", () => {
    // Level 14: 10000 + 2500*1 + 0 = 12500
    assert.equal(getXpThresholdForLevel(14), 12500);
    // Level 15: 10000 + 2500*2 + 250*2*1/2 = 10000 + 5000 + 250 = 15250
    assert.equal(getXpThresholdForLevel(15), 15250);
  });

  it("maps XP to correct level, tier, and Hunter Rank", () => {
    // 0 XP -> Level 1, Freshite, Rank E
    const r1 = calculateLevelFromXp(0);
    assert.equal(r1.level, 1);
    assert.equal(r1.hunterRank, "E");
    assert.equal(r1.academicTier, "Freshite");

    // 250 XP -> Level 2, Freshite, Rank E
    const r2 = calculateLevelFromXp(250);
    assert.equal(r2.level, 2);
    assert.equal(r2.hunterRank, "E");

    // 1000 XP -> Level 4, Freshite, Rank E
    const r4 = calculateLevelFromXp(1000);
    assert.equal(r4.level, 4);
    assert.equal(r4.hunterRank, "E");

    // 2000 XP -> Level 6, Stalwart, Rank D
    const r6 = calculateLevelFromXp(2000);
    assert.equal(r6.level, 6);
    assert.equal(r6.hunterRank, "D");
    assert.equal(r6.academicTier, "Stalwart");

    // 10000 XP -> Level 13, Departmental Ace, Rank C
    const r13 = calculateLevelFromXp(10000);
    assert.equal(r13.level, 13);
    assert.equal(r13.hunterRank, "C");
    assert.equal(r13.academicTier, "Departmental Ace");
  });

  it("calculates daily quest grade from E to M based on completed ratio", () => {
    const target = 20;
    assert.equal(calculateDailyQuestGrade(0, target), "E");
    assert.equal(calculateDailyQuestGrade(6, target), "E");   // 30% (< 40%)
    assert.equal(calculateDailyQuestGrade(8, target), "D");   // 40% (>= 40%)
    assert.equal(calculateDailyQuestGrade(14, target), "C");  // 70% (>= 70%)
    assert.equal(calculateDailyQuestGrade(20, target), "B");  // 100% (>= 100%)
    assert.equal(calculateDailyQuestGrade(24, target), "A");  // 120% (>= 120%)
    assert.equal(calculateDailyQuestGrade(30, target), "S");  // 150% (>= 150%)
    assert.equal(calculateDailyQuestGrade(40, target), "M");  // 200% (>= 200%)
  });
});
