"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const ai_service_1 = require("./ai.service");
async function main() {
    console.log("Testing Gemini AI...");
    console.log("--------------------------------");
    const response = await (0, ai_service_1.generateAIResponse)({
        systemInstruction: "You are a friendly AI assistant helping test the University of Ibadan Freshers AI project.",
        userMessage: "Introduce yourself in one short paragraph and explain what you can help a University of Ibadan fresher with.",
    });
    console.log("Gemini response:");
    console.log("--------------------------------");
    console.log(response);
    console.log("--------------------------------");
    console.log("Gemini test completed successfully.");
}
main().catch((error) => {
    console.error("Gemini test failed:");
    console.error(error);
    process.exit(1);
});
