import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { describeDatabaseError } from "./lib/db/describe-db-error";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Runs around every server function. Drizzle reports a dead host, a rejected password and a
// missing table with the identical "Failed query: select ..." message, and drops the real cause
// on the way to the browser — so a misconfigured deployment looks exactly like an application
// bug. This replaces that with a message naming the category and the fix; anything that is not a
// recognised database failure passes through untouched.
const databaseErrorMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    const described = describeDatabaseError(error);
    if (described !== error) console.error("[DB ERROR]", error);
    throw described;
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [databaseErrorMiddleware],
}));
