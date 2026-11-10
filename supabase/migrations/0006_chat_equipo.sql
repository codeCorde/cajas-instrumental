-- =============================================================
-- 0006 · Chat del equipo
--
-- mensajes: charla simple entre los usuarios de la app (en tiempo real con Supabase Realtime).
--   · Todos los usuarios leen y escriben.
--   · El autor y su nombre los pone la base (no se pueden falsear).
--   · Nadie edita mensajes; cada uno borra los suyos y el admin puede borrar cualquiera.
--   · Lo que se escribe desde el SQL Editor (sin sesión) queda firmado como «Claude».
-- =============================================================

create table mensajes (
  id           bigint generated always as identity primary key,
  creado_en    timestamptz not null default now(),
  autor_id     uuid references perfiles (id) on delete set null default auth.uid(),
  autor_nombre text,
  texto        text not null check (length(trim(texto)) between 1 and 2000)
);
create index mensajes_fecha_idx on mensajes (creado_en desc);

create or replace function _mensaje_autor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.autor_id := auth.uid();
  new.creado_en := now();
  new.texto := trim(new.texto);
  new.autor_nombre := case
    when auth.uid() is null then 'Claude'
    else coalesce((select coalesce(nullif(nombre, ''), email) from perfiles where id = auth.uid()), 'Usuario')
  end;
  return new;
end;
$$;
create trigger mensajes_autor before insert on mensajes
  for each row execute function _mensaje_autor();

-- ---------------- permisos ----------------
alter table mensajes enable row level security;
revoke all on mensajes from anon;

create policy mensajes_select on mensajes for select to authenticated using (es_usuario());
create policy mensajes_insert on mensajes for insert to authenticated with check (es_usuario());
create policy mensajes_delete on mensajes for delete to authenticated using (autor_id = auth.uid() or es_admin());
revoke insert, update, truncate on mensajes from authenticated;
grant insert (texto) on mensajes to authenticated;

-- ---------------- tiempo real ----------------
-- Supabase trae la publicación supabase_realtime; Realtime respeta las políticas de arriba.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table mensajes;
  end if;
end;
$$;
alter table mensajes replica identity full;  -- para que los borrados lleguen a las otras pantallas

-- ---------------- novedad ----------------
insert into novedades (origen, seccion, titulo, detalle) values
  ('claude', 'codigo', 'Nueva sección: Chat del equipo',
   'Charla simple entre los usuarios de la app, en tiempo real, con nombre, fecha y hora. '
   || 'Cada uno puede borrar sus mensajes; el admin puede borrar cualquiera.');
