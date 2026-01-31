import { GoogleGenerativeAI } from "@google/generative-ai";

// Access your API key (see "Set up your API key" above)
// In a real production app, you should use a backend proxy to hide this key,
// or use Firebase Functions / Vertex AI for secure access.
// For this frontend-only demo, we'll expect an env var or prompt the user.
let genAI = null;
let model = null;

export const initializeGemini = (apiKey) => {
    console.log("Initializing Gemini with model: gemini-2.0-flash");
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
};

export const generateResponse = async (prompt, history = [], systemInstruction = "") => {
    if (!model) {
        throw new Error("Gemini API not initialized. Please provide an API key.");
    }

    try {
        // Start a chat session with the provided history and system instruction
        const chat = model.startChat({
            history: history,
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        });

        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        const text = response.text();
        return text;
    } catch (error) {
        console.error("Error generating response from Gemini:", error);
        throw error;
    }
};
