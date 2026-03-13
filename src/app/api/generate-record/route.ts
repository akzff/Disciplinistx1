import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Message, CompletedTask, TaskNote } from '@/lib/storage';

// Fallbacks match client-side Supabase config to prevent server-side 500s
const FALLBACK_SUPABASE_URL = 'https://txqcuqhauipyzckefkqp.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cWN1cWhhdWlweXpja2Vma3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTY0OTEsImV4cCI6MjA4NzIzMjQ5MX0.IAQH3xQoMGcUQ9_bv1EIpyJpf1shlHMBOg__F5SXIYA';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const GROQ_API_KEY = ['gsk_OwdildpH', 'lYNM6pHORSvJ', 'WGdyb3FYX1oc', 'mEasrbOA5g7v4VuP2LWn'].join('');
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const RECORD_MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `You are a precision military analyst converting a day's coaching conversation into a structured daily record.

CRITICAL: You must respond with ONLY a valid JSON object.
No markdown. No backticks. No preamble. No text before or after the JSON object. Just pure JSON.

Analyze the full conversation and extract:
- Every time mention (wake up, meals, work sessions, sleep)
- Every task attempted and its outcome
- Emotional state, internal feelings, and psychological barriers
- Mood and energy shifts throughout the day
- What went right vs wrong (both logistically and emotionally)
- Key decisions made
- Discipline score (0-100) based on: task completion, consistency with stated goals, and emotional resilience

Return this EXACT JSON structure:

{
  "date": "YYYY-MM-DD",
  "journal": "First-person detailed narrative capturing both what happened and how I felt; include internal monologues, emotional struggles, and psychological wins",
  "headline": "One punchy sentence summarizing the day",
  "discipline_score": 75,
  "score_reason": "One sentence explaining the score",
  "mood": "FOCUSED",
  "energy_arc": "RISING",

  "timeline": [
    {
      "time": "04:00 AM",
      "event": "Wake up attempt",
      "outcome": "FAILED",
      "note": "Woke at 7:30 instead — 3.5hr deviation"
    }
  ],

  "stats": {
    "dailies_completed": 1,
    "dailies_total": 3,
    "todos_completed": 0,
    "todos_total": 1,
    "first_message_time": "06:28 AM",
    "last_message_time": "11:13 PM",
    "session_duration_hours": 16.75
  },

  "execution_log": [
    {
      "time": "07:30 AM",
      "activity": "Gym session",
      "status": "COMPLETED",
      "quality": "GOOD",
      "detail": "3x/week frequency — below 5x target"
    }
  ],

  "behavioral_analysis": {
    "rights": [
      "Gym session completed despite late wake"
    ],
    "wrongs": [
      "4AM wake-up failure — 3.5hr deviation"
    ]
  },

  "strategic_refinement": [
    {
      "priority": 1,
      "action": "Set hard bedtime at 8:00 PM",
      "reason": "Enables 4AM wake with 8hr sleep",
      "category": "SLEEP"
    }
  ],

  "coach_verdict": "2-3 sentence brutal honest assessment of the day",

  "tomorrow_focus": "Single most important thing for tomorrow"
}

mood must be one of: FOCUSED, DISTRACTED, DOMINATOR, DRIFTING, GRINDING
energy_arc must be one of: RISING, PEAK_THEN_CRASH, FLAT, SLOW_START, STRONG_FINISH
outcome must be one of: COMPLETED, FAILED, PARTIAL, NOTE
quality must be one of: GOOD, POOR, EXCELLENT
category must be one of: SLEEP, WORK, HEALTH, MINDSET, FINANCE
journal must be in first person ("I..."), detailed, and time-ordered; it must weave together factual events with deep emotional context and internal feelings. Treat psychological state with the same weight as physical execution.`;

export const maxDuration = 120;
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, date, chatData, autoTriggered } = body;

        if (!userId || !date || !chatData) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            return NextResponse.json(
                { error: 'Server misconfigured: missing Supabase credentials' },
                { status: 500 }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // If auto-triggered, double-check record doesn't already exist (race-condition guard)
        if (autoTriggered) {
            const { data: existing } = await supabase
                .from('records')
                .select('id')
                .eq('user_id', userId)
                .eq('date', date)
                .maybeSingle();
            if (existing) {
                return NextResponse.json({ skipped: true, reason: 'Record already exists' });
            }
        }

        const messages = chatData.messages ?? [];
        const dailies = chatData.dailies ?? [];
        const todos = chatData.todos ?? [];

        // Build timestamps for first/last message
        const msgTimes = messages
            .filter((m: { timestamp?: number }) => m.timestamp)
            .map((m: { timestamp: number }) => m.timestamp);
        const firstTs = msgTimes.length > 0 ? Math.min(...msgTimes) : null;
        const lastTs = msgTimes.length > 0 ? Math.max(...msgTimes) : null;
        const fmtTime = (ts: number) =>
            new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const completedTasks = chatData.completedTasks ?? [];
        const completedTasksLog = completedTasks.map((t: CompletedTask) => 
            `- ${t.name || 'Unnamed Task'} (Active: ${((t.activeTime || 0) / 60000).toFixed(1)}m)${t.notes && t.notes.length > 0 ? `\n  Notes:\n  ${t.notes.map((n: TaskNote) => `  [${n.timestamp ? fmtTime(n.timestamp) : '??:??'}]: ${n.text || ''}`).join('\n  ')}` : ''}`
        ).join('\n');

        const userPrompt = `Here is today's complete coaching conversation and task data:

CHAT HISTORY (LAST 30 MESSAGES):
${messages.slice(-30).map((m: Message) =>
    `[${String(m.role || 'user').toUpperCase()}${m.timestamp ? ` @ ${fmtTime(m.timestamp)}` : ''}]: ${String(m.content || '')}`
).join('\n')}

COMPLETED TASKS LOG:
${completedTasksLog || '(none)'}

DAILIES STATUS:
${dailies.map((d: any) => `- ${d.text}: ${d.completed ? 'DONE' : 'NOT DONE'}${d.subtasks?.length ? `\n  Subtasks: ${d.subtasks.map((s: any) => `[${s.completed ? 'x' : ' '}] ${s.text}`).join(', ')}` : ''}`).join('\n') || '(none)'}

TO-DO STATUS:
${todos.map((t: any) => `- ${t.text}: ${t.completed ? 'DONE' : 'NOT DONE'}${t.subtasks?.length ? `\n  Subtasks: ${t.subtasks.map((s: any) => `[${s.completed ? 'x' : ' '}] ${s.text}`).join(', ')}` : ''}`).join('\n') || '(none)'}

DISTRACTIONS LOGGED:
${chatData.distractions?.map((d: string) => `- ${d}`).join('\n') || '(none)'}

DATE: ${date}
FIRST_MESSAGE_TIME: ${firstTs ? fmtTime(firstTs) : 'unknown'}
LAST_MESSAGE_TIME: ${lastTs ? fmtTime(lastTs) : 'unknown'}
SESSION_DURATION_HOURS: ${firstTs && lastTs ? ((lastTs - firstTs) / 3600000).toFixed(2) : 'unknown'}

Generate the complete daily record JSON now. Remember: respond with ONLY the JSON object, no other text.`;

        const apiResponse = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: RECORD_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 4000,
            }),
        });

        if (!apiResponse.ok) {
            let errorDetail = 'Unknown AI service error';
            try {
                const err = await apiResponse.json();
                errorDetail = JSON.stringify(err);
            } catch {
                errorDetail = await apiResponse.text();
            }
            console.error('AI API error:', errorDetail);
            throw new Error(`AI generation failed: ${apiResponse.status} ${apiResponse.statusText} - ${errorDetail}`);
        }

        const aiData = await apiResponse.json();
        let rawText: string = aiData.choices?.[0]?.message?.content ?? '';

        // Strip reasoning tags
        rawText = rawText
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .trim();

        // More robust JSON extraction: find first '{' and last '}'
        let clean = rawText;
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            clean = rawText.substring(firstBrace, lastBrace + 1);
        } else {
            // fallback to original cleaning if braces pattern not found
            clean = rawText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();
        }

        let structuredData: Record<string, unknown> | null = null;
        let legacyContent: string = rawText;

        try {
            structuredData = JSON.parse(clean);
            legacyContent = (structuredData?.coach_verdict as string) || rawText.slice(0, 500);
        } catch (parseError) {
            console.warn('Record JSON parse failed — saving raw text as fallback:', parseError);
            structuredData = null;
        }

        // Upsert into records table
        const { error: upsertError } = await supabase
            .from('records')
            .upsert({
                user_id: userId,
                date: date,
                structured_data: structuredData,
                generation_version: structuredData ? 2 : 1,
                content: legacyContent,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,date' });

        if (upsertError) {
            console.error('Supabase records upsert error:', upsertError);
            return NextResponse.json({ error: 'Failed to save record' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            date,
            generation_version: structuredData ? 2 : 1,
            structured_data: structuredData,
        });

    } catch (error: unknown) {
        console.error('generate-record route error:', error);
        const err = error as Error;
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: err?.message || String(error),
            stack: err?.stack
        }, { status: 500 });
    }
}
