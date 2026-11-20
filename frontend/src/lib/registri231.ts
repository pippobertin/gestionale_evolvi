import { supabaseAdmin } from './supabaseAdmin'

/** Dati comuni ai registri del Modello 231: nomi degli utenti, AU, chi può decidere. */
export async function contesto231(utenteId: string, ruolo: string) {
  const [{ data: utenti }, { data: au }] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_utenti').select('id, nome, cognome, livello_permessi, attivo').order('nome'),
    supabaseAdmin.from('scadenze_bandi_system_settings').select('value').eq('key', 'utente_au').maybeSingle()
  ])
  const nomi: Record<string, string> = {}
  for (const u of utenti || []) nomi[u.id] = `${u.nome || ''} ${u.cognome || ''}`.trim()
  const auId = au?.value || null
  return {
    nomi,
    auId,
    utentiAttivi: (utenti || []).filter(u => u.attivo && u.livello_permessi !== 'odv').map(u => ({ id: u.id, nome: nomi[u.id] })),
    io: utenteId,
    // Decide l'AU; se non è indicata, gli amministratori
    puoDecidere: auId ? utenteId === auId : ruolo === 'admin',
    vedeTutto: ruolo === 'admin' || ruolo === 'odv',
    solaLettura: ruolo === 'odv'
  }
}
