/**
 * Webhook Dispatcher — fires HTTP POST to registered webhook URLs when events occur.
 */

let adminGetAll = null;
let adminRun = null;
let adminSave = null;

export function initWebhookDispatcher(deps) {
  adminGetAll = deps.adminGetAll;
  adminRun = deps.adminRun;
  adminSave = deps.adminSave;
}

export function fireWebhookEvent(event, data = {}) {
  if (!adminGetAll) return;

  try {
    const webhooks = adminGetAll(
      "SELECT id, url, secret, events FROM webhooks WHERE enabled = 1",
    );

    for (const webhook of webhooks) {
      let events = [];
      try { events = JSON.parse(webhook.events || "[]"); } catch { events = []; }
      if (!events.includes(event)) continue;

      const payload = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data,
      });

      const headers = {
        "Content-Type": "application/json",
        "X-BirdX-Event": event,
      };
      if (webhook.secret) {
        headers["X-BirdX-Secret"] = webhook.secret;
      }

      // Fire and forget — don't block the main thread
      fetch(webhook.url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      })
        .then((res) => {
          try {
            adminRun?.(
              "UPDATE webhooks SET last_triggered_at = datetime('now'), last_status = ?, failure_count = 0 WHERE id = ?",
              [res.status, webhook.id],
            );
            adminSave?.();
          } catch { /* ignore */ }
        })
        .catch(() => {
          try {
            adminRun?.(
              "UPDATE webhooks SET last_triggered_at = datetime('now'), last_status = 0, failure_count = failure_count + 1 WHERE id = ?",
              [webhook.id],
            );
            adminSave?.();
          } catch { /* ignore */ }
        });
    }
  } catch {
    // Don't let webhook errors affect the main application
  }
}
