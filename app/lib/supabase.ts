import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hqnyqqmqpjmuyanmupxr.supabase.co";

const supabaseKey = "sb_publishable_IP_qqclWTJZfTeuTWNurTg_1Kbe6z9W";

export const supabase = createClient(supabaseUrl, supabaseKey);