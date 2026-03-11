import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const cleanedPrompt = prompt.replace(/[^\w\s]/gi, '').trim().substring(0, 500);
        const seed = Math.floor(Math.random() * 999999);

        // Provider 1: Pollinations with a quick health check
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanedPrompt)}?width=1024&height=576&seed=${seed}&nologo=true&enhance=true&model=flux`;
        try {
            const probe = await fetch(pollinationsUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
            if (probe.ok) {
                return NextResponse.json({ imageUrl: pollinationsUrl });
            }
        } catch {
            console.warn('Pollinations unavailable, trying fallback...');
        }

        // Provider 2: Lexica Aperture (query-based search, always returns images)
        try {
            const lexicaRes = await fetch(`https://lexica.art/api/v1/search?q=${encodeURIComponent(cleanedPrompt)}&n=1`, {
                signal: AbortSignal.timeout(8000)
            });
            if (lexicaRes.ok) {
                const lexicaData = await lexicaRes.json();
                const imageUrl = lexicaData?.images?.[0]?.src;
                if (imageUrl) {
                    return NextResponse.json({ imageUrl });
                }
            }
        } catch {
            console.warn('Lexica unavailable, using final fallback...');
        }

        // Provider 3: Unsplash Source (guaranteed - always returns a relevant photo)
        const unsplashKeywords = cleanedPrompt.split(' ').slice(0, 5).join(',');
        const fallbackUrl = `https://source.unsplash.com/1024x576/?${encodeURIComponent(unsplashKeywords)}&sig=${seed}`;
        return NextResponse.json({ imageUrl: fallbackUrl });

    } catch (error: unknown) {
        console.error('Image generation error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
