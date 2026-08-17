import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

// Startup config warnings. These run once per worker init.
if (typeof process !== "undefined" && process.env) {
  if (!process.env.SNS_WEBHOOK_SECRET) {
    console.warn(
      "[startup] SNS_WEBHOOK_SECRET is NOT set. The SES → SNS webhook will accept unsigned " +
        "events (signature is still verified, but the shared-secret gate is disabled). " +
        "Set SNS_WEBHOOK_SECRET in .env to harden /api/public/ses/sns.",
    );
  }
  if (!process.env.QUEUE_PROCESS_SECRET) {
    console.warn(
      "[startup] QUEUE_PROCESS_SECRET is NOT set. /api/queue/process will require an admin " +
        "bearer token; the Coolify scheduler cannot call it. Set QUEUE_PROCESS_SECRET in .env.",
    );
  }
  if (!process.env.SES_CONFIGURATION_SET) {
    console.warn(
      "[startup] SES_CONFIGURATION_SET is NOT set. Sends will be refused — bounce/complaint " +
        "tracking requires the SES configuration set wired to the SNS topic.",
    );
  }
}

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

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
