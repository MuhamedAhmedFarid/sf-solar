
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yabolqusdeqmwjwxdvsp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYm9scXVzZGVxbXdqd3hkdnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTkxMDYsImV4cCI6MjA4MzI5NTEwNn0.Q5TJ1jt-jeRuI2PBAH7MEMPfVI2CVIj8ojMpYzfJgTI';

export const supabase = createClient(supabaseUrl, supabaseKey);
