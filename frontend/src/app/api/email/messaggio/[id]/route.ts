import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { getGmailClient } from '@/lib/gmail'
import { leggiMessaggio } from '@/lib/emailCorrelate'

/** Contenuto di un messaggio della propria casella, per l'anteprima nel riquadro Email. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  try {
    const gmail = await getGmailClient(sessione.userId)
    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
    return NextResponse.json({ ok: true, messaggio: leggiMessaggio(data) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Messaggio non disponibile' }, { status: 500 })
  }
}
