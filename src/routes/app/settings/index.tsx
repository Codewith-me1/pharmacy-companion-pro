import { createFileRoute } from "@tanstack/react-router";
import {
  Store,
  Building2,
  Barcode,
  Bell,
  CloudUpload,
  BarChart3,
  Users,
  Bot,
  ScanBarcode,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/settings/")({
  component: SettingsPage,
});

const UPCOMING_MODULES = [
  {
    icon: Building2,
    title: "Multi-Shop",
    description: "Combine dashboards across multiple pharmacy locations under one owner login.",
  },
  {
    icon: Barcode,
    title: "Barcode Generation & Printing",
    description: "Generate and print medicine, batch and shelf barcodes for a label printer.",
  },
  {
    icon: Bell,
    title: "SMS / WhatsApp Notifications",
    description: "Send low-stock, expiry and payment-due alerts via SMS or WhatsApp Business API.",
  },
  {
    icon: CloudUpload,
    title: "Cloud Backup",
    description: "Automatic daily backup to Google Drive or OneDrive, in addition to local backup.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Peak hours, seasonal trends, doctor trends and margin analysis.",
  },
  {
    icon: Users,
    title: "User Roles & Permissions",
    description: "Owner, Manager, Cashier, Pharmacist and Accountant roles with per-module permissions.",
  },
  {
    icon: Bot,
    title: "AI Assistant",
    description: 'Ask natural-language questions like "How many Crocin are expiring?" or "Profit this month?"',
  },
  {
    icon: ScanBarcode,
    title: "Handwritten Prescription OCR",
    description: "Extract medicines from handwritten doctor prescriptions, not just printed invoices.",
  },
];

function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Business configuration and roadmap.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4" /> Business Details
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Store profile, GST settings, thermal/A4 printer configuration and invoice theming will live here.
          Configure your OpenAI API key for AI invoice extraction via the <code>.env</code> file
          (<code>OPENAI_API_KEY</code>).
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Coming Soon</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {UPCOMING_MODULES.map((m) => (
            <Card key={m.title} className="opacity-90">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <m.icon className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="secondary">Planned</Badge>
                </div>
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
