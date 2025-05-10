import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://chltyulqrsshopuzauqq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNobHR5dWxxcnNzaG9wdXphdXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MTM5ODksImV4cCI6MjA2MjI4OTk4OX0.riUL0X3RUqtUbV1ks_o8HzlhVJz56p21vImxaODaLek"; // anon public key
export const supabase = createClient(supabaseUrl, supabaseKey);
