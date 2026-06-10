import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { getAmbito } from '@/lib/interrogazioni/registry'
import { eseguiInterrogazione } from '@/lib/interrogazioni/queryBuilder'

/**
 * POST /api/interrogazioni/search
 *
 * Body atteso:
 *   {
 *     ambito: string,
 *     filtri: Record<string, ValoreFiltro>,
 *     pagina?: number,
 *     per_pagina?: number
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const ambitoId = body.ambito as string

    const ambito = getAmbito(ambitoId)
    if (!ambito) {
      return Response.json(
        { success: false, error: `Ambito sconosciuto: ${ambitoId}` },
        { status: 400 }
      )
    }

    const { righe, totale } = await eseguiInterrogazione({
      ambito,
      filtri: body.filtri || {},
      pagina: body.pagina,
      per_pagina: body.per_pagina,
    })

    return Response.json({
      success: true,
      data: {
        righe,
        totale,
        pagina: body.pagina || 1,
        per_pagina: body.per_pagina || 25,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore interrogazione'
    console.error('[API interrogazioni/search] Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
