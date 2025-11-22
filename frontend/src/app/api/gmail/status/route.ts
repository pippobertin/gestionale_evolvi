import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Controlla se esistono tokens Gmail
    const { data: refreshTokenData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value, updated_at')
      .eq('key', 'gmail_refresh_token')
      .single()

    const { data: lastTestData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value, updated_at')
      .eq('key', 'gmail_last_test')
      .single()

    const configured = !!refreshTokenData?.value

    return NextResponse.json({
      configured,
      email: configured ? 'info@blmproject.com' : null,
      lastTest: lastTestData?.updated_at || null,
      configuredAt: refreshTokenData?.updated_at || null
    })

  } catch (error) {
    console.error('Errore controllo Gmail status:', error)
    return NextResponse.json({
      configured: false,
      error: 'Errore controllo configurazione'
    })
  }
}