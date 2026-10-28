import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateAnswer } from "../src/modules/practice/practice.service";

describe("Practice Mode & CBT Scoring Engine", () => {
  describe("Single Best Answer (SBA) Evaluation", () => {
    it("matches exact letter answers case-insensitively", () => {
      assert.deepEqual(evaluateAnswer("MCQ", "A", "A"), { isCorrect: true, scoreFraction: 1 });
      assert.deepEqual(evaluateAnswer("MCQ", "b", "B"), { isCorrect: true, scoreFraction: 1 });
      assert.deepEqual(evaluateAnswer("MCQ", "c", "d"), { isCorrect: false, scoreFraction: 0 });
    });

    it("normalizes prefixed option formats e.g. 'A) Option' or 'A. Option'", () => {
      assert.deepEqual(evaluateAnswer("MCQ", "A) Ampulla of the fallopian tube", "A"), {
        isCorrect: true,
        scoreFraction: 1,
      });
      assert.deepEqual(evaluateAnswer("MCQ", "b. Option", "B"), {
        isCorrect: true,
        scoreFraction: 1,
      });
      assert.deepEqual(evaluateAnswer("MCQ", "C", "A) Ampulla"), {
        isCorrect: false,
        scoreFraction: 0,
      });
    });
  });

  describe("True / False Multi-Limb Evaluation", () => {
    it("awards full marks when all 4 limbs match", () => {
      const res = evaluateAnswer("TRUE_FALSE", "T, F, T, T", "T, F, T, T");
      assert.equal(res.isCorrect, true);
      assert.equal(res.scoreFraction, 1.0);
    });

    it("calculates partial limb fraction when some limbs match", () => {
      // 3 out of 4 correct -> scoreFraction: 0.75, isCorrect: false
      const res = evaluateAnswer("TRUE_FALSE", "T, F, T, F", "T, F, T, T");
      assert.equal(res.isCorrect, false);
      assert.equal(res.scoreFraction, 0.75);
    });

    it("handles space and case normalization for TFTT strings", () => {
      const res = evaluateAnswer("TRUE_FALSE", "t f t t", "T, F, T, T");
      assert.equal(res.isCorrect, true);
      assert.equal(res.scoreFraction, 1.0);
    });

    it("awards zero marks when all limbs are wrong", () => {
      const res = evaluateAnswer("TRUE_FALSE", "F, T, F, F", "T, F, T, T");
      assert.equal(res.isCorrect, false);
      assert.equal(res.scoreFraction, 0.0);
    });
  });
});
