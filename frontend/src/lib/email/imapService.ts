import { ImapFlow, ImapFlowOptions } from 'imapflow'
import * as nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

// Service role client per bypassare RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Preset configurazioni per provider comuni
export const EMAIL_PROVIDERS = {
  aruba: {
    name: 'Aruba',
    imap: { host: 'imaps.aruba.it', port: 993, secure: true },
    smtp: { host: 'smtps.aruba.it', port: 465, secure: true }
  },
  gmail: {
    name: 'Gmail',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true }
  },
  outlook: {
    name: 'Outlook',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false, requireTLS: true }
  },
  libero: {
    name: 'Libero/TIM',
    imap: { host: 'imapmail.libero.it', port: 993, secure: true },
    smtp: { host: 'smtp.libero.it', port: 465, secure: true }
  },
  yahoo: {
    name: 'Yahoo',
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 587, secure: false, requireTLS: true }
  }
} as const

export type EmailProvider = keyof typeof EMAIL_PROVIDERS

export interface EmailAccount {
  id: string
  name: string
  email_address: string
  provider_type: EmailProvider | 'generic'
  imap_server: string
  imap_port: number
  imap_secure: boolean
  smtp_server: string
  smtp_port: number
  smtp_secure: boolean
  username: string
  encrypted_password: string
  is_active: boolean
  oauth_refresh_token?: string
  oauth_access_token?: string
}

export interface EmailMessage {
  id: string
  account_id: string
  folder_id: string
  message_id: string
  uid: number
  subject?: string
  from_address: string
  from_name?: string
  to_addresses: string[]
  cc_addresses?: string[]
  body_text?: string
  body_html?: string
  body_preview?: string
  date_sent: Date
  date_received: Date
  is_read: boolean
  is_flagged: boolean
  has_attachments: boolean
  size_bytes?: number
}

export interface EmailFolder {
  id: string
  account_id: string
  name: string
  full_path: string
  folder_type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'custom'
  total_messages: number
  unread_messages: number
  highest_uid: number
}

export class ImapService {
  private client: ImapFlow | null = null
  private account: EmailAccount

  constructor(account: EmailAccount) {
    this.account = account
  }

  /**
   * Test connessione IMAP
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    let testClient: ImapFlow | null = null
    try {
      // Crea una connessione temporanea separata per il test
      const password = this.decryptPassword(this.account.encrypted_password)

      const config: ImapFlowOptions = {
        host: this.account.imap_server,
        port: this.account.imap_port,
        secure: this.account.imap_secure,
        auth: {
          user: this.account.username,
          pass: password
        },
        logger: false
      }

      testClient = new ImapFlow(config)
      await testClient.connect()

      const mailboxes = await testClient.list()

      return {
        success: true,
        // error: `Connesso! Trovate ${mailboxes.length} cartelle`
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Errore di connessione'
      }
    } finally {
      // Assicura disconnessione pulita del client di test
      if (testClient) {
        try {
          await testClient.logout()
        } catch (err) {
          // Ignora errori di disconnessione
          console.warn('Errore disconnessione test client:', err)
        }
      }
    }
  }

  /**
   * Connessione IMAP
   */
  private async connect(): Promise<ImapFlow> {
    if (this.client?.usable) {
      return this.client
    }

    // Decripta password (implementare encryption in produzione)
    const password = this.decryptPassword(this.account.encrypted_password)

    const config: ImapFlowOptions = {
      host: this.account.imap_server,
      port: this.account.imap_port,
      secure: this.account.imap_secure,
      auth: {
        user: this.account.username,
        pass: password
      },
      logger: false // Disabilita log per sicurezza
    }

    this.client = new ImapFlow(config)
    await this.client.connect()

    return this.client
  }

  /**
   * Sincronizza cartelle dell'account
   */
  async syncFolders(): Promise<EmailFolder[]> {
    try {
      const client = await this.connect()
      const mailboxes = await client.list()
      const folders: EmailFolder[] = []

      for (const mailbox of mailboxes) {
        // Determina tipo cartella
        let folderType: EmailFolder['folder_type'] = 'custom'
        const pathLower = mailbox.path.toLowerCase()

        if (pathLower.includes('inbox') || pathLower === 'posta in arrivo') {
          folderType = 'inbox'
        } else if (pathLower.includes('sent') || pathLower.includes('inviata')) {
          folderType = 'sent'
        } else if (pathLower.includes('draft') || pathLower.includes('bozze')) {
          folderType = 'drafts'
        } else if (pathLower.includes('trash') || pathLower.includes('elimina')) {
          folderType = 'trash'
        }

        // Ottieni statistiche cartella
        const status = await client.status(mailbox.path, {
          messages: true,
          unseen: true,
          uidNext: true
        })

        const folder: EmailFolder = {
          id: '', // Sarà generato dal DB
          account_id: this.account.id,
          name: mailbox.name,
          full_path: mailbox.path,
          folder_type: folderType,
          total_messages: status.messages || 0,
          unread_messages: status.unseen || 0,
          highest_uid: (status.uidNext || 1) - 1
        }

        folders.push(folder)
      }

      // Salva nel database
      await this.saveFoldersToDatabase(folders)

      return folders

    } catch (error: any) {
      console.error('Errore sincronizzazione cartelle:', error)
      throw new Error(`Errore sincronizzazione: ${error.message}`)
    }
  }

  /**
   * Sincronizza messaggi di una cartella
   */
  async syncMessages(folderPath: string, maxMessages = 200): Promise<EmailMessage[]> {
    try {
      const client = await this.connect()

      // Seleziona cartella
      const lockInfo = await client.getMailboxLock(folderPath)

      try {
        // Ottieni l'ultimo UID sincronizzato dal database
        const { data: folderData } = await supabase
          .from('scadenze_bandi_email_folders')
          .select('highest_uid')
          .eq('account_id', this.account.id)
          .eq('full_path', folderPath)
          .single()

        const lastSyncedUid = folderData?.highest_uid || 0
        console.log(`🔍 Ultimo UID sincronizzato: ${lastSyncedUid}`)

        // Ottieni tutti gli UIDs
        const allUids = await client.search({}, { uid: true })
        console.log(`📧 Trovati ${allUids.length} messaggi totali nella cartella`)

        // Mostra gli ultimi 10 UID per debug (sempre, anche se non ci sono nuovi messaggi)
        const lastTenUids = allUids.slice(-10)
        console.log('🔢 Ultimi 10 UID trovati:', lastTenUids)
        console.log(`🔍 Ultimo UID sincronizzato salvato nel DB: ${lastSyncedUid}`)

        // Trova l'UID più alto realmente presente
        const actualHighestUid = Math.max(...allUids)

        // Se l'UID salvato nel DB è maggiore dell'UID più alto reale,
        // resettiamo per recuperare eventuali messaggi persi
        if (lastSyncedUid > actualHighestUid) {
          console.log(`🔧 CORREZIONE: UID nel DB (${lastSyncedUid}) > UID reale max (${actualHighestUid}). Resetto per recupero.`)

          // Aggiorna il database con l'UID corretto
          await supabase
            .from('scadenze_bandi_email_folders')
            .update({ highest_uid: actualHighestUid })
            .eq('account_id', this.account.id)
            .eq('full_path', folderPath)

          // Ricalcola i nuovi UID partendo da 20 messaggi prima per sicurezza
          const safeStartUid = Math.max(0, actualHighestUid - 20)
          const newUids = allUids.filter(uid => uid > safeStartUid)
          console.log(`🔧 Recupero ${newUids.length} messaggi degli ultimi 20 UID per sicurezza`)
        } else {
          // Filtra solo gli UID nuovi (maggiori dell'ultimo sincronizzato)
          var newUids = allUids.filter(uid => uid > lastSyncedUid)
        }

        if (newUids.length === 0) {
          console.log('✅ Nessun nuovo messaggio da sincronizzare')
          return []
        }

        // Prendi al massimo maxMessages dei più recenti tra i nuovi
        const uidsToSync = newUids.sort((a, b) => b - a).slice(0, maxMessages)

        console.log(`📨 Sincronizzazione ${uidsToSync.length} nuovi messaggi (UID > ${lastSyncedUid})`)

        const messages: EmailMessage[] = []

        console.log(`📨 Processando ${uidsToSync.length} UID da sincronizzare: [${uidsToSync.join(', ')}]`)

        // Fetch messaggi in batch
        for (const uid of uidsToSync) {
          try {
            console.log(`🔍 Processando UID ${uid}...`)
            // Prima ottieni la struttura per capire le parti
            const structureData = await client.fetchOne(uid, {
              uid: true,
              envelope: true,
              bodyStructure: true,
              size: true,
              flags: true,
            }, { uid: true })

            // Poi ottieni tutte le parti del contenuto
            const bodyParts: string[] = []
            this.extractBodyParts(structureData.bodyStructure, '', bodyParts)

            console.log(`📧 Parti email UID ${uid}:`, bodyParts)

            const messageData = await client.fetchOne(uid, {
              uid: true,
              envelope: true,
              bodyStructure: true,
              size: true,
              flags: true,
              bodyParts: bodyParts
            }, { uid: true })

            if (messageData) {
              const message = this.parseMessageData(messageData)
              console.log(`✅ Messaggio UID ${uid} elaborato: ${message.subject?.substring(0, 50)}...`)
              messages.push(message)
            } else {
              console.warn(`❌ Messaggio UID ${uid} non elaborato (messageData è null)`)
            }
          } catch (err) {
            console.warn(`❌ Errore fetch messaggio UID ${uid}:`, err)
          }
        }

        // Salva messaggi nel database
        await this.saveMessagesToDatabase(messages, folderPath)

        // Aggiorna il highest_uid della cartella per le prossime sincronizzazioni
        if (uidsToSync.length > 0) {
          const highestNewUid = Math.max(...uidsToSync)
          await supabase
            .from('scadenze_bandi_email_folders')
            .update({ highest_uid: highestNewUid })
            .eq('account_id', this.account.id)
            .eq('full_path', folderPath)

          console.log(`✅ Aggiornato highest_uid a ${highestNewUid} per cartella ${folderPath}`)
        }

        return messages

      } finally {
        lockInfo.release()
      }

    } catch (error: any) {
      console.error('Errore sincronizzazione messaggi:', error)
      throw new Error(`Errore sincronizzazione messaggi: ${error.message}`)
    }
  }

  /**
   * Estrae ricorsivamente le parti del body
   */
  private extractBodyParts(structure: any, prefix: string, parts: string[]): void {
    if (!structure) return

    // Se ha childNodes, è multipart
    if (structure.childNodes && Array.isArray(structure.childNodes)) {
      structure.childNodes.forEach((child: any, index: number) => {
        const childPrefix = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
        this.extractBodyParts(child, childPrefix, parts)
      })
    } else {
      // È una parte singola
      if (prefix) {
        parts.push(prefix)

        // Aggiungi anche identificatori speciali per tipi comuni
        if (structure.type?.toLowerCase() === 'text') {
          if (structure.subtype?.toLowerCase() === 'plain') {
            parts.push('TEXT')
          } else if (structure.subtype?.toLowerCase() === 'html') {
            parts.push('HTML')
          }
        }
      }
    }
  }

  /**
   * Parsing dati messaggio da ImapFlow
   */
  private parseMessageData(data: any): EmailMessage {
    const envelope = data.envelope

    // Estrai testo e HTML dalle parti disponibili
    const textContent = this.extractTextContent(data.bodyParts)
    const htmlContent = this.extractHtmlContent(data.bodyParts)

    console.log(`📧 Email UID ${data.uid} - Parti estratte:`)
    console.log(`📧 Testo trovato: ${textContent ? 'SÌ' : 'NO'} (${textContent?.length || 0} chars)`)
    console.log(`📧 HTML trovato: ${htmlContent ? 'SÌ' : 'NO'} (${htmlContent?.length || 0} chars)`)

    return {
      id: '', // Generato dal DB
      account_id: this.account.id,
      folder_id: '', // Sarà risolto dal DB
      message_id: envelope.messageId || '',
      uid: data.uid,
      subject: envelope.subject || '(Nessun oggetto)',
      from_address: envelope.from?.[0]?.address || '',
      from_name: envelope.from?.[0]?.name || '',
      to_addresses: envelope.to?.map((addr: any) => addr.address) || [],
      cc_addresses: envelope.cc?.map((addr: any) => addr.address) || [],
      body_text: typeof textContent === 'string' ? textContent : (Buffer.isBuffer(textContent) ? textContent.toString('utf8') : ''),
      body_html: typeof htmlContent === 'string' ? htmlContent : (Buffer.isBuffer(htmlContent) ? htmlContent.toString('utf8') : ''),
      body_preview: this.generatePreview(textContent || htmlContent),
      date_sent: envelope.date || new Date(),
      date_received: new Date(),
      is_read: !data.flags?.has('\\Unseen'),
      is_flagged: data.flags?.has('\\Flagged') || false,
      has_attachments: this.hasAttachments(data.bodyStructure),
      size_bytes: data.size
    }
  }

  /**
   * Estrae contenuto di testo
   */
  private extractTextContent(bodyParts: Map<string, any>): string | null {
    // Prova prima TEXT, poi le parti numerate che potrebbero essere testo
    const candidates = ['TEXT', '1', '1.1', '2', '2.1']

    for (const candidate of candidates) {
      const content = bodyParts?.get(candidate)
      if (content && this.isPlainText(content)) {
        return this.decodeContent(content)
      }
    }

    return null
  }

  /**
   * Estrae contenuto HTML
   */
  private extractHtmlContent(bodyParts: Map<string, any>): string | null {
    // Cerca contenuto HTML in ordine di preferenza
    const candidates = ['HTML', '1.2', '2.2', '1', '2', '3']

    for (const candidate of candidates) {
      const content = bodyParts?.get(candidate)
      if (content && this.isHtmlContent(content)) {
        return this.decodeContent(content)
      }
    }

    return null
  }

  /**
   * Verifica se il contenuto è testo semplice
   */
  private isPlainText(content: any): boolean {
    const decoded = this.decodeContent(content)
    if (!decoded) return false

    // Se non contiene tag HTML, è probabilmente testo
    return !/<[^>]+>/.test(decoded.substring(0, 1000))
  }

  /**
   * Verifica se il contenuto è HTML
   */
  private isHtmlContent(content: any): boolean {
    const decoded = this.decodeContent(content)
    if (!decoded) return false

    // Cerca indicatori HTML comuni
    return /<(html|body|div|p|table|img)[^>]*>/i.test(decoded.substring(0, 1000))
  }

  /**
   * Decodifica il contenuto con gestione encoding
   */
  private decodeContent(content: any): string | null {
    if (!content) return null

    let decodedContent = ''

    // Prima converti in stringa
    if (typeof content === 'string') {
      decodedContent = content
    } else if (Buffer.isBuffer(content)) {
      decodedContent = content.toString('utf8')
    } else {
      decodedContent = content.toString()
    }

    // Rileva e ignora contenuto binario/corrupted
    const binaryPatterns = [
      /�PNG/, /IHDR/, /IDATx/, /sRGB/, /gAMA/, /pHYs/, // PNG signatures
      /\xFF\xD8\xFF/, /JFIF/, /Exif/, // JPEG signatures
      /GIF8/, /BM/, /%PDF/, // Altri formati
      /[\x00-\x08\x0E-\x1F\x7F-\xFF]{20,}/, // Troppi caratteri binari
    ]

    if (binaryPatterns.some(pattern => pattern.test(decodedContent.substring(0, 500)))) {
      return null // Ignora contenuto binario
    }

    // Gestisci quoted-printable encoding
    if (decodedContent.includes('=?') || /=[0-9A-F]{2}/gi.test(decodedContent.substring(0, 1000))) {
      decodedContent = this.decodeQuotedPrintable(decodedContent)
    }

    // Gestisci encoding header (=?charset?encoding?content?=)
    decodedContent = this.decodeMimeHeader(decodedContent)

    // Verifica se potrebbe essere Base64
    if (this.isLikelyBase64(decodedContent)) {
      try {
        const decoded = Buffer.from(decodedContent.replace(/\s/g, ''), 'base64').toString('utf8')
        // Solo se il risultato sembra HTML o testo leggibile
        if (decoded.length > 10 && (/<[^>]+>/.test(decoded) || /[a-zA-Z\s]{20,}/.test(decoded))) {
          decodedContent = decoded
        }
      } catch (e) {
        // Se fallisce, usa il contenuto originale
      }
    }

    // Applica correzioni di encoding UTF-8 (stesso fix usato nelle preview)
    decodedContent = this.fixCharacterEncoding(decodedContent)

    // Pulisci caratteri di controllo
    decodedContent = decodedContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    return decodedContent
  }

  /**
   * Corregge problemi di encoding UTF-8 comuni
   */
  private fixCharacterEncoding(text: string): string {
    // Correzioni UTF-8 mal decodificato
    const charFixes: { [key: string]: string } = {
      // Caratteri italiani mal decodificati
      'Ã ': 'à', 'Ã¡': 'á', 'Ã¨': 'è', 'Ã©': 'é', 'Ã¬': 'ì', 'Ã­': 'í',
      'Ã²': 'ò', 'Ã³': 'ó', 'Ã¹': 'ù', 'Ãº': 'ú', 'Ã§': 'ç', 'Ã±': 'ñ',
      // Pattern comune: Ã seguita da carattere non ASCII
      'Ã¯': 'ï', 'Ã¤': 'ä', 'Ã¶': 'ö', 'Ã¼': 'ü', 'Ã«': 'ë',
      // Altri caratteri speciali
      'Ä': 'è', 'Å': 'è', 'Â ': ' ', 'Â': '',
      // Quote smart mal decodificate
      'â€™': "'", 'â€œ': '"', 'â€\u009d': '"', 'â€"': '-', 'â€¦': '...',
      // Spazi non-breaking mal decodificati
      'Â ': ' ', 'Â\u00A0': ' ',
      // Caratteri Unicode replacement mal gestiti (il � che vediamo)
      ' � ': ' è ', // Spesso è una "è" al posto di �
      ' ♦ ': ' è ', // Simbolo diamante spesso è una "è"
      ' ◊ ': ' è ', // Altro simbolo diamante spesso è una "è"
      '� ': 'è ', // � seguito da spazio
      ' �': ' è', // spazio seguito da �
      '�': 'è', // � singolo viene sostituito con è (caso più comune in italiano)
    }

    // Applica le correzioni
    for (const [wrong, correct] of Object.entries(charFixes)) {
      text = text.replace(new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct)
    }

    // Decodifica HTML entities
    const htmlEntities: { [key: string]: string } = {
      '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
      '&quot;': '"', '&#39;': "'", '&agrave;': 'à', '&aacute;': 'á',
      '&egrave;': 'è', '&eacute;': 'é', '&igrave;': 'ì', '&iacute;': 'í',
      '&ograve;': 'ò', '&oacute;': 'ó', '&ugrave;': 'ù', '&uacute;': 'ú',
      '&ccedil;': 'ç'
    }

    for (const [entity, char] of Object.entries(htmlEntities)) {
      text = text.replace(new RegExp(entity, 'gi'), char)
    }

    return text
  }

  /**
   * Decodifica quoted-printable
   */
  private decodeQuotedPrintable(input: string): string {
    return input
      // Rimuovi soft line breaks (= at end of line)
      .replace(/=\r?\n/g, '')
      // Decodifica hex codes
      .replace(/=([0-9A-F]{2})/gi, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16))
      })
      // Gestisci caratteri speciali italiani
      .replace(/=C3=A0/g, 'à')
      .replace(/=C3=A8/g, 'è')
      .replace(/=C3=A9/g, 'é')
      .replace(/=C3=AC/g, 'ì')
      .replace(/=C3=B2/g, 'ò')
      .replace(/=C3=B9/g, 'ù')
  }

  /**
   * Decodifica MIME header encoding (=?charset?encoding?content?=)
   */
  private decodeMimeHeader(input: string): string {
    return input.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (match, charset, encoding, content) => {
      try {
        if (encoding.toUpperCase() === 'B') {
          // Base64 decoding
          const decoded = Buffer.from(content, 'base64').toString('utf8')
          return decoded
        } else if (encoding.toUpperCase() === 'Q') {
          // Quoted-printable decoding
          return this.decodeQuotedPrintable(content.replace(/_/g, ' '))
        }
      } catch (e) {
        console.warn('Errore decodifica MIME header:', e)
      }
      return match
    })
  }

  /**
   * Verifica se il contenuto potrebbe essere Base64
   */
  private isLikelyBase64(content: string): boolean {
    if (!content || content.length < 50) return false

    // Rimuovi whitespace per il test
    const clean = content.replace(/\s/g, '')

    // Base64 deve avere lunghezza multipla di 4 (dopo padding)
    if (clean.length % 4 !== 0) return false

    // Base64 contiene solo caratteri validi
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
    if (!base64Regex.test(clean)) return false

    // Se ha pattern tipici del Base64 (molto lungo, principalmente caratteri alfanumerici)
    return clean.length > 100 && clean.length < 1000000
  }

  /**
   * Genera anteprima testo
   */
  private generatePreview(content: string | Buffer | null | undefined): string {
    if (!content) return ''

    // Converti in stringa se necessario
    let textContent = ''
    if (typeof content === 'string') {
      textContent = content
    } else if (Buffer.isBuffer(content)) {
      textContent = content.toString('utf8')
    } else if (typeof content === 'object') {
      // Gestisci altri tipi di oggetti che potrebbero arrivare
      try {
        textContent = JSON.stringify(content)
      } catch {
        return '(Contenuto non decodificabile)'
      }
    } else {
      console.warn('generatePreview ricevuto tipo non gestito:', typeof content, content)
      return '(Tipo contenuto non supportato)'
    }

    // Rileva contenuto binario nelle prime 200 caratteri
    const preview = textContent.substring(0, 200)
    const binaryPatterns = [
      /JFIF/, // JPEG files
      /PNG/, // PNG files
      /GIF8/, // GIF files
      /Exif/, // EXIF data
      /\x00{3,}/, // Null bytes
      /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]{10,}/, // Molti caratteri di controllo binari
      /^[A-Za-z0-9+/=]{100,}$/, // Base64 molto lungo
    ]

    if (binaryPatterns.some(pattern => pattern.test(preview))) {
      return '(Email con contenuto multimediale o allegati)'
    }

    // Controlla se è contenuto MIME multipart o troppo tecnico
    const technicalPatterns = [
      /Content-Type:/i,
      /Content-Transfer-Encoding:/i,
      /boundary=/i,
      /multipart\/alternative/i,
      /charset=/i,
      /--[0-9]{10,}/g, // Boundary separatori
      /^[A-Za-z0-9+/=]{100,}$/, // Base64 lungo
      /^\s*[0-9a-f-]{20,}\s*$/i, // Sequenze hex
    ]

    // Se contiene troppo contenuto tecnico, cerca parti alternative
    const isTechnical = technicalPatterns.some(pattern => pattern.test(textContent))

    if (isTechnical) {
      // Cerca sezioni di testo leggibile in multipart
      const textSections = []

      // Estrai contenuto dopo "text/plain"
      const plainTextMatch = textContent.match(/Content-Type:\s*text\/plain[\s\S]*?\n\n([\s\S]*?)(?=--|\n\nContent-Type|$)/i)
      if (plainTextMatch && plainTextMatch[1]) {
        textSections.push(plainTextMatch[1])
      }

      // Estrai contenuto dopo "text/html" e rimuovi HTML
      const htmlMatch = textContent.match(/Content-Type:\s*text\/html[\s\S]*?\n\n([\s\S]*?)(?=--|\n\nContent-Type|$)/i)
      if (htmlMatch && htmlMatch[1]) {
        let htmlContent = htmlMatch[1]
        htmlContent = htmlContent.replace(/<[^>]*>/g, ' ')
        textSections.push(htmlContent)
      }

      // Usa la sezione più lunga che sembri essere testo normale
      if (textSections.length > 0) {
        textContent = textSections
          .map(section => section.trim())
          .filter(section => section.length > 10)
          .sort((a, b) => b.length - a.length)[0] || ''
      }

      // Se ancora non abbiamo contenuto valido, fallback
      if (!textContent || textContent.length < 10) {
        return '(Email multipart - contenuto non disponibile per anteprima)'
      }
    }

    // Verifica che textContent sia ancora una stringa valida prima delle operazioni replace
    if (typeof textContent !== 'string') {
      console.warn('textContent non è una stringa valida in generatePreview:', typeof textContent, textContent)
      return '(Contenuto email non processabile)'
    }

    // Gestisci quoted-printable encoding (= seguito da hex)
    textContent = textContent.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16))
    })

    // Rimuovi soft line breaks (= alla fine della riga)
    textContent = textContent.replace(/=\r?\n/g, '')

    // Rimuovi ancora eventuali header residui
    textContent = textContent.replace(/^.*?Content-Type:.*$/gmi, '')
    textContent = textContent.replace(/^.*?Content-Transfer-Encoding:.*$/gmi, '')
    textContent = textContent.replace(/^.*?charset=.*$/gmi, '')

    // Rimuovi CSS styles e HTML
    textContent = textContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    textContent = textContent.replace(/\{[^}]*\}/g, '')
    textContent = textContent.replace(/style\s*=\s*["'][^"']*["']/gi, '')
    textContent = textContent.replace(/<[^>]*>/g, ' ')

    // Decodifica entità HTML
    const htmlEntities: { [key: string]: string } = {
      '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
      '&quot;': '"', '&#39;': "'", '&agrave;': 'à', '&aacute;': 'á',
      '&egrave;': 'è', '&eacute;': 'é', '&igrave;': 'ì', '&iacute;': 'í',
      '&ograve;': 'ò', '&oacute;': 'ó', '&ugrave;': 'ù', '&uacute;': 'ú',
      '&ccedil;': 'ç'
    }

    for (const [entity, char] of Object.entries(htmlEntities)) {
      textContent = textContent.replace(new RegExp(entity, 'gi'), char)
    }

    // Applica correzioni character encoding
    textContent = this.fixCharacterEncoding(textContent)

    // Pulizia finale
    textContent = textContent.replace(/&#\d+;/g, '')
    textContent = textContent.replace(/([=\-_\+\*])\s*\1\s*\1+/g, ' ')
    textContent = textContent.replace(/[A-Za-z0-9+/]{50,}/g, ' ')
    textContent = textContent.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, ' ')
    textContent = textContent.replace(/\s+/g, ' ').trim()

    // Controlla se il risultato è valido
    if (textContent.length < 10 || /^[A-Za-z0-9+/=\s\-_]+$/.test(textContent)) {
      return '(Contenuto email non disponibile per anteprima)'
    }

    return textContent.length > 200 ? textContent.substring(0, 200) + '...' : textContent
  }

  /**
   * Controlla se il messaggio ha allegati
   */
  private hasAttachments(bodyStructure: any): boolean {
    if (!bodyStructure) return false

    const checkStructure = (part: any): boolean => {
      // Usa la stessa logica del metodo isAttachmentPart
      if (this.isAttachmentPart(part)) {
        const fileName = part.parameters?.name || part.parameters?.filename || 'senza nome'
        console.log(`📎 Allegato trovato: ${fileName} (${part.type}/${part.subtype})`)
        return true
      }

      // Controlla ricorsivamente se multipart
      if (part.childNodes && Array.isArray(part.childNodes)) {
        return part.childNodes.some(checkStructure)
      }

      return false
    }

    const hasFiles = checkStructure(bodyStructure)
    console.log(`📎 Email ha allegati: ${hasFiles}`)
    return hasFiles
  }

  /**
   * Estrae allegati da un messaggio IMAP
   */
  async extractAttachments(messageId: string, folderPath: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client IMAP non connesso')
    }

    try {
      console.log(`📎 Inizio estrazione allegati per messaggio ${messageId} nella cartella ${folderPath}`)

      // FORZA RESET della connessione per evitare cache contaminate
      if (this.client) {
        await this.client.logout()
        this.client = null
      }

      // Riconnetti fresco
      await this.connect()

      // Seleziona la cartella
      await this.client!.mailboxOpen(folderPath)

      // Converte messageId a numero per UID
      const uid = parseInt(messageId)
      console.log(`📎 Estrazione allegati per UID diretto: ${uid}`)

      // Ottieni la struttura del messaggio
      const structureData = await this.client.fetchOne(uid, {
        uid: true,
        bodyStructure: true
      }, { uid: true })

      if (!structureData || !structureData.bodyStructure) {
        console.log(`📎 Nessuna struttura body trovata per UID ${uid}`)
        return []
      }

      // Estrai le parti che sono allegati
      const attachmentParts: string[] = []
      this.findAttachmentParts(structureData.bodyStructure, '', attachmentParts)

      console.log(`📎 Parti allegati trovate:`, attachmentParts)

      if (attachmentParts.length === 0) {
        console.log(`📎 Nessun allegato trovato per UID ${uid}`)
        return []
      }

      // Scarica i contenuti degli allegati
      const attachmentData = await this.client.fetchOne(uid, {
        uid: true,
        bodyParts: attachmentParts
      }, { uid: true })

      if (!attachmentData || !attachmentData.bodyParts) {
        console.log(`📎 Nessun contenuto allegati scaricato per UID ${uid}`)
        return []
      }

      // Processa gli allegati
      const attachments = this.processAttachmentParts(structureData.bodyStructure, '', attachmentData.bodyParts)
      console.log(`📎 Allegati processati:`, attachments.map(a => ({ name: a.name, size: a.size, type: a.type })))

      return attachments

    } catch (error: any) {
      console.error('📎 Errore estrazione allegati:', error)
      throw new Error(`Errore estrazione allegati: ${error.message}`)
    }
  }

  /**
   * Trova parti che sono allegati nella struttura del messaggio
   */
  private findAttachmentParts(structure: any, prefix: string, parts: string[]): void {
    if (!structure) return

    // Se ha childNodes, è multipart
    if (structure.childNodes && Array.isArray(structure.childNodes)) {
      structure.childNodes.forEach((child: any, index: number) => {
        const childPrefix = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
        this.findAttachmentParts(child, childPrefix, parts)
      })
    } else {
      // È una parte singola - controlla se è allegato
      if (prefix && this.isAttachmentPart(structure)) {
        console.log(`📎 Parte allegato trovata: ${prefix}`, {
          disposition: structure.disposition,
          type: structure.type,
          subtype: structure.subtype,
          parameters: structure.parameters
        })
        parts.push(prefix)
      }
    }
  }

  /**
   * Verifica se una parte è un allegato
   */
  private isAttachmentPart(part: any): boolean {
    // Escludi esplicitamente i tipi che NON sono allegati
    if (part.type === 'multipart' || part.type === 'message') {
      return false
    }

    // Se è esplicitamente marcato come attachment
    if (part.disposition === 'attachment') {
      return true
    }

    // Se è inline, probabilmente non è un allegato (es. immagini embedded)
    if (part.disposition === 'inline') {
      return false
    }

    // File con nome e tipo non-text sono probabilmente allegati
    if (part.parameters && (part.parameters.name || part.parameters.filename)) {
      // Se è text/plain o text/html e non ha disposition attachment, probabilmente è corpo email
      if (part.type === 'text' && (part.subtype === 'plain' || part.subtype === 'html') && !part.disposition) {
        return false
      }
      return true
    }

    // Tipi binari comuni che sono probabilmente allegati (anche senza nome esplicito)
    const binaryTypes = [
      'application', 'image', 'audio', 'video', 'model',
      'font', 'chemical', 'x-world'
    ]

    if (part.type && binaryTypes.includes(part.type.toLowerCase())) {
      // Escludi alcune applicazioni che sono parte del contenuto email
      const excludedSubtypes = [
        'pkcs7-signature', 'pkcs7-mime', 'x-pkcs7-signature', 'x-pkcs7-mime'
      ]

      if (part.subtype && excludedSubtypes.includes(part.subtype.toLowerCase())) {
        return false
      }

      return true
    }

    return false
  }

  /**
   * Processa le parti allegati scaricate
   */
  private processAttachmentParts(structure: any, prefix: string, bodyParts: Map<string, any>): any[] {
    const attachments: any[] = []

    const processStructure = (struct: any, pref: string) => {
      if (!struct) return

      if (struct.childNodes && Array.isArray(struct.childNodes)) {
        struct.childNodes.forEach((child: any, index: number) => {
          const childPrefix = pref ? `${pref}.${index + 1}` : `${index + 1}`
          processStructure(child, childPrefix)
        })
      } else {
        if (pref && this.isAttachmentPart(struct)) {
          const content = bodyParts.get(pref)
          if (content) {
            // Gestisci correttamente l'encoding del contenuto
            let processedContent: string
            const encoding = struct.encoding?.toLowerCase() || 'base64'

            console.log(`📎 Processing attachment ${struct.parameters?.name} with encoding: ${encoding}`)

            if (Buffer.isBuffer(content)) {
              // È già un buffer binario - convertilo in base64 per il database
              processedContent = content.toString('base64')
              console.log(`📎 Buffer di ${content.length} bytes convertito in base64`)
            } else if (typeof content === 'string') {
              // Il contenuto è una stringa - dobbiamo gestire l'encoding
              if (encoding === 'base64') {
                // È già base64 - validalo e puliscilo
                let cleanContent = content.replace(/[\r\n\s]/g, '')

                // Controlla se è doppiamente codificato (common issue)
                // Prova a decodificare e vedere se inizia con un header PDF o altri pattern
                try {
                  const testDecode = Buffer.from(cleanContent, 'base64').toString('ascii')
                  console.log(`📎 Test decodifica per ${struct.parameters?.name}: primi 20 char = "${testDecode.slice(0, 20)}"`)

                  if (testDecode.startsWith('JVBERi0') || testDecode.startsWith('%PDF-') ||
                      testDecode.match(/^[A-Za-z0-9+/]{100,}/)) {
                    console.log(`📎 🔄 Rilevata doppia codifica base64 per ${struct.parameters?.name}`)
                    // È doppiamente codificato - decodifica una volta
                    cleanContent = testDecode
                  }
                } catch (e) {
                  console.log(`📎 Test decodifica fallito per ${struct.parameters?.name}: ${e.message}`)
                }

                processedContent = cleanContent

                // Valida che sia effettivamente base64 valido
                const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
                if (!base64Regex.test(processedContent)) {
                  console.warn(`📎 Contenuto base64 non valido per ${struct.parameters?.name}, riprocessando...`)
                  // Prova a riconvertire come binario
                  processedContent = Buffer.from(content, 'binary').toString('base64')
                }
                console.log(`📎 Contenuto base64 validato: ${processedContent.length} caratteri`)
              } else if (encoding === 'quoted-printable') {
                // Converti da quoted-printable a buffer e poi base64
                const decoded = this.decodeQuotedPrintable(content)
                processedContent = Buffer.from(decoded, 'binary').toString('base64')
                console.log(`📎 Quoted-printable decodificato e convertito in base64`)
              } else {
                // Per altri encoding, assumiamo che sia già binario
                processedContent = Buffer.from(content, 'binary').toString('base64')
                console.log(`📎 Contenuto ${encoding} convertito in base64`)
              }
            } else {
              // Fallback per altri tipi
              processedContent = Buffer.from(String(content), 'binary').toString('base64')
              console.log(`📎 Fallback: convertito in base64`)
            }

            // Ultima validazione del risultato base64
            try {
              Buffer.from(processedContent, 'base64')
              console.log(`📎 Base64 finale validato correttamente per ${struct.parameters?.name}`)
            } catch (validateError) {
              console.error(`📎 ERRORE: Base64 finale non valido per ${struct.parameters?.name}:`, validateError)
              // Se il base64 è corrotto, non aggiungiamo l'allegato
              return
            }

            // Determina il tipo MIME corretto
            let mimeType = 'application/octet-stream'
            if (struct.type && struct.subtype) {
              mimeType = `${struct.type}/${struct.subtype}`
            } else {
              // Fallback basato sull'estensione del file
              const filename = struct.parameters?.name || struct.parameters?.filename || ''
              if (filename.toLowerCase().endsWith('.pdf')) {
                mimeType = 'application/pdf'
              } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
                mimeType = 'image/jpeg'
              } else if (filename.toLowerCase().endsWith('.png')) {
                mimeType = 'image/png'
              }
            }

            const attachment = {
              name: struct.parameters?.name || struct.parameters?.filename || `allegato_${pref}`,
              type: mimeType,
              size: struct.size || (Buffer.isBuffer(content) ? content.length : processedContent.length),
              content: processedContent,
              part: pref,
              encoding: struct.encoding || 'base64'  // Aggiungi info encoding
            }
            attachments.push(attachment)
            console.log(`📎 Allegato processato: ${attachment.name} (${attachment.size} bytes)`)
          }
        }
      }
    }

    processStructure(structure, prefix)
    return attachments
  }

  /**
   * Decodifica contenuto quoted-printable
   */
  private decodeQuotedPrintable(input: string): string {
    return input
      .replace(/=\r?\n/g, '') // Rimuovi soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16))
      })
  }

  /**
   * Salva cartelle nel database
   */
  private async saveFoldersToDatabase(folders: EmailFolder[]): Promise<void> {
    for (const folder of folders) {
      try {
        const { error } = await supabase
          .from('scadenze_bandi_email_folders')
          .upsert({
            account_id: folder.account_id,
            name: folder.name,
            full_path: folder.full_path,
            folder_type: folder.folder_type,
            total_messages: folder.total_messages,
            unread_messages: folder.unread_messages,
            highest_uid: folder.highest_uid,
            last_sync: new Date().toISOString()
          }, {
            onConflict: 'account_id,full_path'
          })

        if (error) {
          console.error('Errore salvataggio cartella:', error)
        }
      } catch (err) {
        console.error('Errore upsert cartella:', err)
      }
    }
  }

  /**
   * Salva messaggi nel database
   */
  private async saveMessagesToDatabase(messages: EmailMessage[], folderPath: string): Promise<void> {
    // Prima ottieni l'ID della cartella
    const { data: folder } = await supabase
      .from('scadenze_bandi_email_folders')
      .select('id')
      .eq('account_id', this.account.id)
      .eq('full_path', folderPath)
      .single()

    if (!folder) {
      console.error('Cartella non trovata:', folderPath)
      return
    }

    console.log(`💾 Tentativo salvataggio ${messages.length} messaggi nel database`)

    for (const message of messages) {
      try {
        message.folder_id = folder.id

        // Prima controlla se esiste già
        const { data: existing } = await supabase
          .from('scadenze_bandi_email_messages')
          .select('id, uid')
          .eq('account_id', message.account_id)
          .eq('folder_id', message.folder_id)
          .eq('uid', message.uid)
          .single()

        if (existing) {
          console.log(`⏭️ Messaggio UID ${message.uid} già presente, skip`)
          continue
        }

        console.log(`➕ Inserimento nuovo messaggio UID ${message.uid}: ${message.subject?.substring(0, 50)}...`)

        const { data, error } = await supabase
          .from('scadenze_bandi_email_messages')
          .insert({
            account_id: message.account_id,
            folder_id: message.folder_id,
            message_id: message.message_id,
            uid: message.uid,
            subject: message.subject,
            from_address: message.from_address,
            from_name: message.from_name,
            to_addresses: message.to_addresses,
            cc_addresses: message.cc_addresses,
            body_text: message.body_text,
            body_html: message.body_html,
            body_preview: message.body_preview,
            date_sent: message.date_sent.toISOString(),
            date_received: message.date_received.toISOString(),
            is_read: message.is_read,
            is_flagged: message.is_flagged,
            has_attachments: message.has_attachments,
            size_bytes: message.size_bytes
          })
          .select()

        if (error) {
          console.error(`❌ Errore inserimento messaggio UID ${message.uid}:`, error)
        } else {
          console.log(`✅ Messaggio UID ${message.uid} inserito con successo`)
        }
      } catch (err) {
        console.error(`❌ Errore salvataggio messaggio UID ${message.uid}:`, err)
      }
    }
  }

  /**
   * Decripta password (implementazione base - migliorare in produzione)
   */
  private decryptPassword(encrypted: string): string {
    // Per ora return diretto - implementare vera encryption
    // In produzione usare crypto.createCipher/createDecipher
    return encrypted
  }

  /**
   * Chiudi connessione
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        // Controlla se la connessione è ancora utilizzabile
        if (this.client.usable) {
          await this.client.logout()
        }
      } catch (err) {
        // Ignora errori di disconnessione
        console.warn('Errore durante logout:', err)
      } finally {
        this.client = null
      }
    }
  }
}

/**
 * Test configurazione SMTP
 */
export async function testSmtpConnection(account: EmailAccount): Promise<{ success: boolean; error?: string }> {
  try {
    // Decripta password
    const password = account.encrypted_password // Implementare decryption

    // Crea transporter
    const transporter = nodemailer.createTransport({
      host: account.smtp_server,
      port: account.smtp_port,
      secure: account.smtp_secure,
      auth: {
        user: account.username,
        pass: password
      }
    })

    // Verifica connessione
    await transporter.verify()

    return { success: true }

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Errore connessione SMTP'
    }
  }
}

/**
 * Helper per creare preset provider
 */
export function createProviderPreset(
  provider: EmailProvider,
  email: string,
  password: string
): Partial<EmailAccount> {
  const preset = EMAIL_PROVIDERS[provider]

  return {
    provider_type: provider,
    email_address: email,
    username: email,
    encrypted_password: password, // Criptare in produzione
    imap_server: preset.imap.host,
    imap_port: preset.imap.port,
    imap_secure: preset.imap.secure,
    smtp_server: preset.smtp.host,
    smtp_port: preset.smtp.port,
    smtp_secure: preset.smtp.secure
  }
}