// 사진 처리 (개발계획 3절, 프로토타입 readPhoto/draw).
// 캔버스로 다시 JPEG로 저장하므로 EXIF(GPS)가 지워진다. 방향은 브라우저가 바로잡고, iOS HEIC도 JPEG가 된다.
const RECOGNIZE_MAX_PX = 1400
const THUMB_MAX_PX = 640
const MAX_FILE_BYTES = 30 * 1024 * 1024 // 휴대폰 원본 사진은 보통 10MB 아래
const RECOGNIZE_QUALITY = 0.85
const THUMB_QUALITY = 0.72

export type Photo = { full: Blob; thumb: Blob; thumbUrl: string }

function draw(src: HTMLImageElement | HTMLCanvasElement, max: number): HTMLCanvasElement {
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height
  const scale = Math.min(1, max / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(src, 0, 0, canvas.width, canvas.height)
  return canvas
}

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('toBlob'))), 'image/jpeg', quality))

// 이미지가 아니거나 너무 크거나 열리지 않으면 throw
export async function readPhoto(file: File): Promise<Photo> {
  // 일부 안드로이드는 type이 빈 문자열이라 그때는 열어 보고 판단한다
  if ((file.type && !file.type.startsWith('image/')) || file.size > MAX_FILE_BYTES) throw new Error('image_rejected')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return await toPhoto(draw(img, RECOGNIZE_MAX_PX))
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 시계 방향 90°. iPhone Safari 카메라로 평평하게 위에서 찍으면 촬영 단계에서 위아래가 거꾸로 저장될 때가 있다 (D2 실기기)
export async function rotatePhoto(photo: Photo): Promise<Photo> {
  const src = await createImageBitmap(photo.full)
  const canvas = document.createElement('canvas')
  canvas.width = src.height
  canvas.height = src.width
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(src, 0, 0)
  src.close()
  return toPhoto(canvas)
}

async function toPhoto(big: HTMLCanvasElement): Promise<Photo> {
  const thumb = await toJpeg(draw(big, THUMB_MAX_PX), THUMB_QUALITY)
  return { full: await toJpeg(big, RECOGNIZE_QUALITY), thumb, thumbUrl: URL.createObjectURL(thumb) }
}

// recognize 함수 입력: data URL 머리말을 뗀 base64
export const toBase64 = (blob: Blob) =>
  new Promise<string>((ok, no) => {
    const reader = new FileReader()
    reader.onload = () => ok(String(reader.result).split(',')[1])
    reader.onerror = () => no(reader.error)
    reader.readAsDataURL(blob)
  })
