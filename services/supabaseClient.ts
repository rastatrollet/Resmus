import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://btpexmjilzxkkvoozfpe.supabase.co';
const supabaseKey = 'sb_publishable_vQENjrmYXqCmFmDuL16s0Q_TEBpS2O1';

export const supabase = createClient(supabaseUrl, supabaseKey);
