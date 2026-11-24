import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'

/**
 * Modello 231, Da fare: ciò che tocca a chi è collegato. Per tutti: la propria
 * dichiarazione degli interessi, le proprie deroghe e i conflitti che lo
 * riguardano, le proprie checklist, le sezioni del report all'OdV in bozza.
 * Per chi decide (amministratrice unica; un altro amministratore quando il caso
 * riguarda lei): anomalie, deroghe, conflitti, dichiarazioni, accordi e
 * compensi in attesa. ?solo=conteggio per il contatore del menu.
 */
type Voce = { scheda: string; testo: string; decisione?: boolean }

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ voci: [], conteggio: 0 })
  const io = sessione.userId
  const anno = new Date().getFullYear()
  const ctx = await contesto231(io, sessione.livello_permessi)
  const admin = sessione.livello_permessi === 'admin'
  const auId = ctx.auId
  // Decide l'AU; se il caso riguarda l'AU, un altro amministratore
  const decido = (interessato?: string | null) => interessato !== io && (interessato && interessato === auId ? admin && io !== auId : ctx.puoDecidere)

  const [dich, mieDeroghe, mieiConflitti, checklist, report, qualifiche, deroghe, conflitti, dichiarazioni, segnalatori, compensi] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_dichiarazioni_interessi').select('id').eq('utente_id', io).eq('anno', anno).limit(1),
    supabaseAdmin.from('scadenze_bandi_deroghe').select('id, oggetto').eq('richiesta_da', io).is('decisione', null),
    supabaseAdmin.from('scadenze_bandi_conflitti').select('id, descrizione').eq('persona_id', io).is('decisione', null),
    supabaseAdmin.from('scadenze_bandi_checklist_personale').select('id, tipo').eq('utente_id', io).is('completata_il', null),
    supabaseAdmin.from('scadenze_bandi_report_odv').select('id, anno, semestre, scadenza, sezioni').is('inviato_il', null),
    ctx.puoDecidere ? supabaseAdmin.from('scadenze_bandi_qualifiche').select('id, denominazione').eq('esito', 'anomalia').is('decisione', null) : Promise.resolve({ data: [] }),
    admin || ctx.puoDecidere ? supabaseAdmin.from('scadenze_bandi_deroghe').select('id, oggetto, richiesta_da').is('decisione', null) : Promise.resolve({ data: [] }),
    admin || ctx.puoDecidere ? supabaseAdmin.from('scadenze_bandi_conflitti').select('id, descrizione, persona_id').is('decisione', null) : Promise.resolve({ data: [] }),
    admin || ctx.puoDecidere ? supabaseAdmin.from('scadenze_bandi_dichiarazioni_interessi').select('id, utente_id').is('esito', null) : Promise.resolve({ data: [] }),
    ctx.puoDecidere ? supabaseAdmin.from('scadenze_bandi_segnalatori').select('id, nome, accordo_data, clausola_231, accordo_allegati').is('accordo_approvato_da', null).is('cessato_il', null) : Promise.resolve({ data: [] }),
    admin || ctx.puoDecidere ? supabaseAdmin.from('scadenze_bandi_compensi_segnalatori').select('id, attestata_da, fattura_numero, scadenze_bandi_segnalatori(nome)').not('attestata_da', 'is', null).is('autorizzato_da', null) : Promise.resolve({ data: [] })
  ])

  const voci: Voce[] = []
  if (!(dich.data || []).length) voci.push({ scheda: 'dichiarazioni', testo: `Presenta la tua dichiarazione degli interessi per il ${anno}` })
  for (const d of mieDeroghe.data || []) voci.push({ scheda: 'deroghe', testo: `La tua richiesta di deroga «${d.oggetto}» è in attesa della decisione` })
  for (const c of mieiConflitti.data || []) voci.push({ scheda: 'conflitti', testo: `Un conflitto che ti riguarda è in attesa della decisione: ${c.descrizione}` })
  for (const c of checklist.data || []) voci.push({ scheda: 'personale', testo: `La tua checklist di ${c.tipo === 'uscita' ? 'uscita' : 'ingresso'} è ancora aperta` })
  for (const r of report.data || []) {
    const daConfermare = Object.values(r.sezioni || {}).filter((s: any) => !s.confermata_il).length
    if (daConfermare) voci.push({ scheda: 'report', testo: `Report all'OdV del ${r.semestre}° semestre ${r.anno}: ${daConfermare} sezioni da confermare entro il ${String(r.scadenza).split('-').reverse().join('/')}` })
  }
  for (const q of qualifiche.data || []) voci.push({ scheda: 'qualifiche', testo: `Decidi sull'anomalia della qualifica di ${q.denominazione}`, decisione: true })
  for (const d of (deroghe.data || []) as any[]) if (decido(d.richiesta_da)) voci.push({ scheda: 'deroghe', testo: `Decidi sulla deroga «${d.oggetto}»`, decisione: true })
  for (const c of (conflitti.data || []) as any[]) if (decido(c.persona_id)) voci.push({ scheda: 'conflitti', testo: `Decidi sul conflitto: ${c.descrizione}`, decisione: true })
  for (const d of (dichiarazioni.data || []) as any[]) if (decido(d.utente_id)) voci.push({ scheda: 'dichiarazioni', testo: `Valuta la dichiarazione degli interessi di ${ctx.nomi[d.utente_id] || 'un collega'}`, decisione: true })
  for (const s of (segnalatori.data || []) as any[]) {
    if (s.accordo_data && s.clausola_231 && (s.accordo_allegati || []).length) voci.push({ scheda: 'segnalatori', testo: `Approva l'accordo con il segnalatore ${s.nome}`, decisione: true })
  }
  for (const c of (compensi.data || []) as any[]) {
    if (c.fattura_numero && decido(c.attestata_da)) {
      const nome = Array.isArray(c.scadenze_bandi_segnalatori) ? c.scadenze_bandi_segnalatori[0]?.nome : c.scadenze_bandi_segnalatori?.nome
      voci.push({ scheda: 'segnalatori', testo: `Autorizza il pagamento del compenso a ${nome || 'un segnalatore'}`, decisione: true })
    }
  }
  if (request.nextUrl.searchParams.get('solo') === 'conteggio') return NextResponse.json({ conteggio: voci.length })
  return NextResponse.json({ voci, conteggio: voci.length, admin })
}
