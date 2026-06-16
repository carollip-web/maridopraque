-- Migration para atualizar emails dos administradores
-- Carolina
UPDATE auth.users 
SET email = 'carolina@maridopraque.com',
    raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{email}', '"carolina@maridopraque.com"')
WHERE email = 'carol.lip@gmail.com';

UPDATE public.profiles 
SET email = 'carolina@maridopraque.com' 
WHERE email = 'carol.lip@gmail.com';

-- Diego
UPDATE auth.users 
SET email = 'diego@maridopraque.com',
    raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{email}', '"diego@maridopraque.com"')
WHERE email = 'engenheirodonald@yahoo.com';

UPDATE public.profiles 
SET email = 'diego@maridopraque.com' 
WHERE email = 'engenheirodonald@yahoo.com';
