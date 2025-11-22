import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Ottieni impostazioni notifiche utente
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userEmail = searchParams.get('email')

    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email utente richiesta'
      }, { status: 400 })
    }

    // Cerca impostazioni esistenti
    const { data: settings, error } = await supabase
      .from('scadenze_bandi_notification_settings')
      .select('*')
      .eq('user_email', userEmail)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error
    }

    // Se non esistono impostazioni, ritorna valori di default
    if (!settings) {
      const defaultSettings = {
        user_email: userEmail,
        email_enabled: true,
        email_scadenze_1_giorno: true,
        email_scadenze_3_giorni: true,
        email_scadenze_7_giorni: true,
        email_scadenze_15_giorni: true,
        email_digest_settimanale: true,
        email_progetti_assegnati: true,
        calendar_enabled: false,
        calendar_id: null,
        calendar_sync_scadenze: true,
        calendar_sync_milestones: true,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00'
      }

      return NextResponse.json({
        success: true,
        data: defaultSettings
      })
    }

    return NextResponse.json({
      success: true,
      data: settings
    })

  } catch (error) {
    console.error('Errore recupero impostazioni notifiche:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}

// POST - Salva/aggiorna impostazioni notifiche utente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, settings } = body

    if (!userEmail || !settings) {
      return NextResponse.json({
        success: false,
        error: 'Email utente e impostazioni richieste'
      }, { status: 400 })
    }

    // Prepara i dati per il database
    const dbSettings = {
      user_email: userEmail,
      email_enabled: settings.emailNotifications.enabled,
      email_scadenze_1_giorno: settings.emailNotifications.scadenze_1_giorno,
      email_scadenze_3_giorni: settings.emailNotifications.scadenze_3_giorni,
      email_scadenze_7_giorni: settings.emailNotifications.scadenze_7_giorni,
      email_scadenze_15_giorni: settings.emailNotifications.scadenze_15_giorni,
      email_digest_settimanale: settings.emailNotifications.digest_settimanale,
      email_progetti_assegnati: settings.emailNotifications.progetti_assegnati,
      calendar_enabled: settings.calendarSync.enabled,
      calendar_id: settings.calendarSync.calendarId,
      calendar_sync_scadenze: settings.calendarSync.syncScadenze,
      calendar_sync_milestones: settings.calendarSync.syncMilestones,
      quiet_hours_enabled: settings.orariNonDisturbare.enabled,
      quiet_hours_start: settings.orariNonDisturbare.start,
      quiet_hours_end: settings.orariNonDisturbare.end,
      updated_at: new Date().toISOString()
    }

    // Upsert (insert or update)
    const { data, error } = await supabase
      .from('scadenze_bandi_notification_settings')
      .upsert(dbSettings, {
        onConflict: 'user_email'
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Impostazioni salvate con successo'
    })

  } catch (error) {
    console.error('Errore salvataggio impostazioni notifiche:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}