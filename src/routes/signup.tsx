import { useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pill } from "lucide-react";
import { getCurrentUser, signup } from "@/lib/api/auth.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (user) throw redirect({ to: "/app/dashboard" });
  },
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [mobile, setMobile] = useState("");
  const [dlNo, setDlNo] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signupMutation = useMutation({
    mutationFn: () =>
      signup({
        data: {
          name,
          pharmacyName,
          mobile,
          dlNo: dlNo || undefined,
          gstNumber: gstNumber || undefined,
          address: address || undefined,
          email,
          password,
        },
      }),
    onSuccess: () => {
      // Same as login — a brand new account must never see another session's cached data.
      queryClient.clear();
      navigate({ to: "/app/dashboard" });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to sign up."),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link to="/" className="flex items-center justify-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Pill className="h-4 w-4" />
          </span>
          MediOS
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Create your pharmacy account</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                signupMutation.mutate();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-foreground">Pharmacy Details</p>
                <p className="text-xs text-muted-foreground">
                  Printed on every bill — you can change these anytime in Settings.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pharmacyName">Pharmacy Name</Label>
                <Input id="pharmacyName" value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    autoComplete="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dlNo">D.L. No (optional)</Label>
                  <Input id="dlNo" value={dlNo} onChange={(e) => setDlNo(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gstNumber">GST Number (optional)</Label>
                <Input id="gstNumber" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="address">Address (optional)</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              <Separator />

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-foreground">Your Details</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Your Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={signupMutation.isPending}>
                {signupMutation.isPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
