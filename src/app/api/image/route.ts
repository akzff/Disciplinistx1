import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = "AIzaSyBJ0Koa9bNnqLM1ahm1FMwmnTAUljT0qxs";
const ai = new GoogleGenAI({ apiKey });

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: prompt,
        });

        if (!response.candidates || response.candidates.length === 0) {
            return NextResponse.json({ error: 'No candidates returned from Gemini' }, { status: 500 });
        }

        const parts = response.candidates[0].content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                const imageData = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                return NextResponse.json({
                    imageUrl: `data:${mimeType};base64,${imageData}`
                });
            }
        }

        return NextResponse.json({ error: 'No image data found in response' }, { status: 500 });

    } catch (error: unknown) {
        console.error('Image generation error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
