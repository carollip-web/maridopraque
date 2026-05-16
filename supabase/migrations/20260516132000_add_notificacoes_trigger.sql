-- Create a trigger function to notify professionals about new orders
CREATE OR REPLACE FUNCTION public.notify_professionals_new_order()
RETURNS trigger AS $$
DECLARE
    client_lat float;
    client_lng float;
    prof_record RECORD;
BEGIN
    IF NEW.status = 'customizado_pendente' THEN
        -- Get client's primary location
        SELECT lat, lng INTO client_lat, client_lng
        FROM public.cliente_enderecos
        WHERE user_id = NEW.cliente_id AND is_padrao = true
        LIMIT 1;

        IF client_lat IS NOT NULL AND client_lng IS NOT NULL THEN
            -- Find all active professionals within range who have matching specialties
            FOR prof_record IN
                SELECT p.user_id
                FROM public.profissional_perfil p
                WHERE p.ativo = true
                AND p.lat IS NOT NULL
                AND p.lng IS NOT NULL
                -- Simple Haversine distance approximation (in km)
                AND (6371 * acos(cos(radians(client_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(client_lng)) + sin(radians(client_lat)) * sin(radians(p.lat)))) <= p.raio_atendimento_km
            LOOP
                -- Insert notification for each matching professional
                INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link, lida)
                VALUES (
                    prof_record.user_id,
                    'Novo pedido no radar!',
                    'Um novo pedido de "' || COALESCE(NEW.service_name, 'Serviço') || '" está disponível na sua área.',
                    NEW.id,
                    '/profissional?tab=orcamentos&orcamentoId=' || NEW.id,
                    false
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_notify_professionals_new_order ON public.orcamentos;
CREATE TRIGGER tr_notify_professionals_new_order
    AFTER INSERT ON public.orcamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_professionals_new_order();
