export const resizeImageToDataUrl = async (
  file: File,
  maxSize: number,
  quality: number
): Promise<string> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"))
    img.src = dataUrl
  })

  const longestSide = Math.max(image.width, image.height)
  const scale = longestSide > maxSize ? maxSize / longestSide : 1
  const targetWidth = Math.max(1, Math.round(image.width * scale))
  const targetHeight = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("画像の処理に失敗しました")
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)
  return canvas.toDataURL("image/jpeg", quality)
}
