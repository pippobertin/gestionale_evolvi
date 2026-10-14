import { supabase } from '@/lib/supabase'
import type { ContributoStato } from './types'

type Progetto = {
  id: string
  cliente_id: string | null
  bando_id: string | null
  titolo_progetto: string | null
  codice_progetto: string | null
  importo_totale_progetto: number | null
  contributo_ammesso: number | null
  contributo_ottenuto: number | null
  data_decreto_concessione: string | null
  data_fine_progetto_effettiva: string | null
  data_avvio_progetto: string | null
  created_at: string
}

export type SyncContributoResult = {
  action: 'insert' | 'update' | 'delete' | 'skip'
  contributoId: string | null
  error?: string
}

/**
 * Allinea la riga di scadenze_bandi_contributi_ottenuti collegata a un progetto.
 * Stessa logica del backfill in sql/formazione/013_create_contributi_ottenuti.sql.
 *
 * Best effort: non lancia mai eccezioni. In caso di errore ritorna
 * { action: 'skip', error } e il chiamante (save progetto) prosegue.
 */
export async function syncContributoDaProgetto(progettoId: string): Promise<SyncContributoResult> {
  try {
    // 1. Carica progetto
    const { data: progetto, error: errP } = await supabase
      .from('scadenze_bandi_progetti')
      .select('id, cliente_id, bando_id, titolo_progetto, codice_progetto, importo_totale_progetto, contributo_ammesso, contributo_ottenuto, data_decreto_concessione, data_fine_progetto_effettiva, data_avvio_progetto, created_at')
      .eq('id', progettoId)
      .single<Progetto>()

    if (errP || !progetto) {
      return { action: 'skip', contributoId: null, error: errP?.message }
    }
    if (!progetto.cliente_id) {
      return { action: 'skip', contributoId: null }
    }

    // 2. Riga esistente?
    const { data: esistente, error: errE } = await supabase
      .from('scadenze_bandi_contributi_ottenuti')
      .select('id, bando_denominazione_manuale')
      .eq('progetto_id', progettoId)
      .maybeSingle<{ id: string; bando_denominazione_manuale: string | null }>()

    if (errE) {
      return { action: 'skip', contributoId: null, error: errE.message }
    }

    const importoCalcolato = progetto.contributo_ottenuto ?? progetto.contributo_ammesso
    const noContributo = importoCalcolato == null

    // 3. Progetto senza contributo valorizzato -> cancella se esisteva
    if (noContributo) {
      if (esistente) {
        const { error: errD } = await supabase
          .from('scadenze_bandi_contributi_ottenuti')
          .delete()
          .eq('id', esistente.id)
        if (errD) return { action: 'skip', contributoId: esistente.id, error: errD.message }
        return { action: 'delete', contributoId: esistente.id }
      }
      return { action: 'skip', contributoId: null }
    }

    // 4. Calcoli derivati
    // Anno in UTC, come EXTRACT(YEAR ...) del backfill SQL
    const annoRef = new Date(
      progetto.data_decreto_concessione
      ?? progetto.data_fine_progetto_effettiva
      ?? progetto.data_avvio_progetto
      ?? progetto.created_at
    ).getUTCFullYear()

    const statoCalcolato: ContributoStato =
      progetto.data_fine_progetto_effettiva ? 'EROGATO_TOTALE'
      : progetto.data_decreto_concessione ? 'CONCESSO'
      : 'AMMESSO'

    const bandoDenomDefault =
      progetto.titolo_progetto?.trim() || progetto.codice_progetto || `Progetto ${progetto.id}`

    // 5. UPDATE o INSERT
    if (esistente) {
      const updates: Record<string, unknown> = {
        cliente_id: progetto.cliente_id,
        bando_id: progetto.bando_id,
        importo_progetto: progetto.importo_totale_progetto,
        importo_contributo: importoCalcolato,
        data_concessione: progetto.data_decreto_concessione,
        anno_competenza: annoRef,
        stato: statoCalcolato,
        // NON toccare: forma_contributo, esl, intensita_aiuto_pct,
        // regime_aiuto, rna_*, note, origine (già DA_PROGETTO)
      }
      // La denominazione manuale è editabile dall'utente: la valorizziamo solo
      // se il progetto ha perso il bando e la riga non ne ha già una (CHECK).
      if (!progetto.bando_id && !esistente.bando_denominazione_manuale) {
        updates.bando_denominazione_manuale = bandoDenomDefault
      }

      const { error: errU } = await supabase
        .from('scadenze_bandi_contributi_ottenuti')
        .update(updates)
        .eq('id', esistente.id)

      if (errU) return { action: 'skip', contributoId: esistente.id, error: errU.message }
      return { action: 'update', contributoId: esistente.id }
    }

    const { data: inserito, error: errI } = await supabase
      .from('scadenze_bandi_contributi_ottenuti')
      .insert({
        cliente_id: progetto.cliente_id,
        progetto_id: progetto.id,
        anno_competenza: annoRef,
        bando_id: progetto.bando_id,
        bando_denominazione_manuale: progetto.bando_id ? null : bandoDenomDefault,
        forma_contributo: 'FONDO_PERDUTO',
        importo_progetto: progetto.importo_totale_progetto,
        importo_contributo: importoCalcolato,
        data_concessione: progetto.data_decreto_concessione,
        stato: statoCalcolato,
        origine: 'DA_PROGETTO',
      })
      .select('id')
      .single<{ id: string }>()

    if (errI || !inserito) return { action: 'skip', contributoId: null, error: errI?.message }
    return { action: 'insert', contributoId: inserito.id }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Errore sync contributo'
    return { action: 'skip', contributoId: null, error: msg }
  }
}
