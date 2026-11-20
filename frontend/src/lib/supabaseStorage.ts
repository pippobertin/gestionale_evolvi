import { supabase } from '@/lib/supabase'
import { spostaNelCestino } from '@/lib/cestinoArchivi'

const BUCKET_CLIENTI = 'clienti-amministrativi'
const BUCKET_CONTRATTI = 'contratti-firmati'

export async function uploadFile(bucket: string, path: string, file: File | Blob, contentType?: string) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: contentType || 'application/octet-stream',
    upsert: false
  })
  if (error) throw error
  return data
}

export async function downloadFile(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw error
  return data
}

/** Elimina un file spostandolo nel cestino dell'archivio (fase 4B): resta ripristinabile. */
export async function deleteFile(bucket: string, path: string) {
  const spostati = await spostaNelCestino(supabase, bucket, [path])
  if (spostati === 0) throw new Error(`File non spostato nel cestino: ${path}`)
  return { spostati }
}

export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export { BUCKET_CLIENTI, BUCKET_CONTRATTI }
