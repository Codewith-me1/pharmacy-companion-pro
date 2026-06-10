import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediOS — Smart Pharmacy OS for India" },
      { name: "description", content: "MediOS is a smart pharmacy management system for Indian medical shops — billing, stock, expiry, doctors and GST reports in one place." },
      { property: "og:title", content: "MediOS — Smart Pharmacy OS for India" },
      { property: "og:description", content: "Smart Pharmacy OS for India — billing, stock, expiry and GST in one app." },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/mediOS.html");
  }, []);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#1A7A3C" }}>
      Loading MediOS…
    </div>
  );
}
