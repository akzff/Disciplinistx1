import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyBJ0Koa9bNnqLM1ahm1FMwmnTAUljT0qxs";

async function main() {
    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.list();
        console.log("Available models:");
        console.log(JSON.stringify(response, null, 2));
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

main();
