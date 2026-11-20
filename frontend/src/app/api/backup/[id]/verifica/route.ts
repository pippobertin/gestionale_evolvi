import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/jwtAuth'
import { verificaBackup } from '@/lib/backupGestionale'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** Prova di leggibilità di un'esportazione: impronta, decompressione, righe per tabella. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  const { id } = await params
  return NextResponse.json(await verificaBackup(id))
}
