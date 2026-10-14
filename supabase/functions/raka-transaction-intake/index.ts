
import postgres from "npm:postgres@3.4.3";

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
const intakeSecret = Deno.env.get("RAKA_INTAKE_SECRET") ?? "";

const sql = databaseUrl
  ? postgres(databaseUrl, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
      idle_timeout: 5,
    })
  : null;

const allowedOrigins = (
  Deno.env.get("RAKA_INTAKE_ALLOWED_ORIGINS") ?? ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const transactionTypes = new Set([
  "purchase",
  "processing",
  "payment",
  "sale",
  "expense",
  "receipt",
  "cheque",
]);

function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  let difference = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);

  for (let i = 0; i < length; i++) {
    difference |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  }

  return difference === 0;
}

function response(
  body: Record<string, unknown>,
  status = 200,
  origin?: string,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin") ?? undefined;

  if (origin) {
    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      return response({ error: "Invalid origin" }, 403);
    }

    const localHost = [
      "localhost",
      "127.0.0.1",
      "[::1]",
    ].includes(parsedOrigin.hostname);

    if (
      (parsedOrigin.protocol !== "https:" &&
        !(localHost && parsedOrigin.protocol === "http:")) ||
      !allowedOrigins.includes(origin)
    ) {
      return response({ error: "Origin not allowed" }, 403);
    }
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: origin && allowedOrigins.includes(origin)
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
            "Vary": "Origin",
          }
        : {},
    });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405, origin);
  }

  if (!intakeSecret || !safeEqual(
    req.headers.get("x-raka-secret") ?? "",
    intakeSecret,
  )) {
    return response({ error: "Unauthorized" }, 401, origin);
  }

  if (!sql) {
    return response({ error: "Database configuration unavailable" }, 500, origin);
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return response({ error: "Invalid JSON" }, 400, origin);
  }

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return response({ error: "Expected a JSON object" }, 400, origin);
  }

  const input = body as Record<string, unknown>;
  const allowedKeys = new Set([
    "idempotency_key",
    "transaction_type",
    "transaction_data",
  ]);

  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return response({ error: "Unexpected top-level field" }, 400, origin);
  }

  const key = input.idempotency_key;
  const type = input.transaction_type;
  const data = input.transaction_data;

  if (
    typeof key !== "string" ||
    key.length < 1 ||
    key.length > 200 ||
    key.trim() !== key
  ) {
    return response({ error: "Invalid idempotency_key" }, 400, origin);
  }

  if (typeof type !== "string" || !transactionTypes.has(type)) {
    return response({ error: "Invalid transaction_type" }, 400, origin);
  }

  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return response({ error: "transaction_data must be an object" }, 400, origin);
  }

  try {
    const dataJson = JSON.stringify(data);

    const inserted = await sql`
      INSERT INTO public.raka_transaction_queue (
        idempotency_key,
        transaction_type,
        transaction_data,
        status
      )
      VALUES (
        ${key},
        ${type},
        ${dataJson}::jsonb,
        'received'
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, status, transaction_type, created_at
    `;

    if (inserted.length > 0) {
      const record = inserted[0];

      return response({
        id: record.id,
        status: record.status,
        transaction_type: record.transaction_type,
        created_at: record.created_at,
        idempotent_replay: false,
      }, 201, origin);
    }

    const existing = await sql`
      SELECT
        id,
        status,
        transaction_type,
        created_at,
        (
          transaction_type = ${type}
          AND transaction_data = ${dataJson}::jsonb
        ) AS same_content
      FROM public.raka_transaction_queue
      WHERE idempotency_key = ${key}
      LIMIT 1
    `;

    if (existing.length === 0) {
      return response({ error: "Please retry the request" }, 503, origin);
    }

    const record = existing[0];

    if (!record.same_content) {
      return response({
        error: "Idempotency key already used for different content",
      }, 409, origin);
    }

    return response({
      id: record.id,
      status: record.status,
      transaction_type: record.transaction_type,
      created_at: record.created_at,
      idempotent_replay: true,
    }, 200, origin);
  } catch {
    return response({ error: "Transaction could not be queued" }, 500, origin);
  }
});
