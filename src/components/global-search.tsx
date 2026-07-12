import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Pill, Truck, Stethoscope, Users, ScanLine, Receipt } from "lucide-react";
import { globalSearch } from "@/lib/api/search.functions";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/format";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const { data } = useQuery({
    queryKey: ["global-search", query],
    queryFn: () => globalSearch({ data: { query } }),
    enabled: query.trim().length > 0,
  });

  const hasResults =
    !!data &&
    (data.medicines.length > 0 ||
      data.suppliers.length > 0 ||
      data.doctors.length > 0 ||
      data.customers.length > 0 ||
      data.purchases.length > 0 ||
      data.sales.length > 0);

  function go(to: string, q?: string) {
    setOpen(false);
    setQuery("");
    navigate(q != null ? { to, search: { q } } : { to });
  }

  return (
    <div className="relative w-full max-w-md" ref={boxRef}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder="Search medicines, suppliers, doctors, customers, bills…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && query.trim().length > 0 && (
        <div className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {!hasResults && <p className="p-3 text-sm text-muted-foreground">No matches found.</p>}

          {data && data.medicines.length > 0 && (
            <ResultGroup icon={Pill} label="Medicines">
              {data.medicines.map((m) => (
                <ResultRow key={m.id} onClick={() => go("/app/inventory", m.name)}>
                  <span>{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.company || "—"} · {formatInr(m.mrp)}</span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}

          {data && data.suppliers.length > 0 && (
            <ResultGroup icon={Truck} label="Suppliers">
              {data.suppliers.map((s) => (
                <ResultRow key={s.id} onClick={() => go("/app/suppliers", s.name)}>
                  <span>{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.outstanding > 0 ? `Outstanding ${formatInr(s.outstanding)}` : "No dues"}
                  </span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}

          {data && data.doctors.length > 0 && (
            <ResultGroup icon={Stethoscope} label="Doctors">
              {data.doctors.map((d) => (
                <ResultRow key={d.id} onClick={() => go("/app/doctors", d.name)}>
                  <span>Dr. {d.name}</span>
                  <span className="text-xs text-muted-foreground">{d.specialization || "—"}</span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}

          {data && data.customers.length > 0 && (
            <ResultGroup icon={Users} label="Customers">
              {data.customers.map((c) => (
                <ResultRow key={c.id} onClick={() => go("/app/customers", c.name)}>
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.phone || "—"}</span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}

          {data && data.purchases.length > 0 && (
            <ResultGroup icon={ScanLine} label="Purchases">
              {data.purchases.map((p) => (
                <ResultRow key={p.id} onClick={() => go("/app/purchases")}>
                  <span>{p.invoiceNumber || p.billNumber || `Purchase #${p.id}`}</span>
                  <span className="text-xs text-muted-foreground">{formatInr(p.invoiceTotal)}</span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}

          {data && data.sales.length > 0 && (
            <ResultGroup icon={Receipt} label="Bills">
              {data.sales.map((s) => (
                <ResultRow key={s.id} onClick={() => go("/app/billing")}>
                  <span>{s.billNumber}</span>
                  <span className="text-xs text-muted-foreground">{formatInr(s.total)}</span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-0" data-testid={`search-group-${label}`}>
      <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent" onClick={onClick}>
      {children}
    </button>
  );
}
