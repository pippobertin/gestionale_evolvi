import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * La scheda Formazione del cliente serve? Sì per i clienti FPI e per chi ha già
 * dati di formazione (adesioni al fondo, rilevazioni del fabbisogno, piani,
 * corsi, certificazioni, documenti). Risponde anche se c'è un'adesione a FPI,
 * per mostrare o nascondere le parti specifiche del fondo.
 */
const TABELLE = [
  'scadenze_bandi_fabbisogno_rilevazioni',
  'scadenze_bandi_piani_formativi',
  'scadenze_bandi_corsi_formativi',
  'scadenze_bandi_certificazioni_obbligatorie',
  'scadenze_bandi_documenti_formazione'
]

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params

  const conta = (tabella: string) =>
    supabaseAdmin.from(tabella).select('id', { count: 'exact', head: true }).eq('cliente_id', id).then(r => r.count || 0)

  const [{ data: cliente }, adesioni, ...altri] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_clienti').select('categoria_evolvi').eq('id', id).maybeSingle(),
    conta('scadenze_bandi_clienti_adesioni_fpi'),
    ...TABELLE.map(conta)
  ])
  const fpi = cliente?.categoria_evolvi === 'FPI'
  const conAdesione = adesioni > 0
  return NextResponse.json({
    presente: fpi || conAdesione || altri.some(n => n > 0),
    fpi: fpi || conAdesione
  })
}
