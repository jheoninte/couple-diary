// Compression happens on the device. Original files and EXIF/GPS metadata are never uploaded.
export const PHOTO_POLICY = Object.freeze({ maxEdge: 1440, targetBytes: 256 * 1024,
  maxBytes: 512 * 1024, sourceBytes: 30 * 1024 * 1024, sourcePixels: 60_000_000 });
export function resizedDimensions(width, height, maxEdge = PHOTO_POLICY.maxEdge) {
  if (!(width > 0 && height > 0) || width * height > PHOTO_POLICY.sourcePixels)
    throw Error('사진 해상도가 너무 높거나 사진을 읽을 수 없습니다.');
  const ratio = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export function dataURLBytes(value) { return Math.floor((value.split(',')[1]?.length || 0) * 3 / 4) - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0); }
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* Safari fallback below. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, image, close() {} };
  } finally { URL.revokeObjectURL(url); }
}
export async function preparePhoto(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > PHOTO_POLICY.sourceBytes)
    throw Error('JPEG, PNG, WebP 사진을 30MB 이하로 선택해주세요. HEIC는 JPEG로 변환해주세요.');
  const bitmap = await decode(file);
  try {
    let size = resizedDimensions(bitmap.width, bitmap.height), result;
    const canvas = document.createElement('canvas');
    for (let pass = 0; pass < 5; pass++) {
      canvas.width = size.width; canvas.height = size.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(bitmap.image || bitmap, 0, 0, size.width, size.height);
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        result = canvas.toDataURL('image/jpeg', quality);
        if (dataURLBytes(result) <= PHOTO_POLICY.targetBytes) return result;
      }
      size = resizedDimensions(size.width, size.height, Math.max(640, Math.floor(Math.max(size.width, size.height) * 0.8)));
    }
    if (dataURLBytes(result) <= PHOTO_POLICY.maxBytes) return result;
    throw Error('사진을 압축하지 못했습니다. 다른 사진을 선택해주세요.');
  } finally { bitmap.close(); }
}

// Album-grid thumbnail: long edge 400px, at most 96 KB (the server limit).
export const THUMB_POLICY = Object.freeze({ maxEdge: 400, maxBytes: 96 * 1024 });
export async function prepareThumbnail(dataUrl) {
  const image = new Image(); image.src = dataUrl; await image.decode();
  const size = resizedDimensions(image.naturalWidth, image.naturalHeight, THUMB_POLICY.maxEdge);
  const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size.width, size.height); ctx.drawImage(image, 0, 0, size.width, size.height);
  for (const quality of [0.78, 0.66, 0.54]) { const result = canvas.toDataURL('image/jpeg', quality); if (dataURLBytes(result) <= THUMB_POLICY.maxBytes) return result; }
  throw Error('thumbnail too large');
}
