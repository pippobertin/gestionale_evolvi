import { NextApiRequest, NextApiResponse } from 'next'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { deleteDriveFolder } from '@/lib/googleDrive'
import { google } from 'googleapis'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Ottieni token Google con refresh automatico
    const googleAccessToken = await getValidGoogleToken()

    if (!googleAccessToken) {
      console.log('⚠️ Google Drive non configurato - eliminazione saltata')
      return res.status(200).json({
        success: true,
        message: 'Google Drive non configurato - eliminazione saltata',
        skipped: true
      })
    }

    const { bandoName, progettoNome, driveFolderId } = req.body

    if (!driveFolderId && (!bandoName || !progettoNome)) {
      return res.status(400).json({
        message: 'ID cartella Drive o (nome bando + nome progetto) richiesti'
      })
    }

    let folderIdToDelete = driveFolderId

    // Se non abbiamo l'ID, cerchiamo la cartella per nome
    if (!folderIdToDelete && progettoNome) {
      console.log(`🗑️ Ricerca cartella progetto "${progettoNome}" (bando: "${bandoName || 'N/A'}")`)

      // Setup Google Drive API
      const auth = new google.auth.OAuth2()
      auth.setCredentials({ access_token: googleAccessToken })
      const drive = google.drive({ version: 'v3', auth })

      // 1. Trova il Drive Condiviso "Gestionale Evolvi"
      const sharedDrivesResponse = await drive.drives.list({
        pageSize: 100,
        fields: 'drives(id,name,capabilities)'
      })

      const drives = sharedDrivesResponse.data.drives || []
      const gestionaleDrive = drives.find(d => d.name === 'Gestionale Evolvi')

      if (!gestionaleDrive) {
        console.log('❌ Drive Condiviso "Gestionale Evolvi" non trovato')
        return res.status(404).json({
          success: false,
          message: 'Drive Condiviso "Gestionale Evolvi" non trovato'
        })
      }

      const sharedDriveId = gestionaleDrive.id!
      console.log(`📁 Drive Condiviso trovato: ${sharedDriveId}`)

      // 2. Strategia migliorata: cerca prima direttamente per nome progetto in tutto il Drive
      console.log(`🔍 Ricerca diretta cartella progetto "${progettoNome}" nel Drive Condiviso`)
      const directSearchResponse = await drive.files.list({
        driveId: sharedDriveId,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'drive',
        q: `name='${progettoNome}' and mimeType='application/vnd.google-apps.folder'`,
        pageSize: 100,
        fields: 'files(id,name,parents)'
      })

      console.log(`📊 Ricerca diretta: trovati ${directSearchResponse.data.files?.length || 0} risultati`)
      if (directSearchResponse.data.files?.length) {
        console.log(`📂 Cartelle trovate:`, directSearchResponse.data.files.map(f => `${f.name} (${f.id})`).join(', '))

        // Debug dettagliato per ogni cartella trovata
        for (const folder of directSearchResponse.data.files) {
          console.log(`🔍 Debug cartella "${folder.name}":`)
          console.log(`   - ID: ${folder.id}`)
          console.log(`   - Parent: ${folder.parents?.[0]}`)

          // Verifica che la cartella esista davvero
          try {
            const verifyResponse = await drive.files.get({
              fileId: folder.id!,
              fields: 'id,name,parents,trashed',
              supportsAllDrives: true
            })
            console.log(`   - Stato: Esistente, Cestinata: ${verifyResponse.data.trashed || false}`)

            // Se la cartella è stata cestinata, saltala
            if (verifyResponse.data.trashed) {
              console.log(`   ⚠️ Cartella cestinata, ignorata`)
              continue
            }

            // Questa è una cartella valida
            console.log(`🎯 Cartella progetto valida trovata: ${folder.id}`)
            folderIdToDelete = folder.id!
            break

          } catch (verifyError) {
            console.log(`   ❌ Errore verifica cartella: ${verifyError.message}`)
            continue
          }
        }
      }

      // Solo se non abbiamo trovato una cartella valida, procedi con il fallback
      if (!folderIdToDelete) {
        // 3. Fallback: cerca per bando (se fornito)
        if (bandoName) {
          console.log(`🔍 Fallback: ricerca tramite struttura bando "${bandoName}"`)

          // Cerca prima tutte le cartelle che potrebbero essere il bando
          const bandoSearchResponse = await drive.files.list({
            driveId: sharedDriveId,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            corpora: 'drive',
            q: `'${sharedDriveId}' in parents and mimeType='application/vnd.google-apps.folder'`,
            pageSize: 100,
            fields: 'files(id,name)'
          })

          console.log(`📁 Cartelle nel Drive Condiviso trovate: ${bandoSearchResponse.data.files?.map(f => f.name).join(', ')}`)

          // Prova con nome esatto del bando
          let bandoFolder = bandoSearchResponse.data.files?.find(f => f.name === bandoName)

          // Se non trovato, prova varianti comuni (il database potrebbe avere nomi diversi da quelli su Drive)
          if (!bandoFolder) {
            console.log(`⚠️ Bando "${bandoName}" non trovato con nome esatto, provo varianti...`)
            // Cerca cartelle che contengano parti del nome del progetto (estratte dal titolo)
            const projectWords = progettoNome.split(' ')
            for (const folder of bandoSearchResponse.data.files || []) {
              for (const word of projectWords) {
                if (word.length > 3 && folder.name?.includes(word)) {
                  console.log(`💡 Possibile match bando trovato: "${folder.name}" (contiene "${word}")`)
                  bandoFolder = folder
                  break
                }
              }
              if (bandoFolder) break
            }
          }

          if (bandoFolder) {
            console.log(`📁 Cartella bando utilizzata: ${bandoFolder.name} (${bandoFolder.id})`)

            // Cerca cartella PROGETTI
            const progettiResponse = await drive.files.list({
              driveId: sharedDriveId,
              includeItemsFromAllDrives: true,
              supportsAllDrives: true,
              corpora: 'drive',
              q: `'${bandoFolder.id}' in parents and name='PROGETTI' and mimeType='application/vnd.google-apps.folder'`,
              pageSize: 100,
              fields: 'files(id,name,parents)'
            })

            const progettiFolder = progettiResponse.data.files?.[0]

            if (progettiFolder) {
              // Cerca la cartella specifica del progetto
              const progettoResponse = await drive.files.list({
                driveId: sharedDriveId,
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
                corpora: 'drive',
                q: `'${progettiFolder.id}' in parents and name='${progettoNome}' and mimeType='application/vnd.google-apps.folder'`,
                pageSize: 100,
                fields: 'files(id,name,parents)'
              })

              const progettoFolder = progettoResponse.data.files?.[0]
              if (progettoFolder) {
                console.log(`🎯 Cartella progetto trovata tramite bando: ${progettoFolder.id}`)
                folderIdToDelete = progettoFolder.id!
              }
            }
          }
        }

        if (!folderIdToDelete) {
          console.log(`❌ Cartella progetto "${progettoNome}" non trovata con nessun metodo`)
          return res.status(404).json({
            success: false,
            message: `Cartella progetto "${progettoNome}" non trovata in Google Drive`
          })
        }
      }
    }

    // 5. Elimina la cartella progetto e tutto il suo contenuto
    console.log(`🗑️ Eliminazione cartella Drive ID: ${folderIdToDelete}`)
    await deleteDriveFolder(googleAccessToken, folderIdToDelete)

    console.log(`✅ Cartella progetto eliminata con successo`)
    return res.status(200).json({
      success: true,
      message: `Cartella progetto eliminata da Google Drive`,
      deletedFolderId: folderIdToDelete
    })

  } catch (error: any) {
    console.error('❌ Errore eliminazione progetto Drive:', error)
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server',
      error: error.message
    })
  }
}