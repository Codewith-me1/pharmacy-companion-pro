import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

export function WebcamCapture({
  onCapture,
  onClose,
}: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Could not access webcam. Check browser permissions."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-6">
      <div className="flex w-full max-w-xl items-center justify-between text-white">
        <span className="font-medium">Webcam Capture</span>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : (
        <video ref={videoRef} autoPlay playsInline className="max-h-[70vh] w-full max-w-xl rounded-lg bg-black" />
      )}
      <Button onClick={capture} disabled={!!error} size="lg" className="gap-2">
        <Camera className="h-4 w-4" /> Capture Invoice
      </Button>
    </div>
  );
}
