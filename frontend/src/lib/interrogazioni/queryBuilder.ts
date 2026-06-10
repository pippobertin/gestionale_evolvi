/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import type { DefinizioneAmbito, ValoreFiltro } from './registry'

/**
 * Costruisce ed esegue una query Supabase a partire dalla definizione
 * dell'ambito e dai filtri inviati dal client.
 *
 * Restituisce { righe, totale } dove le righe contengono anche i campi
 * arricchiti del cliente (se join_cliente = true).
 */
export async function eseguiInterrogazione(opts: {
  ambito: DefinizioneAmbito
  filtri: Record<string, ValoreFiltro>
  pagina?: number
  per_pagina?: number
  senza_paginazione?: boolean   // per export: ritorna tutto
}): Promise<{ righe: any[]; totale: number }> {
  const { ambito, filtri, pagina = 1, per_pagina = 25, senza_paginazione = false } = opts

  // SELECT: tutti i campi della tabella + eventuale join cliente.
  // Includiamo anche email/pec/telefono per supportare le azioni bulk (email/scadenza).
  let selectExpr = '*'
  if (ambito.join_cliente) {
    selectExpr =
      '*, cliente:scadenze_bandi_clienti!cliente_id(id, denominazione, partita_iva, ateco_2025, dimensione, categoria_evolvi, provincia_fatturazione, email, pec, telefono)'
  }

  let query = supabase
    .from(ambito.tabella)
    .select(selectExpr, { count: 'exact' })

  // Applica ogni filtro
  for (const [campo, valore] of Object.entries(filtri)) {
    query = applicaFiltro(query, campo, valore)
  }

  // Ordinamento
  if (ambito.ordinamento_default) {
    query = query.order(ambito.ordinamento_default.campo, {
      ascending: ambito.ordinamento_default.direzione === 'asc',
      nullsFirst: false,
    })
  }

  // Paginazione
  if (!senza_paginazione) {
    const from = (pagina - 1) * per_pagina
    const to = from + per_pagina - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  if (error) {
    throw new Error(`Errore interrogazione: ${error.message}`)
  }

  return {
    righe: (data || []) as any[],
    totale: count ?? (data?.length ?? 0),
  }
}

/**
 * Applica un singolo filtro alla query.
 * Per i tipi complessi (array, range) usa gli operatori specifici di Supabase.
 */
function applicaFiltro(query: any, campo: string, valore: ValoreFiltro): any {
  if (!valore) return query

  switch (valore.tipo) {
    case 'text': {
      const v = valore.valore?.trim()
      if (!v) return query
      return query.ilike(campo, `%${v}%`)
    }

    case 'select': {
      const v = valore.valore?.trim()
      if (!v) return query
      return query.eq(campo, v)
    }

    case 'multiselect_scalar': {
      if (!valore.valori?.length) return query
      return query.in(campo, valore.valori)
    }

    case 'multiselect_array': {
      // Operatore '&&' (overlap): la colonna array contiene almeno un valore dell'array filtro
      if (!valore.valori?.length) return query
      return query.overlaps(campo, valore.valori)
    }

    case 'number': {
      if (valore.valore === undefined || valore.valore === null || Number.isNaN(valore.valore)) return query
      return query.eq(campo, valore.valore)
    }

    case 'number_range': {
      if (valore.min !== undefined && !Number.isNaN(valore.min)) {
        query = query.gte(campo, valore.min)
      }
      if (valore.max !== undefined && !Number.isNaN(valore.max)) {
        query = query.lte(campo, valore.max)
      }
      return query
    }

    case 'date_range': {
      if (valore.da) query = query.gte(campo, valore.da)
      if (valore.a) query = query.lte(campo, valore.a)
      return query
    }

    default:
      return query
  }
}

/**
 * Estrae il valore di un campo dalla riga, supportando notazione "cliente.X".
 */
export function leggiCampo(riga: any, campo: string): unknown {
  if (campo.includes('.')) {
    const parti = campo.split('.')
    let v: any = riga
    for (const p of parti) {
      if (v == null) return null
      v = v[p]
    }
    return v
  }
  return riga[campo]
}
