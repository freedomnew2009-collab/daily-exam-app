// ย่อ/บีบอัดรูปในเบราว์เซอร์ก่อนอัปโหลด เพื่อให้ไฟล์เล็กลง โหลดเร็วขึ้น
// คงความคมไว้พอสำหรับอ่าน (เช่น audiogram) — ย่อด้านยาวสุดไม่เกิน maxDim แล้วบันทึกเป็น JPEG
export async function compressImage(file, { maxDim = 1600, quality = 0.82 } = {}) {
  try {
    if (!file || !file.type?.startsWith('image/')) return file
    // GIF อาจเป็นภาพเคลื่อนไหว — ไม่แตะ
    if (file.type === 'image/gif') return file

    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result)
      r.onerror = rej
      r.readAsDataURL(file)
    })
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = dataUrl
    })

    let { width, height } = img
    if (!width || !height) return file
    const longest = Math.max(width, height)
    if (longest > maxDim) {
      const scale = maxDim / longest
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    // ถ้าบีบแล้วไม่เล็กลง (เช่นรูปเล็กอยู่แล้ว) ใช้ไฟล์เดิม
    if (!blob || blob.size >= file.size) return file

    const name = (file.name || 'image').replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    // ถ้าบีบอัดพลาด ใช้ไฟล์เดิมไปก่อน
    return file
  }
}
