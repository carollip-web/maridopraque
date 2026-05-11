import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
  /** Subpasta dentro de {userId}/. Ex.: "problema/abc-orcamento-id" */
  pathPrefix: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
}

const BUCKET = "orcamento-fotos";
const MAX_BYTES = 5 * 1024 * 1024;

export function PhotoUploader({
  userId,
  pathPrefix,
  value,
  onChange,
  max = 5,
  label = "Adicionar foto",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - value.length;
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) {
      toast.error(`Limite de ${max} fotos`);
      return;
    }
    setBusy(true);
    const newUrls: string[] = [];
    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: não é imagem`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: máximo 5MB`);
        continue;
      }
      const ext = file.name.split(".").pop() || "jpg";
      const key = `${userId}/${pathPrefix}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
      newUrls.push(data.publicUrl);
    }
    onChange([...value, ...newUrls]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (url: string) => {
    // Tenta remover do storage (best-effort)
    try {
      const marker = `/${BUCKET}/`;
      const idx = url.indexOf(marker);
      if (idx >= 0) {
        const key = url.slice(idx + marker.length);
        await supabase.storage.from(BUCKET).remove([key]);
      }
    } catch {}
    onChange(value.filter((u) => u !== url));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div key={url} className="relative group">
            <img
              src={url}
              alt=""
              className="h-20 w-20 rounded-xl object-cover border border-border"
            />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border border-border shadow grid place-items-center opacity-0 group-hover:opacity-100 transition"
              aria-label="Remover foto"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-20 w-20 rounded-xl border-2 border-dashed border-border hover:border-brand grid place-items-center text-muted-foreground hover:text-brand transition disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        {value.length}/{max} · {label} · até 5MB cada
      </p>
    </div>
  );
}
