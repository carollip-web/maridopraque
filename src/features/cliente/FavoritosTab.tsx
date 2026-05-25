import React, { useEffect, useState } from "react";
import { Heart, User, Star, Search, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface Favorito {
  id: string;
  profissional_id: string;
  profissional: {
    nome: string;
    avatar_url: string | null;
    nota_media: number | null;
    total_avaliacoes: number | null;
  };
}

export function FavoritosTab() {
  const { user } = useAuth();
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavoritos = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("cliente_favoritos")
      .select(`
        id,
        profissional_id,
        profissional:profiles!cliente_favoritos_profissional_id_fkey (
          nome,
          avatar_url,
          nota_media,
          total_avaliacoes
        )
      `)
      .eq("cliente_id", user.id);

    if (data) {
      setFavoritos(data as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFavoritos();
  }, [user]);

  const handleRemoveFavorito = async (id: string) => {
    await (supabase as any).from("cliente_favoritos").delete().eq("id", id);
    setFavoritos(prev => prev.filter(f => f.id !== id));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center">
          <Heart className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Profissionais Favoritos</h2>
          <p className="text-muted-foreground text-sm">
            Guarde seus profissionais de confiança para contatá-los rapidamente no futuro.
          </p>
        </div>
      </div>

      {favoritos.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-border p-12 text-center shadow-soft flex flex-col items-center">
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Nenhum favorito ainda</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Quando você for bem atendido por um profissional, salve-o como favorito para pedir novos orçamentos com facilidade.
          </p>
          <Button variant="outline" className="rounded-full font-bold px-6 border-brand text-brand hover:bg-brand/5">
            <Search className="h-4 w-4 mr-2" /> Buscar Profissionais
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoritos.map((fav) => (
            <div key={fav.id} className="bg-white rounded-3xl p-6 border border-border shadow-soft hover:shadow-lg transition-shadow relative group">
              <button 
                onClick={() => handleRemoveFavorito(fav.id)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Heart className="h-4 w-4 fill-current" />
              </button>

              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                  {fav.profissional.avatar_url ? (
                    <img src={fav.profissional.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <User className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 line-clamp-1">{fav.profissional.nome}</h4>
                  {fav.profissional.total_avaliacoes && fav.profissional.total_avaliacoes > 0 ? (
                    <div className="flex items-center gap-1 text-sm text-amber-500 font-medium">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      <span>{fav.profissional.nota_media?.toFixed(1)}</span>
                      <span className="text-muted-foreground font-normal">({fav.profissional.total_avaliacoes})</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Novo na plataforma</span>
                  )}
                </div>
              </div>

              <Button className="w-full rounded-xl bg-slate-900 text-white font-bold hover:bg-brand transition-colors">
                Novo Orçamento
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
