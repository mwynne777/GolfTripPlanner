import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv'

const result = dotenv.config();
if (result.error) {
  throw result.error;
}
export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)