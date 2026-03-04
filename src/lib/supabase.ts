import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = 'https://txqcuqhauipyzckefkqp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cWN1cWhhdWlweXpja2Vma3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTY0OTEsImV4cCI6MjA4NzIzMjQ5MX0.IAQH3xQoMGcUQ9_bv1EIpyJpf1shlHMBOg__F5SXIYA';

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

export type AuthUser = {
    id: string;
    email: string;
};
