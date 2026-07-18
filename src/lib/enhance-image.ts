import { loadOpenCvWithTimeout } from "./opencv-loader";

const TARGET_MAX = 2000;
const TARGET_MIN = 1600;
const DETECT_MAX = 900; // downscale for edge/contour detection only — speed, not quality

interface Point {
  x: number;
  y: number;
}

// Runs client-side only (called from event handlers, never during SSR render). Improves OCR
// accuracy on real-world purchase invoice photos before they're sent to Azure Document
// Intelligence: detects the invoice's paper edges and un-skews it to a flat top-down rectangle
// (fixes photos taken at an angle), removes shadows/uneven lighting, boosts local contrast,
// converts to grayscale, and sharpens text edges. Falls back to a dependency-free version of the
// same idea (no perspective correction) if OpenCV.js can't load, and falls back to the original,
// untouched photo if anything else goes wrong — a capture pipeline must never be blocked by a
// preprocessing failure.
//
// Auto-rotation is intentionally NOT hand-rolled here: browsers already decode images respecting
// EXIF orientation by default (drawImage/`<img>` honor `image-orientation: from-image`), and
// Azure Document Intelligence's layout model is itself robust to in-plane rotation/skew — a
// custom text-orientation heuristic would be guesswork without much benefit on top of those two.
export async function enhanceInvoiceImage(base64: string, mimeType: string): Promise<{ base64: string; mimeType: string }> {
  try {
    const img = await loadImage(`data:${mimeType};base64,${base64}`);
    const canvas = drawToWorkingCanvas(img);

    const cv = await loadOpenCvWithTimeout();
    if (cv) {
      try {
        return enhanceWithOpenCv(cv, canvas);
      } catch (err) {
        console.warn("[enhance-image] OpenCV pipeline failed, falling back to basic enhancement:", err);
      }
    }
    return enhanceBasic(canvas);
  } catch (err) {
    console.warn("[enhance-image] Enhancement failed, using original photo:", err);
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

function drawToWorkingCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const longestEdge = Math.max(img.width, img.height);
  let scale = 1;
  if (longestEdge > TARGET_MAX) scale = TARGET_MAX / longestEdge;
  else if (longestEdge < TARGET_MIN) scale = TARGET_MIN / longestEdge;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement): { base64: string; mimeType: string } {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const [, base64] = dataUrl.split(",");
  return { base64: base64 ?? "", mimeType: "image/jpeg" };
}

// ---------------------------------------------------------------------------
// OpenCV.js pipeline: document edge detection + perspective correction, then shadow removal,
// local contrast (CLAHE), and an unsharp-mask sharpen — all on a single grayscale channel.
// ---------------------------------------------------------------------------

function enhanceWithOpenCv(cv: any, canvas: HTMLCanvasElement): { base64: string; mimeType: string } {
  const mats: any[] = [];
  const track = <T>(m: T): T => {
    mats.push(m);
    return m;
  };

  try {
    const src = track(cv.imread(canvas));
    const warped = detectAndWarp(cv, src);
    const working = warped ? track(warped) : src;

    const gray = track(new cv.Mat());
    cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);

    // Shadow/illumination removal: divide by a heavily-blurred version of itself so slow-varying
    // lighting gradients cancel out while high-frequency text edges survive.
    const bgKernel = oddKernelSize(Math.round(Math.min(gray.rows, gray.cols) / 15));
    const background = track(new cv.Mat());
    cv.blur(gray, background, new cv.Size(bgKernel, bgKernel));
    const meanBg = cv.mean(background)[0] || 200;
    const normalized = track(new cv.Mat());
    cv.divide(gray, background, normalized, meanBg);

    let contrasted = normalized;
    try {
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      contrasted = track(new cv.Mat());
      clahe.apply(normalized, contrasted);
      clahe.delete();
    } catch {
      contrasted = normalized;
    }

    const blurredForSharpen = track(new cv.Mat());
    cv.GaussianBlur(contrasted, blurredForSharpen, new cv.Size(0, 0), 3);
    const sharpened = track(new cv.Mat());
    cv.addWeighted(contrasted, 1.5, blurredForSharpen, -0.5, 0, sharpened);

    const outputCanvas = document.createElement("canvas");
    cv.imshow(outputCanvas, sharpened);
    return canvasToJpeg(outputCanvas);
  } finally {
    for (const m of mats) {
      try {
        m.delete();
      } catch {
        // best-effort cleanup — a failed delete shouldn't surface as an error
      }
    }
  }
}

// Detects the invoice's paper boundary (largest roughly-rectangular high-contrast region) and
// warps it to a flat top-down view. Returns null (leaving the original framing untouched) if no
// confident quadrilateral is found — a missed detection should never crop or distort the photo.
function detectAndWarp(cv: any, src: any): any | null {
  const mats: any[] = [];
  const t = <T>(m: T): T => {
    mats.push(m);
    return m;
  };

  try {
    const scale = Math.min(1, DETECT_MAX / Math.max(src.cols, src.rows));
    const small = t(new cv.Mat());
    cv.resize(src, small, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);

    const gray = t(new cv.Mat());
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    const blurred = t(new cv.Mat());
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    const edges = t(new cv.Mat());
    cv.Canny(blurred, edges, 50, 150);
    const kernel = t(cv.Mat.ones(3, 3, cv.CV_8U));
    cv.dilate(edges, edges, kernel);

    const contours = t(new cv.MatVector());
    const hierarchy = t(new cv.Mat());
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const minArea = small.cols * small.rows * 0.2;
    let best: any = null;
    let bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area > bestArea && area > minArea) {
        bestArea = area;
        if (best) best.delete();
        best = contour;
      } else {
        contour.delete();
      }
    }
    if (!best) return null;
    t(best);

    const peri = cv.arcLength(best, true);
    const approx = t(new cv.Mat());
    cv.approxPolyDP(best, approx, 0.02 * peri, true);
    if (approx.rows !== 4 || !cv.isContourConvex(approx)) return null;

    const points: Point[] = [];
    for (let i = 0; i < 4; i++) {
      points.push({ x: approx.data32S[i * 2] / scale, y: approx.data32S[i * 2 + 1] / scale });
    }
    const ordered = orderCorners(points);
    if (!ordered) return null;
    const [tl, tr, br, bl] = ordered;

    const dw = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
    const dh = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
    if (dw < 200 || dh < 200) return null; // degenerate detection, not worth warping

    const srcQuad = t(cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]));
    const dstQuad = t(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, dw - 1, 0, dw - 1, dh - 1, 0, dh - 1]));
    const M = t(cv.getPerspectiveTransform(srcQuad, dstQuad));

    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(dw, dh));
    return warped;
  } catch {
    return null;
  } finally {
    for (const m of mats) {
      try {
        m.delete();
      } catch {
        // best-effort cleanup
      }
    }
  }
}

function orderCorners(pts: Point[]): [Point, Point, Point, Point] | null {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));
  const tl = bySum[0];
  const br = bySum[3];
  const tr = byDiff[0];
  const bl = byDiff[3];
  if (new Set([tl, tr, br, bl]).size !== 4) return null; // corners didn't separate cleanly
  return [tl, tr, br, bl];
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function oddKernelSize(n: number): number {
  const size = Math.max(15, n);
  return size % 2 === 0 ? size + 1 : size;
}

// ---------------------------------------------------------------------------
// Dependency-free fallback pipeline (used if OpenCV.js fails to load): grayscale, shadow removal,
// auto-contrast, and sharpen, all in plain canvas/JS. No perspective correction.
// ---------------------------------------------------------------------------

function enhanceBasic(canvas: HTMLCanvasElement): { base64: string; mimeType: string } {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvasToJpeg(canvas);

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const n = width * height;

  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  const radius = Math.max(15, Math.round(Math.min(width, height) / 15));
  const background = boxBlur2D(gray, width, height, radius);
  let bgSum = 0;
  for (let i = 0; i < n; i++) bgSum += background[i];
  const meanBg = bgSum / n || 128;

  const normalized = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    normalized[i] = (gray[i] * meanBg) / Math.max(1, background[i]);
  }

  // Auto-contrast: stretch the 2nd-98th percentile of the normalized histogram to 0-255, which
  // handles washed-out or low-contrast photos far better than a fixed multiplier would.
  const sorted = Float32Array.from(normalized).sort();
  const lo = sorted[Math.floor(n * 0.02)];
  const hi = sorted[Math.floor(n * 0.98)];
  const range = Math.max(1, hi - lo);
  const contrasted = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    contrasted[i] = clamp255(((normalized[i] - lo) / range) * 255);
  }

  const sharpened = sharpenChannel(contrasted, width, height);

  for (let i = 0; i < n; i++) {
    const v = sharpened[i];
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvasToJpeg(canvas);
}

function sharpenChannel(src: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(src.length);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const amount = 0.5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ny = Math.min(height - 1, Math.max(0, y + ky));
          const nx = Math.min(width - 1, Math.max(0, x + kx));
          sum += src[ny * width + nx] * kernel[k];
          k++;
        }
      }
      const idx = y * width + x;
      out[idx] = clamp255(src[idx] * (1 - amount) + sum * amount);
    }
  }
  return out;
}

// Separable box blur via a sliding-window running sum — O(width*height) per pass regardless of
// radius, which is what makes a large-radius "background estimate" blur (needed for shadow
// removal) cheap enough to run in plain JS on a ~2000px photo.
function boxBlur2D(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  boxBlur1D(src, tmp, width, height, radius, true);
  boxBlur1D(tmp, out, width, height, radius, false);
  return out;
}

function boxBlur1D(src: Float32Array, dst: Float32Array, width: number, height: number, radius: number, horizontal: boolean): void {
  const size = radius * 2 + 1;
  if (horizontal) {
    for (let y = 0; y < height; y++) {
      const rowStart = y * width;
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += src[rowStart + clampIndex(x, width)];
      for (let x = 0; x < width; x++) {
        dst[rowStart + x] = sum / size;
        const addIdx = clampIndex(x + radius + 1, width);
        const subIdx = clampIndex(x - radius, width);
        sum += src[rowStart + addIdx] - src[rowStart + subIdx];
      }
    }
  } else {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += src[clampIndex(y, height) * width + x];
      for (let y = 0; y < height; y++) {
        dst[y * width + x] = sum / size;
        const addIdx = clampIndex(y + radius + 1, height);
        const subIdx = clampIndex(y - radius, height);
        sum += src[addIdx * width + x] - src[subIdx * width + x];
      }
    }
  }
}

function clampIndex(i: number, size: number): number {
  return Math.min(size - 1, Math.max(0, i));
}

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, v));
}
