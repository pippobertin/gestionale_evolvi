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
  return NextResponse.json({
    catalogo,
    ruoli: RUOLI_CONFIGURABILI.map(r => ({ ruolo: r, etichetta: ETICHETTE_RUOLO[r] })),
    matrice
  })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const { ruolo, permesso, consentito } = await request.json().catch(() => ({}))
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
