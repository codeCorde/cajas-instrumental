-- =============================================================
-- 0004 · Planos (PDF, DWG, STP...) de cada instrumental o de la caja entera
-- Los archivos viven en Supabase Storage, bucket privado "planos".
-- Esta tabla guarda qué archivo es de qué instrumental y con qué nombre se muestra.
-- =============================================================

create table planos (
  id              uuid primary key default gen_random_uuid(),
  caja_id         uuid not null references cajas (id) on delete cascade,
  instrumental_id uuid references instrumentales (id) on delete cascade,  -- null = plano de la caja
  nombre          text not null,          -- "Mango de fresa 1-4"
  ruta            text not null unique,   -- ruta dentro del bucket "planos"
  formato         text not null,          -- pdf, dwg, stp, ...
  tamano          bigint,
  orden           int not null default 0,
  creado_en       timestamptz not null default now()
);
create index planos_instrumental_idx on planos (instrumental_id, orden, nombre);
create index planos_caja_idx on planos (caja_id);

alter table planos enable row level security;
revoke all on planos from anon;
create policy planos_select on planos for select to authenticated using (es_usuario());
create policy planos_insert on planos for insert to authenticated with check (es_admin());
create policy planos_update on planos for update to authenticated using (es_admin()) with check (es_admin());
create policy planos_delete on planos for delete to authenticated using (es_admin());

-- Bucket privado (máx. 50 MB por archivo). Solo se accede con links firmados temporales.
insert into storage.buckets (id, name, public, file_size_limit)
values ('planos', 'planos', false, 52428800)
on conflict (id) do nothing;

create policy planos_archivos_leer on storage.objects for select to authenticated
  using (bucket_id = 'planos' and public.es_usuario());
create policy planos_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'planos' and public.es_admin());
create policy planos_archivos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'planos' and public.es_admin());
create policy planos_archivos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'planos' and public.es_admin());
