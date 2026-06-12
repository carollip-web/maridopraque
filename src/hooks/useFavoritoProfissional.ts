import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function useFavoritoProfissional(profissionalId: string | null | undefined) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorito, setFavorito] = useState(false);
  const [favoritoId, setFavoritoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !profissionalId) {
      setFavorito(false);
      setFavoritoId(null);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("cliente_favoritos")
        .select("id")
        .eq("cliente_id", user.id)
        .eq("profissional_id", profissionalId)
        .maybeSingle();
      if (!active) return;
      if (data?.id) {
        setFavorito(true);
        setFavoritoId(data.id);
      } else {
        setFavorito(false);
        setFavoritoId(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id, profissionalId]);

  const toggle = useCallback(async () => {
    if (!user?.id) {
      navigate({ to: "/login" });
      return;
    }
    if (!profissionalId || loading) return;
    setLoading(true);
    const wasFav = favorito;
    const prevId = favoritoId;
    // optimistic
    setFavorito(!wasFav);
    if (wasFav) setFavoritoId(null);
    try {
      if (wasFav) {
        if (prevId) {
          const { error } = await (supabase as any)
            .from("cliente_favoritos")
            .delete()
            .eq("id", prevId);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any)
            .from("cliente_favoritos")
            .delete()
            .eq("cliente_id", user.id)
            .eq("profissional_id", profissionalId);
          if (error) throw error;
        }
        toast.success("Removido dos favoritos");
      } else {
        const { data, error } = await (supabase as any)
          .from("cliente_favoritos")
          .insert({ cliente_id: user.id, profissional_id: profissionalId })
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (data?.id) setFavoritoId(data.id);
        toast.success("Adicionado aos favoritos");
      }
    } catch (e: any) {
      // revert
      setFavorito(wasFav);
      setFavoritoId(prevId);
      toast.error(e?.message || "Não foi possível atualizar favoritos");
    } finally {
      setLoading(false);
    }
  }, [user?.id, profissionalId, favorito, favoritoId, loading, navigate]);

  return { favorito, toggle, loading, canFavorite: !!profissionalId };
}
