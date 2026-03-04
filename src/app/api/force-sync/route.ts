import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
    try {
        const { targetAccountId, requestingUserId } = await req.json();

        // Validate UUID format
        if (!targetAccountId || !UUID_REGEX.test(targetAccountId)) {
            return NextResponse.json({ error: 'Invalid Account ID format — must be a UUID.' }, { status: 400 });
        }

        // Use service role key (server-side only)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch all data from the target account
        const [chatsResult, prefsResult] = await Promise.all([
            supabase
                .from('disciplinist_daily_chats')
                .select('*')
                .eq('user_id', targetAccountId)
                .order('date', { ascending: false })
                .limit(365),
            supabase
                .from('disciplinist_preferences')
                .select('*')
                .eq('user_id', targetAccountId)
                .single(),
        ]);

        // Return all data — client will hydrate from this
        return NextResponse.json({
            chats: chatsResult.data ?? [],
            preferences: prefsResult.data ?? null,
            syncedAt: new Date().toISOString(),
            targetAccountId,
        });

    } catch (err: unknown) {
        console.error('[force-sync] error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
