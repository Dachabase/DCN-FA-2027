"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLevel = resolveLevel;
function resolveLevel(userMessage) {
    const text = userMessage
        .toLowerCase()
        .trim();
    // -------------------------------------------------------
    // Direct numeric levels
    // -------------------------------------------------------
    const numericMatch = text.match(/\b(100|200|300|400|500|600)\b/);
    if (numericMatch) {
        return Number(numericMatch[1]);
    }
    // -------------------------------------------------------
    // Word-based levels
    // -------------------------------------------------------
    const wordLevels = {
        "one hundred": 100,
        "two hundred": 200,
        "three hundred": 300,
        "four hundred": 400,
        "five hundred": 500,
        "six hundred": 600,
        "one hundred level": 100,
        "two hundred level": 200,
        "three hundred level": 300,
        "four hundred level": 400,
        "five hundred level": 500,
        "six hundred level": 600,
    };
    for (const [phrase, level] of Object.entries(wordLevels)) {
        if (text.includes(phrase)) {
            return level;
        }
    }
    return null;
}
