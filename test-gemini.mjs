import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

// API Key provided by user
const apiKey = "AIzaSyBJ0Koa9bNnqLM1ahm1FMwmnTAUljT0qxs";

async function main() {
    // Pass the API key to the constructor
    const ai = new GoogleGenAI({ apiKey });

    const prompt =
        "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme";

    console.log("Starting image generation with model: gemini-2.5-flash-image");

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: prompt,
        });

        console.log("Response received.");

        if (!response.candidates || response.candidates.length === 0) {
            console.error("No candidates returned.");
            return;
        }

        for (const part of response.candidates[0].content.parts) {
            if (part.text) {
                console.log("Text info:", part.text);
            } else if (part.inlineData) {
                const imageData = part.inlineData.data;
                const buffer = Buffer.from(imageData, "base64");
                fs.writeFileSync("gemini-native-image.png", buffer);
                console.log("Image saved as gemini-native-image.png");
            }
        }
    } catch (error) {
        console.error("Error during generation:", error.message || error);
        if (error.status === 429) {
            console.log("Note: 429 error means the API key is currently rate-limited. Wait a few seconds and try again.");
        }
    }
}

main();
