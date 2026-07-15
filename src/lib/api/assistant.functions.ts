import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql, ilike, or, desc } from "drizzle-orm";
import { medicines, batches, suppliers, sales, saleItems, purchases, customers } from "../db/schema";
import { getServerConfig } from "../config.server";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";
import type { getDb } from "../db/client.server";

type Db = ReturnType<typeof getDb>;

async function toolExpiringMedicines(db: Db, days: number) {
  return db
    .select({
      medicineName: medicines.name,
      batchNo: batches.batchNo,
      expiryDate: batches.expiryDate,
      quantity: batches.quantity,
      supplierName: suppliers.name,
    })
    .from(batches)
    .innerJoin(medicines, sql`${medicines.id} = ${batches.medicineId}`)
    .leftJoin(suppliers, sql`${suppliers.id} = ${batches.supplierId}`)
    .where(sql`${batches.quantity} > 0 and ${batches.expiryDate}::date <= CURRENT_DATE + ${days}`)
    .orderBy(sql`${batches.expiryDate} asc`)
    .limit(50);
}

async function toolLowStockMedicines(db: Db, threshold: number) {
  return db
    .select({ medicineName: medicines.name, totalStock: sql<number>`sum(${batches.quantity})::int` })
    .from(batches)
    .innerJoin(medicines, sql`${medicines.id} = ${batches.medicineId}`)
    .groupBy(batches.medicineId, medicines.name)
    .having(sql`sum(${batches.quantity}) <= ${threshold} and sum(${batches.quantity}) > 0`)
    .limit(50);
}

async function toolOutOfStockMedicines(db: Db) {
  const rows = await db
    .select({ medicineId: medicines.id, medicineName: medicines.name, totalStock: sql<number>`coalesce(sum(${batches.quantity}), 0)::int` })
    .from(medicines)
    .leftJoin(batches, sql`${batches.medicineId} = ${medicines.id}`)
    .groupBy(medicines.id);
  return rows.filter((r) => r.totalStock === 0).slice(0, 50);
}

async function toolSearchMedicines(db: Db, query: string) {
  const term = `%${query}%`;
  return db
    .select({
      medicineName: medicines.name,
      company: medicines.company,
      category: medicines.category,
      mrp: medicines.mrp,
      gstPercent: medicines.gstPercent,
      totalStock: sql<number>`coalesce(sum(${batches.quantity}), 0)::int`,
    })
    .from(medicines)
    .leftJoin(batches, sql`${batches.medicineId} = ${medicines.id}`)
    .where(or(ilike(medicines.name, term), ilike(medicines.company, term)))
    .groupBy(medicines.id)
    .limit(25);
}

async function toolDashboardSummary(db: Db) {
  const [todaysSales] = await db
    .select({ total: sql<number>`coalesce(sum(${sales.total}), 0)`, count: sql<number>`count(*)::int` })
    .from(sales)
    .where(sql`${sales.createdAt}::date = CURRENT_DATE`);
  const [todaysPurchases] = await db
    .select({ total: sql<number>`coalesce(sum(${purchases.invoiceTotal}), 0)`, count: sql<number>`count(*)::int` })
    .from(purchases)
    .where(sql`${purchases.createdAt}::date = CURRENT_DATE`);
  const [stockValue] = await db
    .select({ value: sql<number>`coalesce(sum(${batches.quantity} * ${batches.purchasePrice}), 0)` })
    .from(batches);
  const [pendingPayments] = await db
    .select({ total: sql<number>`coalesce(sum(${sales.total}), 0)` })
    .from(sales)
    .where(sql`${sales.paymentStatus} != 'paid'`);
  const [todaysProfit] = await db
    .select({
      profit: sql<number>`coalesce(sum((${saleItems.salePrice} - ${batches.purchasePrice}) * ${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`)
    .innerJoin(batches, sql`${batches.id} = ${saleItems.batchId}`)
    .where(sql`${sales.createdAt}::date = CURRENT_DATE`);
  return {
    todaysSalesTotal: todaysSales.total,
    todaysSalesCount: todaysSales.count,
    todaysPurchasesTotal: todaysPurchases.total,
    todaysPurchasesCount: todaysPurchases.count,
    currentStockValue: stockValue.value,
    pendingPaymentsTotal: pendingPayments.total,
    todaysProfit: todaysProfit.profit,
  };
}

async function toolTopSelling(db: Db, days: number) {
  return db
    .select({ medicineName: medicines.name, totalQty: sql<number>`sum(${saleItems.quantity})::int` })
    .from(saleItems)
    .innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`)
    .innerJoin(medicines, sql`${medicines.id} = ${saleItems.medicineId}`)
    .where(sql`${sales.createdAt}::date >= CURRENT_DATE - ${days}`)
    .groupBy(saleItems.medicineId, medicines.name)
    .orderBy(sql`sum(${saleItems.quantity}) desc`)
    .limit(10);
}

async function toolSupplierInfo(db: Db, query: string) {
  const term = `%${query}%`;
  return db
    .select({
      name: suppliers.name,
      phone: suppliers.phone,
      gstNumber: suppliers.gstNumber,
      creditDays: suppliers.creditDays,
      outstanding: suppliers.outstanding,
    })
    .from(suppliers)
    .where(ilike(suppliers.name, term))
    .limit(10);
}

async function toolMedicineDetail(db: Db, name: string) {
  const [medicine] = await db
    .select()
    .from(medicines)
    .where(ilike(medicines.name, `%${name}%`))
    .limit(1);
  if (!medicine) return { found: false };
  const medicineBatches = await db
    .select({
      batchNo: batches.batchNo,
      expiryDate: batches.expiryDate,
      quantity: batches.quantity,
      mrp: batches.mrp,
      supplierName: suppliers.name,
    })
    .from(batches)
    .leftJoin(suppliers, sql`${suppliers.id} = ${batches.supplierId}`)
    .where(sql`${batches.medicineId} = ${medicine.id}`);
  return { found: true, medicine, batches: medicineBatches };
}

async function toolPendingCreditCustomers(db: Db) {
  return db
    .select({ name: customers.name, phone: customers.phone, creditBalance: customers.creditBalance })
    .from(customers)
    .where(sql`${customers.creditBalance} > 0`)
    .orderBy(desc(customers.creditBalance))
    .limit(25);
}

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_expiring_medicines",
      description: "List medicine batches expiring within N days, soonest first. Use for any expiry-related question.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Look-ahead window in days, default 30" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_low_stock_medicines",
      description: "List medicines whose total stock is at or below a threshold (but not zero).",
      parameters: {
        type: "object",
        properties: { threshold: { type: "number", description: "Stock threshold, default 10" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_out_of_stock_medicines",
      description: "List medicines with zero stock across all batches.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_medicines",
      description: "Search the medicine master by name or company, returning price, GST, category and current stock.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search text" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_medicine_detail",
      description: "Get full detail for one specific medicine by name, including every batch and which supplier it came from.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Medicine name" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_dashboard_summary",
      description:
        "Get today's sales total/count, today's purchases, current stock value, pending payments, and today's profit — the same numbers shown on the Dashboard.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_top_selling",
      description: "Top selling medicines by quantity over the last N days.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Look-back window in days, default 30" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_supplier_info",
      description: "Search suppliers by name, returning phone, GST number, credit days and outstanding balance owed to them.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Supplier name search text" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_pending_credit_customers",
      description: "List customers who currently owe money (credit balance > 0), highest balance first.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// Each tool call gets its own short-lived tenant-scoped transaction rather than sharing one
// across the whole multi-turn conversation loop below — the loop can make several sequential
// OpenAI network round-trips (each a few seconds), and holding a single pooled DB connection
// open for all of them would starve the pool's small connection budget under concurrent chat
// usage. Opening/closing per tool call keeps each checkout brief, matching how every other
// server function in this app uses the pool.
async function runTool(userId: number, name: string, args: Record<string, unknown>) {
  return withTenant(userId, async (db) => {
    switch (name) {
      case "get_expiring_medicines":
        return toolExpiringMedicines(db, typeof args.days === "number" ? args.days : 30);
      case "get_low_stock_medicines":
        return toolLowStockMedicines(db, typeof args.threshold === "number" ? args.threshold : 10);
      case "get_out_of_stock_medicines":
        return toolOutOfStockMedicines(db);
      case "search_medicines":
        return toolSearchMedicines(db, String(args.query ?? ""));
      case "get_medicine_detail":
        return toolMedicineDetail(db, String(args.name ?? ""));
      case "get_dashboard_summary":
        return toolDashboardSummary(db);
      case "get_top_selling":
        return toolTopSelling(db, typeof args.days === "number" ? args.days : 30);
      case "get_supplier_info":
        return toolSupplierInfo(db, String(args.query ?? ""));
      case "get_pending_credit_customers":
        return toolPendingCreditCustomers(db);
      default:
        return { error: `Unknown tool ${name}` };
    }
  });
}

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const chatWithAssistant = createServerFn({ method: "POST" })
  .inputValidator(z.object({ messages: z.array(chatMessageSchema).min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const config = getServerConfig();
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured. Add it to your .env file to enable the AI Assistant.");
    }

    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const today = new Date().toISOString().slice(0, 10);
    const conversation: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      tool_calls?: unknown;
      tool_call_id?: string;
    }> = [
      {
        role: "system",
        content: [
          "You are MediOS's AI Assistant, built into a pharmacy management dashboard.",
          `Today's date is ${today}.`,
          "You have live read access to the pharmacy's real database via tools — always call the right tool to look up real numbers before answering questions about stock, expiry, sales, profit, suppliers, or customers. Never guess or make up numbers.",
          "Answer concisely, in plain language a pharmacist would use. Use rupee amounts formatted like ₹1,234. When listing multiple items, use a short bullet list.",
          "If a tool returns an empty result, say so plainly (e.g. 'Nothing is expiring in the next 30 days.') rather than inventing data.",
        ].join(" "),
      },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    let finalReply = "Sorry, I couldn't come up with an answer.";

    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: conversation as never,
        tools: TOOLS,
      });

      const message = response.choices[0]?.message;
      if (!message) break;

      if (message.tool_calls && message.tool_calls.length > 0) {
        conversation.push({ role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls });
        for (const toolCall of message.tool_calls) {
          if (toolCall.type !== "function") continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await runTool(userId, toolCall.function.name, args);
          conversation.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      finalReply = message.content ?? finalReply;
      break;
    }

    return { reply: finalReply };
  });
