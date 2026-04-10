import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'firme-email'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/user/email-signature/upload-image
 * Uploads a signature logo image to Supabase Storage.
 * Returns the public URL for use in email HTML.
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyJWT(request)
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 })
    }

    // Validate image type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato non supportato. Usa PNG, JPG, GIF, WebP o SVG.' },
        { status: 400 }
      )
    }

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Immagine troppo grande (max 2MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const storagePath = `${decoded.userId}/logo.${ext}`

    const supabase = getSupabase()

    // Delete any existing logo for this user (different extensions)
    const { data: existing } = await supabase.storage.from(BUCKET).list(decoded.userId)
    if (existing && existing.length > 0) {
      const toRemove = existing
        .filter(f => f.name.startsWith('logo.'))
        .map(f => `${decoded.userId}/${f.name}`)
      if (toRemove.length > 0) {
        await supabase.storage.from(BUCKET).remove(toRemove)
      }
    }

    // Upload new image
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: `Errore upload: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl
    })
  } catch (error: any) {
    console.error('Error uploading signature image:', error)
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 })
  }
}
