"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAndSaveMemories = extractAndSaveMemories;
const genai_1 = require("@google/genai");
const memory_service_1 = require("./memory.service");
// ---------------------------------------------------------
// GEMINI SETUP
// ---------------------------------------------------------
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Add it to your .env file.");
}
const ai = new genai_1.GoogleGenAI({
    apiKey,
});
const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.7-flash";
// ---------------------------------------------------------
// MEMORY TYPES
// ---------------------------------------------------------
const ALLOWED_MEMORY_TYPES = [
    "preference",
    "academic",
    "goal",
    "course",
    "study_habit",
    "challenge",
    "interest",
    "personal",
    "plan",
];
// ---------------------------------------------------------
// EXTRACT MEMORIES
// ---------------------------------------------------------
async function extractAndSaveMemories(userId, userMessage) {
    const message = userMessage.trim();
    if (!message) {
        return [];
    }
    console.log("[MEMORY] Analyzing student message...");
    try {
        const response = await ai.models.generateContent({
            model,
            contents: message,
            config: {
                systemInstruction: `
You are the memory extraction system for a personalized
University of Ibadan student AI study companion.

Your job is to identify ONLY information from the student's
message that would be genuinely useful to remember for future
conversations.

Do NOT save ordinary questions, greetings, temporary statements,
or information that has no meaningful future value.

Examples of useful memories:

"The course I'm struggling with most is calculus."
→ academic/challenge memory

"I prefer studying at night."
→ study_habit/preference memory

"I'm preparing for my CSC 101 exam."
→ course/plan memory

"I want to become a software engineer."
→ goal memory

"I'm really interested in artificial intelligence."
→ interest memory

Examples that should NOT become memories:

"Hello"

"How are you?"

"What is recursion?"

"Explain arrays."

"Thanks."

Return ONLY valid JSON.

The JSON must have exactly this structure:

{
  "memories": [
    {
      "type": "preference",
      "content": "Student prefers studying at night.",
      "importance": 3,
      "confidence": 0.95
    }
  ]
}

If there is nothing worth remembering, return:

{
  "memories": []
}

Allowed memory types:

${ALLOWED_MEMORY_TYPES.join(", ")}

Rules:

- importance must be an integer from 1 to 5.
- confidence must be a number from 0 to 1.
- Keep each memory concise and useful.
- Do not invent information.
- Only extract information explicitly stated or clearly implied
  by the student's message.
- Do not include the student's name, faculty, department, or
  level because those are already stored in the User profile.
- Do not create duplicate memories when the same fact is merely
  repeated.
- Prefer one strong memory over several redundant memories.
`,
            },
        });
        const text = response.text?.trim();
        if (!text) {
            console.log("[MEMORY] Gemini returned no extraction.");
            return [];
        }
        console.log("[MEMORY] Raw extraction:", text);
        const parsed = parseGeminiJson(text);
        if (!parsed || !Array.isArray(parsed.memories)) {
            console.log("[MEMORY] Invalid extraction format.");
            return [];
        }
        const validMemories = parsed.memories
            .filter(isValidMemory)
            .map(normalizeMemory);
        if (validMemories.length === 0) {
            console.log("[MEMORY] No useful memories detected.");
            return [];
        }
        console.log(`[MEMORY] ${validMemories.length} memory candidate(s) found.`);
        const savedMemories = [];
        for (const memory of validMemories) {
            const saved = await (0, memory_service_1.saveMemory)({
                userId,
                type: memory.type,
                content: memory.content,
                importance: memory.importance,
                confidence: memory.confidence,
            });
            savedMemories.push({
                type: saved.type,
                content: saved.content,
                importance: saved.importance,
                confidence: saved.confidence,
            });
            console.log(`[MEMORY] Saved: ${memory.type} → ${memory.content}`);
        }
        return savedMemories;
    }
    catch (error) {
        console.error("[MEMORY] Extraction failed:", error);
        // Memory extraction should NEVER break the student's
        // normal conversation with the AI.
        return [];
    }
}
// ---------------------------------------------------------
// VALIDATE MEMORY
// ---------------------------------------------------------
function isValidMemory(memory) {
    if (!memory || typeof memory !== "object") {
        return false;
    }
    const candidate = memory;
    if (typeof candidate.type !== "string" ||
        typeof candidate.content !== "string") {
        return false;
    }
    if (typeof candidate.importance !== "number" ||
        typeof candidate.confidence !== "number") {
        return false;
    }
    if (!candidate.content.trim()) {
        return false;
    }
    return true;
}
// ---------------------------------------------------------
// NORMALIZE MEMORY
// ---------------------------------------------------------
function normalizeMemory(memory) {
    const normalizedType = ALLOWED_MEMORY_TYPES.includes(memory.type)
        ? memory.type
        : "personal";
    const importance = Math.max(1, Math.min(5, Math.round(memory.importance)));
    const confidence = Math.max(0, Math.min(1, memory.confidence));
    return {
        type: normalizedType,
        content: memory.content.trim(),
        importance,
        confidence,
    };
}
// ---------------------------------------------------------
// PARSE GEMINI JSON
// ---------------------------------------------------------
function parseGeminiJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        // Gemini can occasionally wrap JSON in markdown even when
        // explicitly instructed not to.
    }
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
        try {
            return JSON.parse(fencedMatch[1].trim());
        }
        catch {
            return null;
        }
    }
    const objectStart = text.indexOf("{");
    const objectEnd = text.lastIndexOf("}");
    if (objectStart !== -1 && objectEnd > objectStart) {
        const possibleJson = text.slice(objectStart, objectEnd + 1);
        try {
            return JSON.parse(possibleJson);
        }
        catch {
            return null;
        }
    }
    return null;
}
