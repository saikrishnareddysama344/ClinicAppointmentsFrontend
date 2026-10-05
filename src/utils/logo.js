// Clinic logos: the address the API gives ("/v1/clinics/<code>/logo?v=3") made absolute, and a picture shrunk in
// the browser before upload (at most 256 px, sent as PNG; the server accepts PNG / JPEG / WebP up to 200 KB).
import { appConfig } from '@/config/env'

export const LOGO_MAX_SIDE = 256
const MAX_BYTES = 200 * 1024

export const logoUrl = (path) => (path ? `${appConfig.apiBaseUrl}${path}` : null)

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This file is not a picture the browser can open.'))
    }
    img.src = url
  })
}

// A picture file -> "data:image/png;base64,..." no larger than LOGO_MAX_SIDE on its longest side.
export async function shrinkLogo(file) {
  const img = await readImage(file)
  const width = img.naturalWidth || LOGO_MAX_SIDE
  const height = img.naturalHeight || LOGO_MAX_SIDE
  const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(width, height))
  const canvas = Object.assign(document.createElement('canvas'),
    { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) })
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  let data = canvas.toDataURL('image/png')
  if (data.length * 0.75 > MAX_BYTES) data = canvas.toDataURL('image/webp', 0.85)   // a busy photo: smaller as WebP
  if (data.length * 0.75 > MAX_BYTES) throw new Error('The picture is too large even after shrinking.')
  return data
}
