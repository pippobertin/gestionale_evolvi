import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { caricaPermessi, dimenticaPermessi } from '@/lib/permessi'
import { registraEvento } from '@/lib/registro'
import { ETICHETTE_RUOLO, RUOLI_CONFIGURABILI } from '@/lib/ruoli'

/** Matrice dei permessi per ruolo (fase 4C), solo amministratori. */

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  const { catalogo, matrice } = await caricaPermessi(true)
  const [{ data: au }, { data: utenti }] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_system_settings').select('value').eq('key', 'utente_au').maybeSingle(),
    supabaseAdmin.from('scadenze_bandi_utenti').select('id, nome, cognome').eq('attivo', true).neq('livello_permessi', 'odv').order('nome')
  ])
  return NextResponse.json({
    au_id: au?.value || null,
    utenti: (utenti || []).map(u => ({ id: u.id, nome: `${u.nome || ''} ${u.cognome || ''}`.trim() })),
    catalogo,
    ruoli: RUOLI_CONFIGURABILI.map(r => ({ ruolo: r, etichetta: ETICHETTE_RUOLO[r] })),
    matrice
  })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const corpo = await request.json().catch(() => ({}))
  const { ruolo, permesso, consentito } = corpo

  // Amministratrice Unica della società (domande di BLM in proprio, Modello 231)
  if (corpo.au_id !== undefined) {
    if (corpo.au_id !== null && !/^[0-9a-fA-F-]{36}$/.test(String(corpo.au_id))) {
      return NextResponse.json({ error: 'Utente non valido' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from('scadenze_bandi_system_settings')
      .update({ value: corpo.au_id, updated_at: new Date().toISOString() }).eq('key', 'utente_au')
    if (error) return NextResponse.json({ error: 'Salvataggio non riuscito' }, { status: 500 })
    await registraEvento({
      evento: 'permessi_modificati', utenteId: admin.userId, request,
      descrizione: 'Indicata l\'Amministratrice Unica della società', dettagli: { au_id: corpo.au_id }
    })
    return NextResponse.json({ ok: true })
  }
  const { catalogo } = await caricaPermessi(true)
  const voce = catalogo.find(c => c.chiave === permesso)
  if (!RUOLI_CONFIGURABILI.includes(ruolo) || !voce || typeof consentito !== 'boolean') {
    return NextResponse.json({ error: 'Dati non validi' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('scadenze_bandi_permessi_ruolo')
    .upsert({ ruolo, permesso, consentito, aggiornato_da: admin.userId, aggiornato_il: new Date().toISOString() })
  if (error) {
    console.error('[permessi] salvataggio:', error.message)
    return NextResponse.json({ error: 'Salvataggio non riuscito' }, { status: 500 })
  }
  dimenticaPermessi()

  await registraEvento({
    evento: 'permessi_modificati', utenteId: admin.userId, request,
    descrizione: `${ETICHETTE_RUOLO[ruolo as keyof typeof ETICHETTE_RUOLO]}: "${voce.etichetta}" ${consentito ? 'concesso' : 'tolto'}`,
    dettagli: { ruolo, permesso, consentito }
  })

  return NextResponse.json({ ok: true })
}
