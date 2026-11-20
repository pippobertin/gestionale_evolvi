import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cestino degli archivi file (fase 4B): un file eliminato dal gestionale non
 * viene cancellato, ma spostato in _cestino/<percorso originale> nello stesso
 * archivio. Il ripristino dal Registro attività lo riporta al suo posto.
 * Funziona sia dal browser (badge) sia dal server (chiave di servizio).
 */

export const CARTELLA_CESTINO = '_cestino'

export function percorsoNelCestino(percorso: string) {
  return `${CARTELLA_CESTINO}/${percorso.replace(/^\/+/, '')}`
}

/** File dei documenti per tabella: archivio e colonna con il percorso. */
export const FILE_PER_TABELLA: Record<string, { bucket: string; colonna: string }> = {
  scadenze_bandi_clienti_documenti: { bucket: 'clienti-documenti', colonna: 'file_path' },
  scadenze_bandi_documenti_formazione: { bucket: 'clienti-documenti', colonna: 'storage_path' },
  scadenze_bandi_documenti_progetto: { bucket: 'progetti-documenti', colonna: 'url_file' },
  scadenze_bandi_documenti: { bucket: 'bandi-documenti', colonna: 'url_file' },
  scadenze_bandi_documenti_amministrativi: { bucket: 'clienti-amministrativi', colonna: 'storage_path' }
}

async function sposta(client: SupabaseClient, bucket: string, da: string, a: string): Promise<boolean> {
  const archivio = client.storage.from(bucket)
  let { error } = await archivio.move(da, a)
  if (error && /exist/i.test(error.message)) {
    // Stesso percorso già nel cestino (eliminato una seconda volta): si sostituisce la copia vecchia
    await archivio.remove([a])
    ;({ error } = await archivio.move(da, a))
  }
  if (error) {
    console.warn(`[cestino] ${bucket}: ${da} -> ${a} non spostato: ${error.message}`)
    return false
  }
  return true
}

/** Sposta i file nel cestino. Restituisce quanti ne ha spostati. */
export async function spostaNelCestino(client: SupabaseClient, bucket: string, percorsi: string[]): Promise<number> {
  let spostati = 0
  for (const p of percorsi.filter(Boolean)) {
    if (p.startsWith(`${CARTELLA_CESTINO}/`)) continue
    if (await sposta(client, bucket, p, percorsoNelCestino(p))) spostati++
  }
  return spostati
}

/** Riporta un file dal cestino al suo percorso originale. */
export async function ripristinaDalCestino(client: SupabaseClient, bucket: string, percorso: string): Promise<boolean> {
  return sposta(client, bucket, percorsoNelCestino(percorso), percorso)
}
