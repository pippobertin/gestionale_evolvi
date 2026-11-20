import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { FILE_PER_TABELLA, ripristinaDalCestino } from '@/lib/cestinoArchivi'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { createDriveClient } from '@/lib/googleDrive'
import { etichettaTabella } from '@/lib/registroEtichette'

/**
 * Ripristino di un'eliminazione dal Registro attività (fase 4B), solo amministratori.
 * Il database reinserisce le righe eliminate nella stessa operazione e ricollega
 * quelle staccate; qui si riportano i file dal cestino dell'archivio e si tolgono
 * dal cestino di Drive le copie dei documenti di bandi e progetti.
 */

export const maxDuration = 60

type Voce = { registro_id: number; tabella: string; record_id?: string; descrizione?: string; prima?: Record<string, any>; motivo?: string }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const { id } = await params
  const registroId = Number(id)
  if (!Number.isInteger(registroId) || registroId <= 0) {
    return NextResponse.json({ error: 'Operazione non valida' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc('gestionale_ripristina', { p_id: registroId })
  if (error) {
    return NextResponse.json({ error: error.message || 'Ripristino non riuscito' }, { status: 400 })
  }

  const esito = data as { ripristinati: Voce[]; ricollegati: Voce[]; saltati: Voce[]; errori: Voce[] }
  const fileNonRitrovati: string[] = []
  let fileRipristinati = 0
  let driveRipristinati = 0
  let tokenDrive: string | null | undefined

  for (const voce of esito.ripristinati) {
    const mappa = FILE_PER_TABELLA[voce.tabella]
    const percorso = mappa ? voce.prima?.[mappa.colonna] : null
    if (mappa && typeof percorso === 'string' && percorso) {
      // I documenti di progetto ereditati puntano al file del bando, che non era stato toccato
      const ereditato = voce.tabella === 'scadenze_bandi_documenti_progetto' &&
        (voce.prima?.categoria === 'ereditato' || voce.prima?.inherited_from_bando === true)
      if (!ereditato) {
        if (await ripristinaDalCestino(supabaseAdmin, mappa.bucket, percorso)) fileRipristinati++
        else fileNonRitrovati.push(voce.descrizione || percorso)
      }
    }

    const driveId = voce.prima?.google_drive_id
    if (typeof driveId === 'string' && driveId) {
      try {
        if (tokenDrive === undefined) tokenDrive = await getValidGoogleToken()
        if (tokenDrive) {
          const drive = await createDriveClient(tokenDrive)
          await drive.files.update({ fileId: driveId, requestBody: { trashed: false }, supportsAllDrives: true })
          driveRipristinati++
        }
      } catch (e) {
        console.warn('[ripristino] copia su Drive non tolta dal cestino:', e instanceof Error ? e.message : e)
      }
    }
  }

  const descrivi = (v: Voce) => ({
    area: etichettaTabella(v.tabella),
    descrizione: v.descrizione || '',
    motivo: v.motivo
  })

  return NextResponse.json({
    ok: true,
    ripristinati: esito.ripristinati.map(descrivi),
    ricollegati: esito.ricollegati.map(descrivi),
    saltati: esito.saltati.map(descrivi),
    errori: esito.errori.map(descrivi),
    file: { ripristinati: fileRipristinati, non_ritrovati: fileNonRitrovati, drive: driveRipristinati }
  })
}
