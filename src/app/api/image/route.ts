import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Clean the prompt for URL encoding
        const cleanedPrompt = prompt.replace(/[^\w\s]/gi, '').trim();
        const encodedPrompt = encodeURIComponent(cleanedPrompt);

        // We use Pollinations.ai for high-quality cinematic image generation 
        // that is free, fast, and doesn't require complex API keys for this specific use case.
        // It's perfect for the "cinematic artifact" style the app uses.
        const width = 1024;
        const height = 576; // 16:9 Aspect Ratio
        const seed = Math.floor(Math.random() * 1000000);
        
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

        // We verify the image URL is accessible or just return it 
        // In most cases, we just return the URL since it's generated on the fly
        return NextResponse.json({
            imageUrl: imageUrl
        });

    } catch (error: unknown) {
        console.error('Image generation error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
