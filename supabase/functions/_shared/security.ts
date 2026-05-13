// Helpers compartilhados: CORS allowlist + auditoria.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://maridopraque.lovable.app",
  "https://id-preview--ec1fc676-bf03-4dd3-84db-f84467056948.lovable.app",
];

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  // previews do Lovable (sandbox / preview / id-preview)
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  // localhost só em dev
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
];

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = isOriginAllowed(origin) ? origin! : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function preflight(req: Request): Response | null {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(origin)) {
      return new Response("Origin not allowed", { status: 403 });
    }
    return new Response(null, { headers: corsHeadersFor(origin) });
  }
  return null;
}

export function ensureOrigin(req: Request): Response | null {
  const origin = req.headers.get("Origin");
  // Permitir requests sem Origin (server-to-server, curl) — não há risco CSRF nesse caso
  if (origin && !isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: "Origin não permitida" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(req.headers.get("Origin")),
      "Content-Type": "application/json",
    },
  });
}

export async function logAudit(params: {
  actor_user_id: string;
  action: string;
  target_user_id?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    // Sanitizar: nunca persistir senha/token
    const safeDetails = sanitizeDetails(params.details ?? {});
    await admin.from("admin_audit_log").insert({
      actor_user_id: params.actor_user_id,
      action: params.action,
      target_user_id: params.target_user_id ?? null,
      details: safeDetails,
    });
  } catch (e) {
    console.error("logAudit failed:", (e as Error)?.message);
  }
}

function sanitizeDetails(d: Record<string, unknown>): Record<string, unknown> {
  const FORBIDDEN = [
    "password", "senha", "token", "secret", "service_role",
    "apikey", "api_key", "authorization", "bearer",
    "access_token", "refresh_token",
  ];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (FORBIDDEN.some((f) => k.toLowerCase().includes(f))) continue;
    out[k] = v;
  }
  return out;
}
