ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS apoio_feminino_id UUID REFERENCES public.profiles(id);
