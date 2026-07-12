import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileImage, FileText, Loader2, Mail, RefreshCw } from "lucide-react";
import { listSupplierInvoiceEmails, fetchEmailAttachment } from "@/lib/api/email-invoices.functions";
import { pdfToImageBlob, base64ToBlob } from "@/lib/pdf-to-image";
import { fileToBase64 } from "@/lib/file-to-base64";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function FetchEmailDialog({
  open,
  onOpenChange,
  onSelectImage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (base64: string, mimeType: string) => void;
}) {
  const [fetchingKey, setFetchingKey] = useState<string | null>(null);
  const [convertingKey, setConvertingKey] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["supplier-invoice-emails"],
    queryFn: () => listSupplierInvoiceEmails({ data: { days: 30 } }),
    enabled: open,
    retry: false,
  });

  async function handleUseAttachment(uid: number, part: string, filename: string) {
    const key = `${uid}-${part}`;
    setFetchingKey(key);
    try {
      const result = await fetchEmailAttachment({ data: { uid, part } });
      if (result.mimeType === "application/pdf") {
        setFetchingKey(null);
        setConvertingKey(key);
        const pdfBlob = base64ToBlob(result.base64, result.mimeType);
        const imageBlob = await pdfToImageBlob(pdfBlob);
        const { base64, mimeType } = await fileToBase64(imageBlob);
        onSelectImage(base64, mimeType);
      } else {
        onSelectImage(result.base64, result.mimeType);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to use ${filename}.`);
    } finally {
      setFetchingKey(null);
      setConvertingKey(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Fetch Supplier Invoice from Email
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Scanning inbox for the last 30 days for emails with attachments.</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" /> Connecting to your inbox…
          </div>
        )}

        {isError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not connect to email."} Check your Email Integration
            settings.
          </div>
        )}

        {!isLoading && !isError && (data?.length ?? 0) === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No emails with invoice attachments found in the last 30 days.
          </p>
        )}

        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {data?.map((mail) => (
            <div key={mail.uid} className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{mail.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {mail.from} · {mail.date ? new Date(mail.date).toLocaleDateString("en-IN") : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {mail.attachments.map((att) => {
                  const isImage = IMAGE_TYPES.has(att.type);
                  const isPdf = att.type === "application/pdf";
                  const key = `${mail.uid}-${att.part}`;
                  const busy = fetchingKey === key || convertingKey === key;
                  return (
                    <Button
                      key={att.part}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => handleUseAttachment(mail.uid, att.part, att.filename)}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isImage ? (
                        <FileImage className="h-3.5 w-3.5" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      {att.filename}
                      {convertingKey === key && <span className="text-xs text-muted-foreground">Converting…</span>}
                      {isPdf && convertingKey !== key && <Badge variant="secondary" className="ml-1 text-[10px]">PDF</Badge>}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
