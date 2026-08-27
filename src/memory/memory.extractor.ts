import { GoogleGenAI } from "@google/genai";

import { saveMemory } from "./memory.service";

// ---------------------------------------------------------
// GEMINI SETUP
// ---------------------------------------------------------

const apiKey =
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not configured. Add it to your .env file."
  );
}

const ai =
  new GoogleGenAI({
    apiKey,
  });

const model =
  process.env.GEMINI_MEMORY_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-3.7-flash";

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

interface ExtractedMemory {
  type: string;
  content: string;
  importance: number;
  confidence: number;
}

interface MemoryExtractionResult {
  memories: ExtractedMemory[];
}

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
] as const;

// ---------------------------------------------------------
// MEMORY CANDIDATE FILTER
// ---------------------------------------------------------

/**
 * Most student messages are NOT worth sending to a
 * second Gemini request.
 *
 * Examples:
 *
 * "Explain recursion"
 * "What is Python?"
 * "Can you help me?"
 * "Thanks"
 *
 * should immediately return false.
 *
 * Messages that contain personal information or
 * long-term intent become candidates.
 */
function isMemoryCandidate(
  message: string
): boolean {
  const text =
    message
      .trim()
      .toLowerCase();

  if (!text) {
    return false;
  }

  // -------------------------------------------------------
  // Obviously conversational / informational messages
  // -------------------------------------------------------

  const ordinaryPatterns = [
    /^(hi|hello|hey|thanks|thank you|okay|ok|cool|great)[!. ]*$/i,

    /^(what|why|when|where|who|how)\s+(is|are|do|does|can|could|would|should|will|was|were)/i,

    /^(explain|define|describe|tell me|show me|teach me)\b/i,

    /^(can you|could you|would you)\s+(explain|define|describe|show|tell|help)/i,

    /\bwhat is\b/i,

    /\bhow does\b/i,

    /\bhow do i\b/i,

    /\bwhat are\b/i,
  ];

  /**
   * Do not automatically reject a message merely because
   * it looks like a question.
   *
   * We only reject short / clearly informational questions.
   */
  if (
    text.length < 160 &&
    ordinaryPatterns.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return false;
  }

  // -------------------------------------------------------
  // Personal / long-term signals
  // -------------------------------------------------------

  const personalPatterns = [
    /\bi am\b/i,
    /\bi'm\b/i,
    /\bmy goal\b/i,
    /\bmy plan\b/i,
    /\bi want to\b/i,
    /\bi'd like to\b/i,
    /\bi would like to\b/i,
    /\bi hope to\b/i,
    /\bi plan to\b/i,
    /\bi intend to\b/i,
    /\bi prefer\b/i,
    /\bi like\b/i,
    /\bi love\b/i,
    /\bi enjoy\b/i,
    /\bi hate\b/i,
    /\bi don't like\b/i,
    /\bi dislike\b/i,
    /\bi struggle\b/i,
    /\bi'm struggling\b/i,
    /\bi am struggling\b/i,
    /\bi find .* difficult\b/i,
    /\bi find .* hard\b/i,
    /\bi'm finding\b/i,
    /\bi am finding\b/i,
    /\bi am preparing\b/i,
    /\bi'm preparing\b/i,
    /\bi'm studying\b/i,
    /\bi am studying\b/i,
    /\bi study\b/i,
    /\bi learn\b/i,
    /\bi'm learning\b/i,
    /\bi am learning\b/i,
    /\bi'm interested in\b/i,
    /\bi am interested in\b/i,
    /\bmy favorite\b/i,
    /\bmy favourite\b/i,
    /\bmy strongest\b/i,
    /\bmy weakest\b/i,
    /\bi need help with\b/i,
    /\bi need to improve\b/i,
    /\bi am working on\b/i,
    /\bi'm working on\b/i,
  ];

  if (
    personalPatterns.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return true;
  }

  // -------------------------------------------------------
  // Explicit personal declarations
  // -------------------------------------------------------

  const explicitPersonalPatterns = [
    /\bfor the next\b/i,
    /\bthis semester\b/i,
    /\bthis session\b/i,
    /\bmy exam\b/i,
    /\bmy test\b/i,
    /\bmy project\b/i,
    /\bmy assignment\b/i,
    /\bmy course\b/i,
    /\bmy department\b/i,
    /\bmy studies\b/i,
    /\bmy career\b/i,
    /\bmy future\b/i,
  ];

  if (
    explicitPersonalPatterns.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return true;
  }

  /**
   * Longer messages have a greater chance of containing
   * meaningful personal context.
   *
   * We only send them to Gemini if they are reasonably
   * substantial.
   */
  if (
    text.length >= 250
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------
// EXTRACT MEMORIES
// ---------------------------------------------------------

export async function extractAndSaveMemories(
  userId: string,
  userMessage: string
): Promise<ExtractedMemory[]> {
  const message =
    userMessage.trim();

  if (!message) {
    return [];
  }

  // -------------------------------------------------------
  // CHEAP FILTER
  // -------------------------------------------------------

  if (
    !isMemoryCandidate(message)
  ) {
    console.log(
      "[MEMORY] Message is not a memory candidate. Skipping Gemini."
    );

    return [];
  }

  console.log(
    "[MEMORY] Message looks like a memory candidate."
  );

  console.log(
    "[MEMORY] Sending candidate to Gemini..."
  );

  try {
    const startedAt =
      Date.now();

    const response =
      await ai.models.generateContent({
        model,

        contents:
          message,

        config: {
          systemInstruction: `
You are the memory extraction system for a personalized
University of Ibadan student AI study companion.

Your job is to identify ONLY information from the student's
message that would be genuinely useful to remember for future
conversations.

Do NOT save ordinary questions, greetings, temporary statements,
or information that has no meaningful future value.

Useful memories include:

- long-term goals
- academic challenges
- important courses
- study habits
- preferences
- interests
- meaningful plans
- ongoing projects
- recurring difficulties

Examples:

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
- If there is nothing genuinely useful to remember, return
  an empty memories array.
          `.trim(),
        },
      });

    const elapsedMs =
      Date.now() - startedAt;

    console.log(
      `[MEMORY] Gemini extraction completed in ${elapsedMs}ms.`
    );

    const text =
      response.text?.trim();

    if (!text) {
      console.log(
        "[MEMORY] Gemini returned no extraction."
      );

      return [];
    }

    console.log(
      "[MEMORY] Raw extraction:",
      text
    );

    const parsed =
      parseGeminiJson(text);

    if (
      !parsed ||
      !Array.isArray(
        parsed.memories
      )
    ) {
      console.log(
        "[MEMORY] Invalid extraction format."
      );

      return [];
    }

    const validMemories =
      parsed.memories
        .filter(isValidMemory)
        .map(normalizeMemory);

    if (
      validMemories.length === 0
    ) {
      console.log(
        "[MEMORY] No useful memories detected."
      );

      return [];
    }

    console.log(
      `[MEMORY] ${validMemories.length} memory candidate(s) found.`
    );

    const savedMemories:
      ExtractedMemory[] = [];

    for (
      const memory of validMemories
    ) {
      const saved =
        await saveMemory({
          userId,

          type:
            memory.type,

          content:
            memory.content,

          importance:
            memory.importance,

          confidence:
            memory.confidence,
        });

      savedMemories.push({
        type:
          saved.type,

        content:
          saved.content,

        importance:
          saved.importance,

        confidence:
          saved.confidence,
      });

      console.log(
        `[MEMORY] Saved: ${memory.type} → ${memory.content}`
      );
    }

    return savedMemories;
  } catch (error) {
    console.error(
      "[MEMORY] Extraction failed:",
      error
    );

    /**
     * Memory extraction must NEVER break the student's
     * normal conversation.
     */
    return [];
  }
}

// ---------------------------------------------------------
// VALIDATE MEMORY
// ---------------------------------------------------------

function isValidMemory(
  memory: unknown
): memory is ExtractedMemory {
  if (
    !memory ||
    typeof memory !== "object"
  ) {
    return false;
  }

  const candidate =
    memory as Partial<ExtractedMemory>;

  if (
    typeof candidate.type !==
      "string" ||
    typeof candidate.content !==
      "string"
  ) {
    return false;
  }

  if (
    typeof candidate.importance !==
      "number" ||
    typeof candidate.confidence !==
      "number"
  ) {
    return false;
  }

  if (
    !candidate.content.trim()
  ) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------
// NORMALIZE MEMORY
// ---------------------------------------------------------

function normalizeMemory(
  memory: ExtractedMemory
): ExtractedMemory {
  const normalizedType =
    ALLOWED_MEMORY_TYPES.includes(
      memory.type as
        (typeof ALLOWED_MEMORY_TYPES)[number]
    )
      ? memory.type
      : "personal";

  const importance =
    Math.max(
      1,
      Math.min(
        5,
        Math.round(
          memory.importance
        )
      )
    );

  const confidence =
    Math.max(
      0,
      Math.min(
        1,
        memory.confidence
      )
    );

  return {
    type:
      normalizedType,

    content:
      memory.content.trim(),

    importance,

    confidence,
  };
}

// ---------------------------------------------------------
// PARSE GEMINI JSON
// ---------------------------------------------------------

function parseGeminiJson(
  text: string
): MemoryExtractionResult | null {
  try {
    return JSON.parse(
      text
    ) as MemoryExtractionResult;
  } catch {
    // Continue with fallback parsing.
  }

  const fencedMatch =
    text.match(
      /```(?:json)?\s*([\s\S]*?)\s*```/i
    );

  if (
    fencedMatch?.[1]
  ) {
    try {
      return JSON.parse(
        fencedMatch[1].trim()
      ) as MemoryExtractionResult;
    } catch {
      return null;
    }
  }

  const objectStart =
    text.indexOf("{");

  const objectEnd =
    text.lastIndexOf("}");

  if (
    objectStart !== -1 &&
    objectEnd > objectStart
  ) {
    const possibleJson =
      text.slice(
        objectStart,
        objectEnd + 1
      );

    try {
      return JSON.parse(
        possibleJson
      ) as MemoryExtractionResult;
    } catch {
      return null;
    }
  }

  return null;
}