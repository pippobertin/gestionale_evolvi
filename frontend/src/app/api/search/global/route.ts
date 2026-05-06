import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return Response.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    // Sanitize for Supabase .or() filter syntax
    const sanitized = q.replace(/[%_.,"()\\]/g, '')
    if (!sanitized) {
      return Response.json({ success: true, results: {}, totalCount: 0 })
    }

    const pattern = `%${sanitized}%`

    const [clienti, bandi, progetti, prospect, scadenze, contratti, fatture] = await Promise.all([
      supabase
        .from('scadenze_bandi_clienti')
        .select('id, denominazione, partita_iva, email')
        .or(`denominazione.ilike.${pattern},partita_iva.ilike.${pattern},email.ilike.${pattern}`)
        .limit(5),

      supabase
        .from('scadenze_bandi_bandi')
        .select('id, nome, codice_bando, ente_erogatore')
        .or(`nome.ilike.${pattern},codice_bando.ilike.${pattern},ente_erogatore.ilike.${pattern}`)
        .limit(5),

      supabase
        .from('scadenze_bandi_progetti')
        .select('id, titolo_progetto, codice_progetto, cliente_id, scadenze_bandi_clienti(denominazione), scadenze_bandi_bandi(nome)')
        .or(`titolo_progetto.ilike.${pattern},codice_progetto.ilike.${pattern}`)
        .limit(5),

      supabase
        .from('scadenze_bandi_prospect')
        .select('id, denominazione, partita_iva, email, stato, motivo_congelamento')
        .or(`denominazione.ilike.${pattern},partita_iva.ilike.${pattern},email.ilike.${pattern},motivo_congelamento.ilike.${pattern}`)
        .limit(5),

      supabase
        .from('scadenze_bandi_scadenze')
        .select('id, titolo, data_scadenza, stato, progetto_id, scadenze_bandi_progetti(titolo_progetto)')
        .ilike('titolo', pattern)
        .limit(5),

      supabase
        .from('scadenze_bandi_contratti_evolvi')
        .select('id, numero_contratto, stato, cliente_id, scadenze_bandi_clienti(denominazione)')
        .ilike('numero_contratto', pattern)
        .limit(5),

      supabase
        .from('scadenze_bandi_evolvi_fatture')
        .select('id, numero_fattura, stato_pagamento, cliente_id, scadenze_bandi_clienti(denominazione)')
        .ilike('numero_fattura', pattern)
        .limit(5),
    ])

    const results = {
      clienti: clienti.data || [],
      bandi: bandi.data || [],
      progetti: (progetti.data || []).map((p: any) => ({
        id: p.id,
        titolo_progetto: p.titolo_progetto,
        codice_progetto: p.codice_progetto,
        cliente_id: p.cliente_id,
        cliente_denominazione: p.scadenze_bandi_clienti?.denominazione,
        bando_nome: p.scadenze_bandi_bandi?.nome,
      })),
      prospect: prospect.data || [],
      scadenze: (scadenze.data || []).map((s: any) => ({
        id: s.id,
        titolo: s.titolo,
        data_scadenza: s.data_scadenza,
        stato: s.stato,
        progetto_titolo: s.scadenze_bandi_progetti?.titolo_progetto,
      })),
      contratti: (contratti.data || []).map((c: any) => ({
        id: c.id,
        numero_contratto: c.numero_contratto,
        stato: c.stato,
        cliente_id: c.cliente_id,
        cliente_denominazione: c.scadenze_bandi_clienti?.denominazione,
      })),
      fatture: (fatture.data || []).map((f: any) => ({
        id: f.id,
        numero_fattura: f.numero_fattura,
        stato_pagamento: f.stato_pagamento,
        cliente_id: f.cliente_id,
        cliente_denominazione: f.scadenze_bandi_clienti?.denominazione,
      })),
    }

    const totalCount = Object.values(results).reduce((sum, arr) => sum + (arr as any[]).length, 0)

    return Response.json({ success: true, results, totalCount })
  } catch (error: any) {
    console.error('Global search error:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
