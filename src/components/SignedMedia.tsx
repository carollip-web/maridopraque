import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "orcamento-fotos";
const MARKER = `/${BUCKET}/`;
const cache = new Map<string, { url: string; exp: number }>();
const TTL = 60 * 50; // 50 min — token valid 60 min

export function extractOrcamentoFotoKey(urlOrKey: string): string {
  if (!urlOrKey) return urlOrKey;
  const idx = urlOrKey.indexOf(MARKER);
  return idx >= 0 ? urlOrKey.slice(idx + MARKER.length) : urlOrKey;
}

export async function getOrcamentoFotoSignedUrl(urlOrKey: string): Promise<string> {
  if (!urlOrKey) return urlOrKey;
  const key = extractOrcamentoFotoKey(urlOrKey);
  const now = Date.now() / 1000;
  const cached = cache.get(key);
  if (cached && cached.exp > now) return cached.url;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, 60 * 60);
  if (error || !data?.signedUrl) return urlOrKey;
  cache.set(key, { url: data.signedUrl, exp: now + TTL });
  return data.signedUrl;
}

interface SignedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}
export function SignedImage({ src, ...rest }: SignedImageProps) {
  const [resolved, setResolved] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getOrcamentoFotoSignedUrl(src).then((u) => {
      if (alive) setResolved(u);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return <img {...rest} src={resolved} />;
}

interface SignedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}
export function SignedVideo({ src, ...rest }: SignedVideoProps) {
  const [resolved, setResolved] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getOrcamentoFotoSignedUrl(src).then((u) => {
      if (alive) setResolved(u);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return <video {...rest} src={resolved} />;
}

export function useSignedOrcamentoFotoUrl(src: string | null | undefined) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!src) {
      setUrl(undefined);
      return;
    }
    let alive = true;
    getOrcamentoFotoSignedUrl(src).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return url;
}
