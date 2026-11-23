import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { caricaDocumentoCliente, contestoDrive } from '@/lib/driveCliente'
import { registraEvento } from '@/lib/registro'

/**
 * Spostamento su Google Drive dei documenti dei clienti salvati nell'archivio
 * interno (solo amministratori). Si lavora a lotti: ogni chiamata sposta alcuni
 * file, li verifica e restituisce quanti ne restano. Le copie interne restano
 * finché non si chiede di eliminarle.
 */
export const maxDuration = 60
const LOTTO = 10
const TIPO_DA_VECCHIA_CATEGORIA: Record<string, { tipo: string; categoria: string }> = {
  VISURA: { tipo: 'VISURA_CAMERALE', categoria: 'SOCIETARI' },
  BILANCI: { tipo: 'BILANCIO', categoria: 'BILANCI' },
  DSAN: { tipo: 'ALTRO', categoria: 'ALTRO' },
  ULA: { tipo: 'ALTRO', categoria: 'ALTRO' },
  CONTRATTI: { tipo: 'ALTRO', categoria: 'ALTRO' },
  ALTRO: { tipo: 'ALTRO', categoria: 'ALTRO' }
}

async function stato() {
  const conta = async (f: (q: any) => any, tabella = 'scadenze_bandi_documenti_amministrativi') => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count } = await f(supabaseAdmin.from(tabella).select('id', { count: 'exact', head: true }))
    return count || 0
  }
  const [totale, suDrive, daSpostare, copie, vecchiDaSpostare] = await Promise.all([
    conta(q => q),
    conta(q => q.not('google_drive_id', 'is', null)),
    conta(q => q.is('google_drive_id', null).not('storage_path', 'is', null)),
    conta(q => q.not('google_drive_id', 'is', null).not('storage_path', 'is', null)),
    conta(q => q.is('spostato_in', null), 'scadenze_bandi_clienti_documenti')
  ])
  return { totale, suDrive, daSpostare: daSpostare + vecchiDaSpostare, copie }
}

async function scarica(bucket: string, percorso: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(percorso)
  if (error || !data) throw new Error(`file non trovato nell'archivio (${error?.message || 'vuoto'})`)
  return Buffer.from(await data.arrayBuffer())
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  return NextResponse.json(await stato())
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  const salta: string[] = Array.isArray(b.salta) ? b.salta.map(String).filter((x: string) => /^[0-9a-fA-F-]{36}$/.test(x)) : []
  const errori: { id: string; nome: string; errore: string }[] = []
  let spostati = 0

  if (b.azione === 'sposta') {
    const c = await contestoDrive()
    const inizio = Date.now()
    // 1. I pochi documenti della vecchia sezione "Documenti" della scheda cliente
    let q1 = supabaseAdmin.from('scadenze_bandi_clienti_documenti').select('*').is('spostato_in', null).order('created_at').limit(LOTTO)
    if (salta.length) q1 = q1.not('id', 'in', `(${salta.join(',')})`)
    const { data: vecchi } = await q1
    for (const d of vecchi || []) {
      if (Date.now() - inizio > 45_000) break
      try {
        const m = TIPO_DA_VECCHIA_CATEGORIA[d.categoria] || TIPO_DA_VECCHIA_CATEGORIA.ALTRO
        const contenuto = await scarica('clienti-documenti', d.file_path)
        const file = await caricaDocumentoCliente(c, d.cliente_id, m.categoria, d.nome_originale || d.nome_file, contenuto, d.mime_type)
        const { data: nuovo, error } = await supabaseAdmin.from('scadenze_bandi_documenti_amministrativi').insert({
          cliente_id: d.cliente_id, tipo_documento: m.tipo, categoria: m.categoria,
          nome_file: d.nome_file, nome_originale: d.nome_originale || d.nome_file,
          dimensione_bytes: d.file_size, mime_type: d.mime_type, storage_path: null,
          google_drive_id: file.id, google_drive_url: file.url, verificato: false, tags: [],
          descrizione: d.categoria !== m.categoria ? `Categoria precedente: ${d.categoria}` : null,
          uploaded_at: d.created_at, uploaded_by: d.uploaded_by || 'system'
        }).select('id').single()
        if (error) throw new Error(error.message)
        await supabaseAdmin.from('scadenze_bandi_clienti_documenti').update({ spostato_in: nuovo.id, google_drive_id: file.id }).eq('id', d.id)
        spostati++
      } catch (e) {
        errori.push({ id: d.id, nome: d.nome_originale || d.nome_file, errore: e instanceof Error ? e.message : 'errore' })
      }
    }
    // 2. I documenti del cliente
    if (spostati + errori.length < LOTTO) {
      let q2 = supabaseAdmin.from('scadenze_bandi_documenti_amministrativi').select('id, cliente_id, categoria, nome_originale, nome_file, mime_type, storage_path')
        .is('google_drive_id', null).not('storage_path', 'is', null).order('uploaded_at').limit(LOTTO - spostati - errori.length)
      if (salta.length) q2 = q2.not('id', 'in', `(${salta.join(',')})`)
      const { data: documenti } = await q2
      for (const d of documenti || []) {
        if (Date.now() - inizio > 45_000) break
        try {
          const contenuto = await scarica('clienti-amministrativi', d.storage_path)
          const file = await caricaDocumentoCliente(c, d.cliente_id, d.categoria || 'ALTRO', d.nome_originale || d.nome_file, contenuto, d.mime_type)
          const { error } = await supabaseAdmin.from('scadenze_bandi_documenti_amministrativi')
            .update({ google_drive_id: file.id, google_drive_url: file.url }).eq('id', d.id)
          if (error) throw new Error(error.message)
          spostati++
        } catch (e) {
          errori.push({ id: d.id, nome: d.nome_originale || d.nome_file, errore: e instanceof Error ? e.message : 'errore' })
        }
      }
    }
  } else if (b.azione === 'elimina_copie') {
    // Solo i file già su Drive: la copia interna si elimina e il documento resta collegato a Drive
    const { data: documenti } = await supabaseAdmin.from('scadenze_bandi_documenti_amministrativi')
      .select('id, storage_path').not('google_drive_id', 'is', null).not('storage_path', 'is', null).limit(100)
    for (const d of documenti || []) {
      const { error } = await supabaseAdmin.storage.from('clienti-amministrativi').remove([d.storage_path])
      if (error) { errori.push({ id: d.id, nome: d.storage_path, errore: error.message }); continue }
      await supabaseAdmin.from('scadenze_bandi_documenti_amministrativi').update({ storage_path: null }).eq('id', d.id)
      spostati++
    }
    const { data: vecchi } = await supabaseAdmin.from('scadenze_bandi_clienti_documenti').select('id, file_path').not('spostato_in', 'is', null).limit(100)
    const percorsi = (vecchi || []).map(v => v.file_path).filter(Boolean)
    if (percorsi.length) await supabaseAdmin.storage.from('clienti-documenti').remove(percorsi)
    if (spostati) {
      await registraEvento({ evento: 'documenti_spostati_drive', utenteId: admin.userId, request,
        descrizione: `Eliminate ${spostati} copie interne di documenti dei clienti già salvati su Google Drive` })
    }
  } else {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, spostati, errori, ...(await stato()) })
}
