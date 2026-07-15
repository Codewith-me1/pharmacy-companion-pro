import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  Mail,
  CheckCircle2,
  XCircle,
  Receipt,
  Eye,
  Plus,
  Trash2,
} from "lucide-react";
import { getBusinessSettings, saveBusinessSettings } from "@/lib/api/business-settings.functions";
import { getEmailSettings, saveEmailSettings, testEmailConnection } from "@/lib/api/email-settings.functions";
import { getBillSettings, saveBillSettings } from "@/lib/api/bill-settings.functions";
import { printBill, DEFAULT_BILL_CUSTOMIZATION } from "@/lib/print-bill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
    icon: ScanBarcode,
    title: "Handwritten Prescription OCR",
    description: "Extract medicines from handwritten doctor prescriptions, not just printed invoices.",
  },
];

const emptyBusiness = { firmName: "", dlNo: "", gstNumber: "", mobile: "", address: "" };
const emptyEmail = { email: "", imapHost: "", imapPort: 993, useTls: true, enabled: false, password: "" };

function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyBusiness);
  const { data } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });

  useEffect(() => {
    if (data) {
      setForm({
        firmName: data.firmName ?? "",
        dlNo: data.dlNo ?? "",
        gstNumber: data.gstNumber ?? "",
        mobile: data.mobile ?? "",
        address: data.address ?? "",
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => saveBusinessSettings({ data: form }),
    onSuccess: () => {
      toast.success("Business details saved.");
      queryClient.invalidateQueries({ queryKey: ["business-settings"] });
    },
  });

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
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Used on printed documents — supplier return/expiry notes, bills. Configure your OpenAI API key for AI
            invoice extraction via the <code>.env</code> file (<code>OPENAI_API_KEY</code>).
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Firm Name">
              <Input value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} />
            </Field>
            <Field label="D.L. No">
              <Input value={form.dlNo} onChange={(e) => setForm({ ...form, dlNo: e.target.value })} />
            </Field>
            <Field label="GST Number">
              <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            </Field>
            <Field label="Mobile No">
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Save Business Details
            </Button>
          </div>
        </CardContent>
      </Card>

      <AiAssistantCard />

      <EmailIntegrationCard />

      <BillCustomizationCard />

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

function AiAssistantCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => saveBusinessSettings({ data: { aiAssistantEnabled: enabled } }),
    onSuccess: (_result, enabled) => {
      toast.success(enabled ? "AI Assistant enabled." : "AI Assistant disabled.");
      queryClient.invalidateQueries({ queryKey: ["business-settings"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4" /> AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          A chat assistant on the Dashboard that can answer questions using your real data — expiring stock, low
          stock, available medicines, today's sales and profit. Uses your OpenAI key from <code>.env</code>.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={data?.aiAssistantEnabled ?? true}
            onCheckedChange={(v) => toggleMutation.mutate(v)}
            disabled={toggleMutation.isPending}
          />
          Show AI Assistant on Dashboard
        </label>
      </CardContent>
    </Card>
  );
}

function EmailIntegrationCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyEmail);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const { data } = useQuery({ queryKey: ["email-settings"], queryFn: () => getEmailSettings() });

  useEffect(() => {
    if (data) {
      setForm({
        email: data.email ?? "",
        imapHost: data.imapHost ?? "",
        imapPort: data.imapPort ?? 993,
        useTls: data.useTls,
        enabled: data.enabled,
        password: "",
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => saveEmailSettings({ data: form }),
    onSuccess: () => {
      toast.success("Email integration saved.");
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
      setForm((f) => ({ ...f, password: "" }));
    },
  });

  const testMutation = useMutation({
    mutationFn: () =>
      testEmailConnection({
        data: { email: form.email, imapHost: form.imapHost, imapPort: form.imapPort, useTls: form.useTls, password: form.password },
      }),
    onSuccess: (result) => {
      setTestResult(result);
      if (result.ok) toast.success("Connected successfully.");
      else toast.error(result.error || "Connection failed.");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4" /> Email Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Connect the owner's mailbox via IMAP so supplier invoices sent as email attachments can be pulled
          straight into Purchase Entry. For Gmail, enable 2-Step Verification and create an{" "}
          <strong>App Password</strong> — your regular password won't work. Credentials are stored locally in this
          app's database only.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Email Address">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@gmail.com" />
          </Field>
          <Field label="IMAP Host">
            <Input value={form.imapHost} onChange={(e) => setForm({ ...form, imapHost: e.target.value })} placeholder="imap.gmail.com" />
          </Field>
          <Field label="IMAP Port">
            <Input
              type="number"
              value={form.imapPort}
              onChange={(e) => setForm({ ...form, imapPort: Number(e.target.value) })}
            />
          </Field>
          <Field label={data?.hasPassword ? "App Password (leave blank to keep current)" : "App Password"}>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={data?.hasPassword ? "•••••••• (unchanged)" : ""}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.useTls} onCheckedChange={(v) => setForm({ ...form, useTls: v })} />
            Use TLS/SSL
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            Enable email fetching
          </label>
          {testResult && (
            <span className={`flex items-center gap-1 text-xs ${testResult.ok ? "text-primary" : "text-destructive"}`}>
              {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {testResult.ok ? "Connection verified" : testResult.error}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !form.email || !form.imapHost || !form.password}
          >
            Test Connection
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.email || !form.imapHost}>
            Save Email Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const emptyBillSettings = { ...DEFAULT_BILL_CUSTOMIZATION };

function BillCustomizationCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyBillSettings);
  const { data } = useQuery({ queryKey: ["bill-settings"], queryFn: () => getBillSettings() });
  const { data: business } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => saveBillSettings({ data: form }),
    onSuccess: () => {
      toast.success("Bill customization saved.");
      queryClient.invalidateQueries({ queryKey: ["bill-settings"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save bill customization."),
  });

  function toggle(key: keyof typeof form) {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  }

  function updateField(i: number, patch: Partial<{ label: string; value: string }>) {
    setForm((f) => ({
      ...f,
      customFields: f.customFields.map((field, idx) => (idx === i ? { ...field, ...patch } : field)),
    }));
  }

  function addField() {
    setForm((f) => ({ ...f, customFields: [...f.customFields, { label: "", value: "" }] }));
  }

  function removeField(i: number) {
    setForm((f) => ({ ...f, customFields: f.customFields.filter((_, idx) => idx !== i) }));
  }

  function previewBill() {
    printBill({
      billNumber: "PREVIEW-00001",
      billType: "retail",
      createdAt: new Date().toLocaleDateString("en-IN"),
      firmName: business?.firmName || "Your Pharmacy Name",
      dlNo: business?.dlNo,
      gstNumber: business?.gstNumber,
      phone: business?.mobile,
      address: business?.address,
      customerName: "Sample Customer",
      customerAddress: "123 Sample Street, Sample City",
      doctorName: "Sharma",
      items: [
        { medicineName: "Paracetamol 650", pack: "15s", batchNo: "A2312", expiryDate: "2027-01-01", quantity: 2, rate: 34, mrp: 36 },
        { medicineName: "Azithromycin 500", pack: "3s", batchNo: "AZ1187", expiryDate: "2026-12-01", quantity: 1, rate: 112, mrp: 120 },
      ],
      discount: 5,
      settings: form,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Receipt className="h-4 w-4" /> Bill Customization
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Control exactly what appears on printed bills — hide columns you don't use, replace the terms &amp;
          conditions with your own, and add any extra fields your shop needs. Use Preview to see changes before
          saving.
        </p>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Show on Bill</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.showDoctor} onCheckedChange={() => toggle("showDoctor")} /> Doctor name
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.showCustomerAddress} onCheckedChange={() => toggle("showCustomerAddress")} />
              Customer address
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.showBatchNo} onCheckedChange={() => toggle("showBatchNo")} /> Batch number
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.showExpiry} onCheckedChange={() => toggle("showExpiry")} /> Expiry date
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.showMrp} onCheckedChange={() => toggle("showMrp")} /> MRP column
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.showDiscountPercent} onCheckedChange={() => toggle("showDiscountPercent")} />
              Discount % column
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Footer Note (optional)">
            <Textarea
              rows={2}
              placeholder="e.g. Thank you for shopping with us!"
              value={form.footerNote}
              onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
            />
          </Field>
          <Field label="Terms & Conditions (one per line)">
            <Textarea
              rows={4}
              value={form.termsText}
              onChange={(e) => setForm({ ...form, termsText: e.target.value })}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground">Custom Fields</h3>
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              <Plus className="h-3.5 w-3.5" /> Add Field
            </Button>
          </div>
          {form.customFields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No custom fields yet — add anything you want printed near the footer (e.g. "Return Policy", "Website").
            </p>
          )}
          <div className="flex flex-col gap-2">
            {form.customFields.map((field, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Label"
                  value={field.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  className="w-40"
                />
                <Input
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) => updateField(i, { value: e.target.value })}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeField(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={previewBill}>
            <Eye className="h-4 w-4" /> Preview Bill
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save Bill Customization
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
