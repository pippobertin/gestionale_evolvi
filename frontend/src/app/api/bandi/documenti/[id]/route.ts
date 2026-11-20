import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { verifyJWT } from '@/lib/jwtAuth'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { createDriveClient, findOrCreateSharedDrive, listSharedDriveFiles, trovaCartellaBando } from '@/lib/googleDrive'

/**
 * DELETE /api/bandi/documenti/[id]
 *
 * Elimina un documento del bando:
 *  - la copia su Google Drive (cartella del bando > ALLEGATI/NORMATIVA) va nel
 *    cestino di Drive, quindi resta recuperabile;
 *  - il file nell'archivio del gestionale si cancella solo se nessun progetto lo
 *    usa (i documenti ereditati dai progetti puntano a questo file);
 *  - la riga del documento viene eliminata.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const utente = await verifyJWT(request)
    if (!utente) return Response.json({ success: false, error: 'Non autenticato' }, { status: 401 })
    const { id } = await params

    const { data: doc, error } = await supabase
      .from('scadenze_bandi_documenti')
      .select('id, bando_id, nome_file, categoria, url_file, google_drive_id, bando:scadenze_bandi_bandi!bando_id(nome)')
      .eq('id', id)
      .single()
    if (error || !doc) return Response.json({ success: false, error: 'Documento non trovato' }, { status: 404 })

    // Progetti che usano ancora il file (documenti ereditati)
    // (due conteggi separati: il percorso del file può contenere caratteri che romperebbero un filtro combinato)
    const [perOrigine, perPercorso] = await Promise.all([
      supabase.from('scadenze_bandi_documenti_progetto')
        .select('id', { count: 'exact', head: true }).eq('bando_documento_origine_id', id),
      doc.url_file
        ? supabase.from('scadenze_bandi_documenti_progetto')
            .select('id', { count: 'exact', head: true }).eq('url_file', doc.url_file)
        : Promise.resolve({ count: 0 } as { count: number | null })
    ])
    const usatoDaProgetti = Math.max(perOrigine.count || 0, perPercorso.count || 0)

    // Copia su Drive nel cestino
    let drive: 'cestino' | 'non_trovato' | 'errore' = 'non_trovato'
    try {
      const token = await getValidGoogleToken()
      if (token) {
        let fileId: string | null = doc.google_drive_id || null
        const nomeBando = (doc as any).bando?.nome as string | undefined
        if (!fileId && nomeBando) {
          // Documenti caricati prima che il gestionale salvasse l'identificativo: ricerca per nome
          const sharedDriveId = await findOrCreateSharedDrive(token, 'Gestionale Evolvi')
          const cartellaBando = await trovaCartellaBando(token, sharedDriveId, nomeBando)
          if (cartellaBando) {
            const nomeCategoria = doc.categoria === 'normativa' ? 'NORMATIVA' : 'ALLEGATI'
            const cartelle = await listSharedDriveFiles(token, cartellaBando,
              `name='${nomeCategoria}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
            if (cartelle.length > 0) {
              const nomeFile = doc.nome_file.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
              const file = await listSharedDriveFiles(token, cartelle[0].id!, `name='${nomeFile}' and trashed=false`)
              if (file.length === 1) fileId = file[0].id!
            }
          }
        }
        if (fileId) {
          const client = await createDriveClient(token)
          await client.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true })
          drive = 'cestino'
        }
      }
    } catch (e) {
      console.error('Documento bando: copia su Drive non spostata nel cestino', e)
      drive = 'errore'
    }

    // File nell'archivio del gestionale: solo se nessun progetto lo usa
    let archivio: 'cancellato' | 'conservato' = 'conservato'
    if (!usatoDaProgetti && doc.url_file) {
      const { error: storageError } = await supabase.storage.from('bandi-documenti').remove([doc.url_file])
      if (!storageError) archivio = 'cancellato'
    }

    const { error: deleteError } = await supabase.from('scadenze_bandi_documenti').delete().eq('id', id)
    if (deleteError) throw deleteError

    return Response.json({ success: true, data: { drive, archivio, usato_da_progetti: usatoDaProgetti || 0 } })
  } catch (error: any) {
    console.error('Errore eliminazione documento bando:', error)
    return Response.json({ success: false, error: 'Errore nell\'eliminazione del documento' }, { status: 500 })
  }
}
