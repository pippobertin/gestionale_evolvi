import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { extractBandoFromText } from '@/lib/bandiEsterniExtract'

/**
 * POST /api/bandi-esterni/extract
 *
 * Estrae i campi strutturati di UN bando esterno da testo libero (corpo di un
 * alert Agevolando o testo di una sintesi PDF), incollato a mano nell'ingest
 * assistito. La logica di estrazione/normalizzazione vive in
 * @/lib/bandiEsterniExtract (condivisa con l'ingest email di Fase B).
 *
 * Auth: verifyJWT (cookie utente).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyJWT(request)
    if (!user) {
      return Response.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const testo = typeof body?.testo === 'string' ? body.testo.trim() : ''

    if (!testo) {
      return Response.json(
        { success: false, error: 'Testo mancante' },
        { status: 400 }
      )
    }

    const bando = await extractBandoFromText(testo)
    if (!bando) {
      return Response.json(
        { success: false, error: 'Estrazione non riuscita (output non valido)' },
        { status: 502 }
      )
    }

    return Response.json({ success: true, bando })
  } catch (error) {
    console.error('[bandi-esterni/extract] Errore:', error)
    return Response.json(
      { success: false, error: 'Errore interno estrazione' },
      { status: 500 }
    )
  }
}
