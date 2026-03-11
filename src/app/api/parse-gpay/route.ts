import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
const pdfParse = require('pdf-parse'); // eslint-disable-line @typescript-eslint/no-require-imports
import { GoogleGenAI } from '@google/genai';

export async function POST() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        // This is the directory specified by the user
        const targetDir = 'C:\\Users\\Asus\\Downloads\\referencex1';
        
        if (!fs.existsSync(targetDir)) {
            return NextResponse.json({ error: `Directory not found: ${targetDir}` }, { status: 404 });
        }
        
        const files = fs.readdirSync(targetDir);
        const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
        
        if (pdfFiles.length === 0) {
            return NextResponse.json({ error: `No PDF files found in ${targetDir}` }, { status: 404 });
        }
        
        // Assuming we want to parse the first PDF found, or process all. 
        // Let's process the first one for simplicity, or we can combine text from all.
        let fullText = '';
        for (const file of pdfFiles) {
            const filePath = path.join(targetDir, file);
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            fullText += `\n--- File: ${file} ---\n` + data.text;
        }

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
${fullText.substring(0, 30000)} /* limit strictly in case of huge files */
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                temperature: 0.1,
            }
        });

        let rawResponse = response.text?.trim() || '[]';
        
        // Strip out any markdown formatting just in case
        if (rawResponse.startsWith('```json')) {
            rawResponse = rawResponse.substring(7);
        }
        if (rawResponse.startsWith('```')) {
            rawResponse = rawResponse.substring(3);
        }
        if (rawResponse.endsWith('```')) {
            rawResponse = rawResponse.substring(0, rawResponse.length - 3);
        }
        rawResponse = rawResponse.trim();
        
        const expenses = JSON.parse(rawResponse);
        
        return NextResponse.json({ expenses, message: `Successfully parsed ${pdfFiles.length} file(s)` });

    } catch (error) {
        console.error('Failed to parse GPay statements:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 });
    }
}
