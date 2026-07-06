import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

// Client is null if env vars aren't set (e.g., local dev without .env),
// so the insert call fails silently rather than breaking the app.
export const supabase = (url && key) ? createClient(url, key) : null