// Loads OpenCV.js (used for document-edge detection + perspective correction in
// enhance-image.ts) as a plain <script> tag from a vendored static asset, rather than importing
// it as a JS module. The emscripten glue code in opencv.js has top-level `require("fs")` /
// `require("crypto")` calls (dead in the browser, guarded behind a Node-only check) that
// Vite/Rollup try to statically resolve when bundling and fail on — loading it as an unbundled
// static asset sidesteps that entirely. The file at /vendor/opencv.js is an unmodified copy of
// https://docs.opencv.org/5.0.0/opencv.js (vendored via the @techstark/opencv-js npm package,
// which is not a runtime dependency of this app — it was only used to fetch this one file).
declare global {
  interface Window {
    cv?: unknown;
  }
}

let cvPromise: Promise<unknown> | null = null;

function loadOpenCv(): Promise<unknown> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV.js can only load in a browser"));
  }
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-opencv-loader="true"]');
    const script = existing ?? document.createElement("script");
    script.src = "/vendor/opencv.js";
    script.async = true;
    script.dataset.opencvLoader = "true";
    script.addEventListener("load", () => {
      const cvOrPromise = window.cv;
      if (!cvOrPromise) {
        reject(new Error("opencv.js loaded but did not attach window.cv"));
        return;
      }
      Promise.resolve(cvOrPromise).then(resolve, reject);
    });
    script.addEventListener("error", () => reject(new Error("Failed to load /vendor/opencv.js")));
    if (!existing) document.head.appendChild(script);
  }).catch((err) => {
    cvPromise = null;
    throw err;
  });

  return cvPromise;
}

// Never lets a slow/unavailable OpenCV.js block invoice processing — callers get `null` on
// timeout or failure and should fall back to a non-CV enhancement pipeline.
export async function loadOpenCvWithTimeout(timeoutMs = 8000): Promise<any | null> {
  try {
    const result = await Promise.race([
      loadOpenCv(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return result;
  } catch {
    return null;
  }
}
