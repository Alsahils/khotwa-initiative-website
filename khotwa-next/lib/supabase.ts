import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://teuhmjohpbxjqmenwrzs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldWhtam9ocGJ4anFtZW53cnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODgyNDUsImV4cCI6MjA4OTY2NDI0NX0.tlO-zMLSW6r9a6R-9winqB84E4ZLTF152R6CqxQ5bss";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
