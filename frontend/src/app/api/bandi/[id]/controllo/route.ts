import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { bandiDaControllare, controllaBando, indirizzo } from '@/lib/controlloBandi'
import { erroreDatabase } from '@/lib/praticaForm'

/**
 * Controllo della pagina di un bando: pagine controllate con l'esito
 * dell'ultima lettura, novità trovate, modalità (automatico, acceso, spento).
 * POST: { azione: 'controlla' } controlla subito; { azione: 'aggiungi', url, etichetta } aggiunge una pagina.
 * PATCH: { modalita } oppure { paginaId, attiva }. DELETE ?pagina=: toglie una pagina aggiunta o trovata in automatico.
 */
export const maxDuration = 120

type Ctx = { params: Promise<{ id: string }> }

async function stato(id: string) {
  const [{ data: bando }, { data: pagine }, { data: novita }, attivi] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_bandi').select('id, nome, controllo_pagina, link_bando_ufficiale').eq('id', id).maybeSingle(),
    supabaseAdmin.from('scadenze_bandi_controllo_pagine').select('id, url, etichetta, origine, attiva, link_noti, ultimo_controllo, esito, messaggio').eq('bando_id', id).order('created_at'),
    supabaseAdmin.from('scadenze_bandi_controllo_novita').select('id, url, testo, tipo, parole, trovata_il, stato, decisa_il, scadenze_create').eq('bando_id', id).order('trovata_il', { ascending: false }).limit(100),
    bandiDaControllare()
  ])
  if (!bando) return null
  return {
    modalita: bando.controllo_pagina,
    controllato: attivi.includes(id),
    link_ufficiale: bando.link_bando_ufficiale,
    // Le sottopagine tolte (spente) restano registrate ma non si mostrano
    pagine: (pagine || []).filter((p: any) => p.origine !== 'sottopagina' || p.attiva)
      .map(({ link_noti, ...p }: any) => ({ ...p, collegamenti_noti: Array.isArray(link_noti) ? link_noti.length : 0 })),
    sottopagine_tolte: (pagine || []).filter((p: any) => p.origine === 'sottopagina' && !p.attiva).length,
    novita: novita || []
  }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const s = await stato(id)
  if (!s) return NextResponse.json({ error: 'Bando non trovato' }, { status: 404 })
  return NextResponse.json(s)
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ error: 'Operazione non consentita' }, { status: 403 })
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  if (b.azione === 'controlla') {
    const risultato = await controllaBando(id)
    return NextResponse.json({ risultato, ...(await stato(id)) })
  }
  if (b.azione === 'aggiungi') {
    const url = typeof b.url === 'string' ? indirizzo(b.url, b.url) : null
    if (!url) return NextResponse.json({ error: 'Indica un indirizzo valido che inizi con http:// o https://' }, { status: 400 })
    const { error } = await supabaseAdmin.from('scadenze_bandi_controllo_pagine')
      .insert({ bando_id: id, url, etichetta: (b.etichetta || '').toString().trim().slice(0, 120) || null, origine: 'aggiunta', creata_da: sessione.userId })
    if (error) return error.code === '23505' ? NextResponse.json({ error: 'Questa pagina è già tra quelle controllate' }, { status: 400 }) : erroreDatabase(error)
    return NextResponse.json(await stato(id))
  }
  return NextResponse.json({ error: 'Azione non riconosciuta' }, { status: 400 })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ error: 'Operazione non consentita' }, { status: 403 })
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  if (b.modalita) {
    if (!['auto', 'acceso', 'spento'].includes(b.modalita)) return NextResponse.json({ error: 'Modalità non valida' }, { status: 400 })
    const { error } = await supabaseAdmin.from('scadenze_bandi_bandi').update({ controllo_pagina: b.modalita }).eq('id', id)
    if (error) return erroreDatabase(error)
  } else if (b.paginaId) {
    const { error } = await supabaseAdmin.from('scadenze_bandi_controllo_pagine')
      .update({ attiva: !!b.attiva, updated_at: new Date().toISOString() }).eq('id', b.paginaId).eq('bando_id', id)
    if (error) return erroreDatabase(error)
  }
  return NextResponse.json(await stato(id))
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ error: 'Operazione non consentita' }, { status: 403 })
  const { id } = await params
  const pagina = request.nextUrl.searchParams.get('pagina')
  if (!pagina) return NextResponse.json({ error: 'Pagina non indicata' }, { status: 400 })
  const { data: riga } = await supabaseAdmin.from('scadenze_bandi_controllo_pagine').select('origine').eq('id', pagina).eq('bando_id', id).maybeSingle()
  if (!riga) return NextResponse.json({ error: 'Pagina non trovata' }, { status: 404 })
  // La pagina ufficiale segue il link del bando: si spegne, non si toglie.
  // Una sottopagina trovata in automatico resta registrata spenta, così non ricompare al controllo successivo.
  const { error } = riga.origine === 'link_ufficiale'
    ? { error: { message: 'La pagina ufficiale segue il link del bando: per non controllarla togli la spunta "controlla"' } as any }
    : riga.origine === 'sottopagina'
      ? await supabaseAdmin.from('scadenze_bandi_controllo_pagine').update({ attiva: false, messaggio: 'tolta dal controllo', updated_at: new Date().toISOString() }).eq('id', pagina)
      : await supabaseAdmin.from('scadenze_bandi_controllo_pagine').delete().eq('id', pagina)
  if (error) return erroreDatabase(error)
  return NextResponse.json(await stato(id))
}
