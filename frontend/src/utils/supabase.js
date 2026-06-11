import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wwjxmbuzyhruvzpqytrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3anhtYnV6eWhydXZ6cHF5dHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNjc1MzMsImV4cCI6MjA5NjY0MzUzM30.YF7CySuzwcSmrkCBeW6hn8OWIvaj8fhkm3UZA2MgE-E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
