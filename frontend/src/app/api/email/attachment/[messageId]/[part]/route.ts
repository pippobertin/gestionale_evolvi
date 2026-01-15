import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

// Service role client per bypassare RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper per verificare autenticazione
async function getAuthenticatedUser(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Token mancante')
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }

    return decoded.userId
  } catch (error) {
    throw new Error('Non autorizzato')
  }
}

/**
 * GET /api/email/attachment/[messageId]/[part] - Scarica un allegato specifico
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { messageId: string, part: string } }
) {
  try {
    const userId = await getAuthenticatedUser(req)

    // Resolve params se è una Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const { messageId, part } = resolvedParams

    console.log(`📎 Download allegato richiesto: messaggio=${messageId}, parte=${part}`)

    if (!messageId || !part) {
      return Response.json({
        success: false,
        message: 'ID messaggio e parte allegato obbligatori'
      }, { status: 400 })
    }

    // Ottieni il messaggio e verifica proprietà
    const { data: message, error: messageError } = await supabase
      .from('scadenze_bandi_email_messages')
      .select(`
        *,
        scadenze_bandi_email_folders!inner(
          account_id,
          full_path,
          scadenze_bandi_email_accounts!inner(user_id)
        )
      `)
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      console.error('Errore recupero messaggio per allegato:', messageError)
      return Response.json({
        success: false,
        message: 'Messaggio non trovato'
      }, { status: 404 })
    }

    // Verifica che il messaggio appartenga all'utente
    if (message.scadenze_bandi_email_folders.scadenze_bandi_email_accounts.user_id !== userId) {
      return Response.json({
        success: false,
        message: 'Non autorizzato'
      }, { status: 403 })
    }

    // Ottieni l'account email
    const { data: accountData } = await supabase
      .from('scadenze_bandi_email_accounts')
      .select('*')
      .eq('id', message.scadenze_bandi_email_folders.account_id)
      .single()

    if (!accountData) {
      return Response.json({
        success: false,
        message: 'Account email non trovato'
      }, { status: 404 })
    }

    // Estrai l'allegato specifico
    const { ImapService } = await import('@/lib/email/imapService')
    const imapService = new ImapService(accountData)

    await imapService.connect()
    const attachments = await imapService.extractAttachments(message.uid.toString(), message.scadenze_bandi_email_folders.full_path)
    await imapService.disconnect()

    // Trova l'allegato specifico per parte
    const attachment = attachments.find(att => att.part === part)
    if (!attachment) {
      return Response.json({
        success: false,
        message: 'Allegato non trovato'
      }, { status: 404 })
    }

    console.log(`📎 Allegato trovato: ${attachment.name} (${attachment.size} bytes), tipo: ${attachment.type}`)

    // Validazione del contenuto base64 prima della decodifica
    const base64Content = attachment.content
    if (!base64Content || typeof base64Content !== 'string') {
      console.error(`📎 Contenuto allegato non valido:`, typeof base64Content)
      return Response.json({
        success: false,
        message: 'Contenuto allegato corrotto'
      }, { status: 500 })
    }

    // Pulizia del base64 (rimuovi spazi e newline)
    let cleanBase64 = base64Content.replace(/[\r\n\s]/g, '')

    // Rilevazione doppia codifica base64 (fix critico!)
    let isDoubleEncoded = false
    try {
      const testDecode = Buffer.from(cleanBase64, 'base64').toString('ascii')
      console.log(`📎 🔍 Test decodifica per ${attachment.name}: primi 20 char = "${testDecode.slice(0, 20)}"`)

      // Rilevazione header di diversi tipi di file
      const isDoubleEncodedFile =
        testDecode.startsWith('JVBERi0') ||        // PDF: "%PDF-" in base64
        testDecode.startsWith('%PDF-') ||          // PDF diretto
        testDecode.startsWith('UEsDB') ||          // ZIP/XLSX: "PK" header in base64
        testDecode.startsWith('PK') ||             // ZIP/XLSX diretto
        testDecode.startsWith('0M8R4KGx') ||       // Excel/Doc old format in base64
        testDecode.startsWith('iVBORw0KGgo') ||    // PNG in base64
        testDecode.startsWith('/9j/') ||           // JPEG in base64
        testDecode.startsWith('R0lGODlh') ||       // GIF in base64
        testDecode.match(/^[A-Za-z0-9+/]{100,}/)  // Lungo pattern base64

      if (isDoubleEncodedFile) {
        console.log(`📎 🔄 DOPPIA CODIFICA RILEVATA per ${attachment.name} - correzione in corso`)
        // È doppiamente codificato - decodifica una volta
        cleanBase64 = testDecode
        isDoubleEncoded = true
      }
    } catch (e) {
      console.log(`📎 Test decodifica fallito per ${attachment.name}: ${e.message}`)
    }

    // Validazione formato base64 (solo se non è doppiamente codificato)
    if (!isDoubleEncoded) {
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
      if (!base64Regex.test(cleanBase64)) {
        console.error(`📎 Base64 non valido per allegato ${attachment.name}`)
        return Response.json({
          success: false,
          message: 'Formato allegato corrotto'
        }, { status: 500 })
      }
    }

    // Decodifica il contenuto da Base64
    let buffer: Buffer
    try {
      buffer = Buffer.from(cleanBase64, 'base64')
      console.log(`📎 Buffer decodificato: ${buffer.length} bytes (da ${cleanBase64.length} caratteri base64)`)

      // Verifica header del file basato sul tipo
      const fileName = attachment.name.toLowerCase()
      if (fileName.endsWith('.pdf')) {
        const pdfHeader = buffer.slice(0, 8).toString('ascii')
        console.log(`📎 PDF Header check: "${pdfHeader}" (dovrebbe iniziare con "%PDF-")`)
        if (!pdfHeader.startsWith('%PDF-')) {
          console.error(`📎 ATTENZIONE: Il file ${attachment.name} non ha un header PDF valido`)
          console.log(`📎 Primi 50 bytes (hex): ${buffer.slice(0, 50).toString('hex')}`)
          console.log(`📎 Primi 50 bytes (ascii): ${buffer.slice(0, 50).toString('ascii')}`)
        } else {
          console.log(`📎 ✅ PDF header valido per ${attachment.name}`)
        }
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.docx')) {
        const zipHeader = buffer.slice(0, 4)
        const isZip = zipHeader[0] === 0x50 && zipHeader[1] === 0x4B // "PK"
        console.log(`📎 ZIP Header check per ${attachment.name}: ${zipHeader.toString('hex')} (dovrebbe essere 504b*)`)
        if (!isZip) {
          console.error(`📎 ATTENZIONE: Il file ${attachment.name} non ha un header ZIP valido`)
          console.log(`📎 Primi 50 bytes (hex): ${buffer.slice(0, 50).toString('hex')}`)
        } else {
          console.log(`📎 ✅ ZIP header valido per ${attachment.name}`)
        }
      } else if (fileName.endsWith('.png')) {
        const pngHeader = buffer.slice(0, 8)
        const isPng = pngHeader.toString('hex') === '89504e470d0a1a0a'
        console.log(`📎 PNG Header check: ${pngHeader.toString('hex')} (dovrebbe essere 89504e470d0a1a0a)`)
        if (!isPng) {
          console.error(`📎 ATTENZIONE: Il file ${attachment.name} non ha un header PNG valido`)
        } else {
          console.log(`📎 ✅ PNG header valido per ${attachment.name}`)
        }
      } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        const jpegHeader = buffer.slice(0, 4)
        const isJpeg = jpegHeader[0] === 0xFF && jpegHeader[1] === 0xD8 && jpegHeader[2] === 0xFF
        console.log(`📎 JPEG Header check: ${jpegHeader.toString('hex')} (dovrebbe iniziare con ffd8ff)`)
        if (!isJpeg) {
          console.error(`📎 ATTENZIONE: Il file ${attachment.name} non ha un header JPEG valido`)
        } else {
          console.log(`📎 ✅ JPEG header valido per ${attachment.name}`)
        }
      }
    } catch (decodeError) {
      console.error(`📎 Errore decodifica base64:`, decodeError)
      return Response.json({
        success: false,
        message: 'Errore decodifica allegato'
      }, { status: 500 })
    }

    // Determina il tipo di contenuto
    const contentType = attachment.type || 'application/octet-stream'

    // Ritorna il file come download
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.name)}"`,
        'Content-Length': buffer.length.toString(),
      },
    })

  } catch (error: any) {
    console.error('Errore download allegato:', error)
    return Response.json({
      success: false,
      message: error.message || 'Errore download allegato'
    }, { status: 500 })
  }
}