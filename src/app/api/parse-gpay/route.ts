import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { text } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        const fullText = text;
        
        
        // Send the extracted text to Gemini to parse into a structured JSON array
        const prompt = `You are an expert at extracting financial transactions from GPay statement PDFs.
I will provide you with the raw extracted text from a PDF statement.

Please extract all expenses (money spent, paid, debited) from the statement text.
Return the result strictly as a valid JSON array of objects.
Each object must have exactly two properties:
- "text": a short description of the transaction (e.g. "Payment to John", "Starbucks", "Amazon")
- "amount": the numerical amount spent as a float (e.g. 15.50)

Ignore any incoming money (credits, money received). Only extract expenses.
Do not wrap your response in markdown blocks like \`\`\`json. Return ONLY the raw JSON array.

Statement Text:
${fullText.substring(0, 150000)} /* limit strictly in case of huge files */
`;

        const aiApiKey = process.env.GEMINI_API_KEY || '';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiApiKey}`;

        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
            })
        });

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error('Gemini API Error:', errText);
            throw new Error('AI analysis failed');
        }

        const geminiData = await geminiRes.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

        let rawResponse = responseText.trim();
        
        // Strip out any markdown formatting
        rawResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
            const expenses = JSON.parse(rawResponse);
            return NextResponse.json({ 
                expenses, 
                message: `Successfully parsed statement` 
            });
        } catch (jsonError) {
            console.error('JSON Parse Error:', jsonError, 'Raw Response:', rawResponse);
            return NextResponse.json({ error: 'Failed to parse AI response into valid transaction data' }, { status: 500 });
        }

    } catch (error) {
        console.error('Failed to parse GPay statements:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Unknown error occurred' 
        }, { status: 500 });
    }
}
