import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // Aggiunge campi Google Drive alla tabella documenti_progetto
    const { error: alterError } = await supabase.rpc('sql', {
      query: `
        ALTER TABLE scadenze_bandi_documenti_progetto
        ADD COLUMN IF NOT EXISTS google_drive_id TEXT,
        ADD COLUMN IF NOT EXISTS google_drive_url TEXT,
        ADD COLUMN IF NOT EXISTS google_drive_modified TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS has_changes BOOLEAN DEFAULT false;

        CREATE INDEX IF NOT EXISTS idx_documenti_progetto_google_drive_id
        ON scadenze_bandi_documenti_progetto(google_drive_id);
      `
    })

    if (alterError) {
      throw alterError
    }

    return Response.json({
      success: true,
      message: 'Database migrato con successo - aggiunti campi Google Drive'
    })

  } catch (error: any) {
    console.error('Errore migrazione database:', error)
    return Response.json({
      success: false,
      message: 'Errore durante migrazione database',
      error: error.message
    }, { status: 500 })
  }
}