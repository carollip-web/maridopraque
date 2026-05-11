ALTER TABLE public.service_materiais
  ADD CONSTRAINT fk_service_materiais_service FOREIGN KEY (service_id) REFERENCES public.services_catalog(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_service_materiais_material FOREIGN KEY (material_id) REFERENCES public.materiais(id) ON DELETE CASCADE;

ALTER TABLE public.orcamento_materiais
  ADD CONSTRAINT fk_orcamento_materiais_orcamento FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_orcamento_materiais_material FOREIGN KEY (material_id) REFERENCES public.materiais(id) ON DELETE CASCADE;
