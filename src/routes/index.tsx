import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediOS — Smart Pharmacy OS for India" },
      { name: "description", content: "MediOS is a smart pharmacy management system for Indian medical shops — billing, stock, expiry, doctors and GST reports in one place." },
      { property: "og:title", content: "MediOS — Smart Pharmacy OS for India" },
      { property: "og:description", content: "Smart Pharmacy OS for India — billing, stock, expiry and GST in one app." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/app/dashboard" });
  },
});
