import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { getAmbito, listAmbiti } from '@/lib/interrogazioni/registry'

/**
 * GET /api/interrogazioni/ambito?id=<id>
 *   Restituisce la definizione completa dell'ambito (filtri, colonne, azioni).
 *
 * GET /api/interrogazioni/ambito  (senza id)
 *   Restituisce l'elenco degli ambiti disponibili.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get('id')

    if (!id) {
      // Elenco ambiti (versione "leggera")
      const elenco = listAmbiti().map(a => ({
        id: a.id,
        label: a.label,
        descrizione: a.descrizione,
      }))
      return Response.json({ success: true, data: elenco })
    }

    const ambito = getAmbito(id)
    if (!ambito) {
      return Response.json(
        { success: false, error: `Ambito sconosciuto: ${id}` },
        { status: 404 }
      )
    }

    return Response.json({ success: true, data: ambito })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore'
    console.error('[API interrogazioni/ambito] Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
