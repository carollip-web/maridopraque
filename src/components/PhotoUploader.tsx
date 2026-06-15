import { useRef, useState } from "react";
import { ImagePlus, X, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SignedImage, SignedVideo } from "@/components/SignedMedia";

interface Props {
  userId: string;
  /** Subpasta dentro de {userId}/. Ex.: "problema/abc-orcamento-id" */
  pathPrefix: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
  /** Aceita também vídeos (mp4/mov/webm). Default: false */
  acceptVideo?: boolean;
}

const BUCKET = "orcamento-fotos";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const isVideoUrl = (url: string) =>
  /\.(mp4|mov|webm|m4v|qt)(\?|$)/i.test(url);

export function PhotoUploader({
  userId,
  pathPrefix,
  value,
  onChange,
  max = 5,
  label = "Adicionar foto",
  acceptVideo = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - value.length;
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) {
      toast.error(`Limite de ${max} arquivos`);
      return;
    }
    setBusy(true);
    const newUrls: string[] = [];
    for (const file of list) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !(acceptVideo && isVideo)) {
        toast.error(
          `${file.name}: tipo não suportado${acceptVideo ? " (use imagem ou vídeo)" : ""}`,
        );
        continue;
      }
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > limit) {
        toast.error(
          `${file.name}: máximo ${isVideo ? "25MB (vídeo)" : "5MB (imagem)"}`,
        );
        continue;
      }
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const key = `${userId}/${pathPrefix}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
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

  const accept = acceptVideo ? "image/*,video/*" : "image/*";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {value.map((url) => {
          const video = isVideoUrl(url);
          return (
            <div key={url} className="relative group">
              {video ? (
                <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-border bg-slate-900">
                  <SignedVideo
                    src={url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <div className="h-7 w-7 rounded-full bg-white/90 grid place-items-center">
                      <Play className="h-3.5 w-3.5 text-slate-900 fill-slate-900" />
                    </div>
                  </div>
                </div>
              ) : (
                <SignedImage
                  src={url}
                  alt=""
                  className="h-20 w-20 rounded-xl object-cover border border-border"
                />
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border border-border shadow grid place-items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"
                aria-label="Remover arquivo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
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
        accept={accept}
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        {value.length}/{max} · {label} ·{" "}
        {acceptVideo ? "imagens até 5MB · vídeos até 25MB" : "até 5MB cada"}
      </p>
    </div>
  );
}
