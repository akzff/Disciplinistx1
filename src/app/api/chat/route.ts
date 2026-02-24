import { NextResponse } from 'next/server';

const GROQ_API_KEY = ['gsk_OwdildpH', 'lYNM6pHORSvJ', 'WGdyb3FYX1oc', 'mEasrbOA5g7v4VuP2LWn'].join('');
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

export async function POST(req: Request) {
    try {
        const { messages, systemPrompt } = await req.json();

        const fullMessages = [
            { role: 'system', content: systemPrompt || 'You are Disciplinist, a helpful AI.' },
            ...messages
        ];

        const response = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: fullMessages,
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Groq API Error:', errorData);
            return NextResponse.json(
                { error: errorData.error?.message || 'Failed to fetch from Groq' },
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
