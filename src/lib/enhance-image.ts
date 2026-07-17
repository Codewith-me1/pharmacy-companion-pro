const MAX_DIMENSION = 2000;
const MIN_DIMENSION = 1600;

// Runs client-side only (called from event handlers, never during SSR render). Improves OCR
// accuracy on blurry/low-light/low-res purchase invoice photos before they're sent to the vision
// model: normalizes resolution to what the model actually uses internally, boosts contrast so
// faint printed text separates from the background, and sharpens edges so characters that have
// bled together from camera shake become distinguishable again.
export async function enhanceInvoiceImage(base64: string, mimeType: string): Promise<{ base64: string; mimeType: string }> {
  try {
    const img = await loadImage(`data:${mimeType};base64,${base64}`);
    const longestEdge = Math.max(img.width, img.height);
    let scale = 1;
    if (longestEdge > MAX_DIMENSION) scale = MAX_DIMENSION / longestEdge;
    else if (longestEdge < MIN_DIMENSION) scale = MIN_DIMENSION / longestEdge;

    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { base64, mimeType };

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Mild contrast/brightness/saturation lift counteracts the washed-out, low-contrast look
    // typical of phone photos taken under poor lighting or at an angle.
    ctx.filter = "contrast(1.18) brightness(1.06) saturate(1.05)";
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    ctx.filter = "none";

    sharpen(ctx, targetWidth, targetHeight);

    const outputMimeType = "image/jpeg";
    const dataUrl = canvas.toDataURL(outputMimeType, 0.95);
    const [, outputBase64] = dataUrl.split(",");
    return { base64: outputBase64 ?? base64, mimeType: outputMimeType };
  } catch {
    // A failed enhancement (unsupported format, tainted canvas, etc.) should never block the
    // upload — fall back to the original photo rather than erroring out.
    return { base64, mimeType };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for enhancement"));
    img.src = src;
  });
}

// Unsharp-mask-style sharpen via a 3x3 kernel, blended with the original at partial strength so
// text edges pop without amplifying JPEG grain into noise.
function sharpen(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const amount = 0.45;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ny = Math.min(height - 1, Math.max(0, y + ky));
            const nx = Math.min(width - 1, Math.max(0, x + kx));
            sum += src[(ny * width + nx) * 4 + c] * kernel[k];
            k++;
          }
        }
        out[idx + c] = src[idx + c] * (1 - amount) + sum * amount;
      }
      out[idx + 3] = src[idx + 3];
    }
  }

  imageData.data.set(out);
  ctx.putImageData(imageData, 0, 0);
}
