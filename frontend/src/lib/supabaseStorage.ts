import { supabase } from '@/lib/supabase'

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

export async function deleteFile(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
  return data
}

export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export { BUCKET_CLIENTI, BUCKET_CONTRATTI }
