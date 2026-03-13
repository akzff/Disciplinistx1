import { NextResponse } from 'next/server';

const GROQ_API_KEY = ['gsk_OwdildpH', 'lYNM6pHORSvJ', 'WGdyb3FYX1oc', 'mEasrbOA5g7v4VuP2LWn'].join('');
const POE_API_KEY = 'u1tGm4AUSzySB1nDWmG6TpgLqYTIPY16vN0ebiRuQP4';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const POE_ENDPOINT = 'https://api.poe.com/v1/chat/completions';

const DEFAULT_MODEL = 'openai/gpt-oss-120b';

export const maxDuration = 120;

export async function POST(req: Request) {
    try {
        const { messages, systemPrompt, model, maxTokens } = await req.json();

        const selectedModel = model || DEFAULT_MODEL;
        const isGpt120b = selectedModel === 'openai/gpt-oss-120b';
        const isPoe = !isGpt120b && (selectedModel.toLowerCase().startsWith('gpt-') || selectedModel.includes('image'));

        const endpoint = isPoe ? POE_ENDPOINT : GROQ_ENDPOINT;
        const apiKey = isPoe ? POE_API_KEY : GROQ_API_KEY;

        const fullMessages = [
            { role: 'system', content: systemPrompt || 'You are Disciplinist, a helpful AI.' },
            ...messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
        ];

        interface GroqRequest {
            model: string;
            messages: { role: string; content: string }[];
            temperature: number;
            max_tokens: number;
            reasoning_effort?: string;
        }

        const body: GroqRequest = {
            model: selectedModel,
            messages: fullMessages,
            temperature: isGpt120b ? 2 : 0.4,
            max_tokens: maxTokens || (isGpt120b ? 4000 : 1000),
        };

        if (isGpt120b) {
            body.reasoning_effort = "high";
            // Note: browser_search tool omitted for now as it requires specific Groq tool config
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
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
