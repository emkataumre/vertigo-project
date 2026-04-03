import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zjcnftdyjukobigtxfwm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_QJvFNpSnBJWf47u6dV46YQ_RfNROmMn";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
