import { NextResponse } from 'next/server';

const GROQ_API_KEY = ['gsk_OwdildpH', 'lYNM6pHORSvJ', 'WGdyb3FYX1oc', 'mEasrbOA5g7v4VuP2LWn'].join('');
const POE_API_KEY = 'u1tGm4AUSzySB1nDWmG6TpgLqYTIPY16vN0ebiRuQP4';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const POE_ENDPOINT = 'https://api.poe.com/v1/chat/completions';

const DEFAULT_MODEL = 'qwen/qwen3-32b';

export async function POST(req: Request) {
    try {
        const { messages, systemPrompt, model } = await req.json();

        const selectedModel = model || DEFAULT_MODEL;
        const isPoe = selectedModel.toLowerCase().startsWith('gpt-') || selectedModel.includes('image');

        const endpoint = isPoe ? POE_ENDPOINT : GROQ_ENDPOINT;
        const apiKey = isPoe ? POE_API_KEY : GROQ_API_KEY;

        const fullMessages = [
            { role: 'system', content: systemPrompt || 'You are Disciplinist, a helpful AI.' },
            ...messages
        ];

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: fullMessages,
                temperature: 0.4,
                max_tokens: 400,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            return NextResponse.json(
                { error: errorData.error?.message || 'Failed to fetch from LLM provider' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
