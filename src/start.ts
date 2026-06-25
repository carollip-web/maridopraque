import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const lovableBypass = ({ request, next }: any) => {
  try {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/lovable/")) return next();
  } catch {}
  return next();
};

export const startInstance = createStart(() => ({
  requestMiddleware: [lovableBypass],
  functionMiddleware: [attachSupabaseAuth],
}));
