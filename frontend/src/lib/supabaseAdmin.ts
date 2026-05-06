import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase con SERVICE ROLE KEY.
 *
 * IMPORTANTE: usare SOLO da codice server-side (API routes, server actions).
 * Bypassa Row Level Security. Mai importare da componenti client/browser.
 *
 * Richiede env var: SUPABASE_SERVICE_ROLE_KEY (NON con prefisso NEXT_PUBLIC_).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL non configurata')
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurata')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
