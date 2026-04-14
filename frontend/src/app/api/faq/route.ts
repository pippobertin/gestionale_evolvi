import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import fs from 'fs'
import path from 'path'

let faqCache: string | null = null

function loadFAQ(): string {
  if (faqCache) return faqCache
  const faqPath = path.join(process.cwd(), '..', 'docs', 'chatbot', 'FAQ_GESTIONALE_EVOLVI.md')
  faqCache = fs.readFileSync(faqPath, 'utf-8')
  return faqCache
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyJWT(request)
    if (!user) {
      return Response.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      )
    }

    const content = loadFAQ()

    return Response.json({ success: true, content })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[FAQ API] Error:', errMsg)
    return Response.json(
      { success: false, error: 'Errore nel caricamento FAQ' },
      { status: 500 }
    )
  }
}
