import { useRef } from "react";
import { ImagePlus, X, Play } from "lucide-react";
import { toast } from "sonner";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export interface GuestFile {
  file: File;
  previewUrl: string;
}

interface Props {
  files: GuestFile[];
  setFiles: (next: GuestFile[]) => void;
  max?: number;
}

export function GuestUploader({ files, setFiles, max = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const remaining = max - files.length;
    const arr = Array.from(list).slice(0, remaining);
    if (arr.length === 0) {
      toast.error(`Limite de ${max} arquivos`);
      return;
    }
    const next: GuestFile[] = [];
    for (const f of arr) {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast.error(`${f.name}: use imagem ou vídeo`);
        continue;
      }
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (f.size > limit) {
        toast.error(`${f.name}: máximo ${isVideo ? "25MB (vídeo)" : "5MB (imagem)"}`);
        continue;
      }
      next.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    setFiles([...files, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (url: string) => {
    const target = files.find((f) => f.previewUrl === url);
    if (target) {
      try {
        URL.revokeObjectURL(target.previewUrl);
      } catch {}
    }
    setFiles(files.filter((f) => f.previewUrl !== url));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {files.map(({ file, previewUrl }) => {
          const isVideo = file.type.startsWith("video/");
          return (
            <div key={previewUrl} className="relative group">
              {isVideo ? (
                <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-border bg-slate-900">
                  <video
                    src={previewUrl}
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
                <img
                  src={previewUrl}
                  alt=""
                  className="h-20 w-20 rounded-xl object-cover border border-border"
                />
              )}
              <button
                type="button"
                onClick={() => remove(previewUrl)}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border border-border shadow grid place-items-center"
                aria-label="Remover arquivo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {files.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-20 w-20 rounded-xl border-2 border-dashed border-border hover:border-brand grid place-items-center text-muted-foreground hover:text-brand transition"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        {files.length}/{max} · adicionar imagem ou vídeo · imagens até 5MB · vídeos até 25MB
      </p>
    </div>
  );
}
