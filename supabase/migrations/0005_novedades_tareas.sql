-- =============================================================
-- 0005 · Novedades (registro de cambios) y Tareas de mejora
--
-- novedades: qué se modificó, cuándo y quién. Se llena sola (triggers sobre cajas,
--            instrumentales, partes, planos, notas y tareas) y también a mano (admin).
--            Nadie la edita ni la borra, igual que el historial de stock.
--            origen: 'app' (automático) · 'manual' (nota escrita por un admin)
--                    'claude' (cambios hechos por Claude) · 'sistema' (versiones del código)
-- tareas:    aclaraciones de los médicos para mejorar el instrumental, con check de
--            "corregido" (quién y cuándo lo marcó).
-- Los cambios de STOCK no van acá: ya quedan en movimientos (Historial).
-- =============================================================

-- ---------------- novedades ----------------
create table novedades (
  id           bigint generated always as identity primary key,
  creado_en    timestamptz not null default now(),
  autor_id     uuid references perfiles (id) on delete set null default auth.uid(),
  autor_nombre text,
  origen       text not null default 'manual' check (origen in ('app', 'manual', 'claude', 'sistema')),
  seccion      text not null default 'general',   -- cajas, instrumentales, partes, planos, notas, tareas, codigo, general
  titulo       text not null check (length(trim(titulo)) > 0),
  detalle      text
);
create index novedades_fecha_idx on novedades (creado_en desc);

-- Completa el nombre del autor (copia, para que sobreviva si se borra el usuario).
create or replace function _novedad_autor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.autor_nombre is null then
    new.autor_nombre := case
      when new.origen = 'claude' then 'Claude'
      else coalesce((select coalesce(nullif(nombre, ''), email) from perfiles where id = new.autor_id), 'Sistema')
    end;
  end if;
  return new;
end;
$$;
create trigger novedades_autor before insert on novedades
  for each row execute function _novedad_autor();

-- Registra altas, ediciones y bajas de la estructura. Ignora los cambios que son solo
-- de stock (ya están en movimientos) o de orden (subir/bajar en la lista), y los
-- borrados en cascada (ya queda registrada la baja del padre).
create or replace function _novedad_estructura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila    jsonb;
  v_viejo   jsonb;
  v_cambios text[] := '{}';
  v_ignorar text[] := array['stock_terminado', 'unidades_armadas', 'stock', 'cajas_armadas', 'orden', 'creado_en', 'tamano'];
  v_titulo  text;
  k         text;
begin
  if tg_op = 'DELETE' then v_fila := to_jsonb(old); else v_fila := to_jsonb(new); end if;

  -- Borrado en cascada: si el padre ya no existe, la baja del padre ya quedó registrada.
  if tg_op = 'DELETE' and (
       (tg_table_name = 'instrumentales' and not exists (select 1 from cajas where id = (v_fila ->> 'caja_id')::uuid))
    or (tg_table_name in ('partes', 'notas') and not exists (select 1 from instrumentales where id = (v_fila ->> 'instrumental_id')::uuid))
    or (tg_table_name = 'planos' and (
             not exists (select 1 from cajas where id = (v_fila ->> 'caja_id')::uuid)
          or (v_fila ->> 'instrumental_id' is not null
              and not exists (select 1 from instrumentales where id = (v_fila ->> 'instrumental_id')::uuid))))
  ) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    v_viejo := to_jsonb(old);
    for k in select jsonb_object_keys(v_fila) loop
      if not (k = any (v_ignorar)) and (v_fila -> k) is distinct from (v_viejo -> k) then
        v_cambios := v_cambios || format('%s: %s → %s', k, coalesce(v_viejo ->> k, '—'), coalesce(v_fila ->> k, '—'));
      end if;
    end loop;
    if coalesce(array_length(v_cambios, 1), 0) = 0 then
      return null;
    end if;
  end if;

  v_titulo := case tg_op when 'INSERT' then 'Alta' when 'UPDATE' then 'Edición' else 'Baja' end || ' · ' ||
    case tg_table_name
      when 'cajas' then 'Caja ' || (v_fila ->> 'numero') || ' ' || (v_fila ->> 'nombre')
      when 'instrumentales' then 'Instrumental ' || (v_fila ->> 'codigo') || ' ' || (v_fila ->> 'nombre')
      when 'partes' then 'Medida/parte ' || (v_fila ->> 'codigo_o_medida') || coalesce(' ' || (v_fila ->> 'nombre'), '') ||
        coalesce(' de ' || (select codigo || ' ' || nombre from instrumentales where id = (v_fila ->> 'instrumental_id')::uuid), '')
      when 'planos' then 'Plano ' || (v_fila ->> 'nombre')
      when 'notas' then 'Nota de fabricación (' || (v_fila ->> 'tipo') || ')' ||
        coalesce(' en ' || (select codigo || ' ' || nombre from instrumentales where id = (v_fila ->> 'instrumental_id')::uuid), '')
      else tg_table_name
    end;

  insert into novedades (origen, seccion, titulo, detalle)
  values ('app', tg_table_name, v_titulo,
          case when tg_op = 'UPDATE' then array_to_string(v_cambios, E'\n')
               when tg_table_name = 'notas' then v_fila ->> 'texto' end);
  return null;
end;
$$;

create trigger cajas_novedad          after insert or update or delete on cajas          for each row execute function _novedad_estructura();
create trigger instrumentales_novedad after insert or update or delete on instrumentales for each row execute function _novedad_estructura();
create trigger partes_novedad         after insert or update or delete on partes         for each row execute function _novedad_estructura();
create trigger planos_novedad         after insert or update or delete on planos         for each row execute function _novedad_estructura();
create trigger notas_novedad          after insert or update or delete on notas          for each row execute function _novedad_estructura();

-- ---------------- tareas ----------------
create type prioridad_tarea as enum ('alta', 'media', 'baja');

create table tareas (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null check (length(trim(titulo)) > 0),
  detalle           text,
  medico            text,                                   -- quién hizo la aclaración
  caja_id           uuid references cajas (id) on delete set null,
  instrumental_id   uuid references instrumentales (id) on delete set null,
  prioridad         prioridad_tarea not null default 'media',
  hecha             boolean not null default false,
  hecha_en          timestamptz,
  hecha_por         uuid references perfiles (id) on delete set null,
  hecha_por_nombre  text,
  creado_por        uuid references perfiles (id) on delete set null default auth.uid(),
  creado_por_nombre text,
  creado_en         timestamptz not null default now()
);
create index tareas_estado_idx on tareas (hecha, creado_en desc);

-- Completa autor y, al marcar/desmarcar, quién y cuándo.
create or replace function _tarea_sellar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo text := (select coalesce(nullif(nombre, ''), email) from perfiles where id = auth.uid());
begin
  if tg_op = 'INSERT' then
    new.creado_por_nombre := coalesce(v_yo, case when auth.uid() is null then 'Claude' end);
  end if;
  if tg_op = 'INSERT' or new.hecha is distinct from old.hecha then
    if new.hecha then
      new.hecha_en := now();
      new.hecha_por := auth.uid();
      new.hecha_por_nombre := coalesce(v_yo, case when auth.uid() is null then 'Claude' end);
    else
      new.hecha_en := null;
      new.hecha_por := null;
      new.hecha_por_nombre := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger tareas_sellar before insert or update on tareas
  for each row execute function _tarea_sellar();

create or replace function _novedad_tarea()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t      tareas%rowtype;
  v_titulo text;
begin
  -- Si se borró la caja o el instrumental, la tarea queda sin vínculo: no es un cambio de la tarea.
  if tg_op = 'UPDATE'
     and (new.titulo, new.detalle, new.medico, new.prioridad, new.hecha)
         is not distinct from (old.titulo, old.detalle, old.medico, old.prioridad, old.hecha)
     and (new.caja_id is null or new.caja_id = old.caja_id)
     and (new.instrumental_id is null or new.instrumental_id = old.instrumental_id)
     and (old.caja_id is null or new.caja_id is not null or not exists (select 1 from cajas where id = old.caja_id))
     and (old.instrumental_id is null or new.instrumental_id is not null
          or not exists (select 1 from instrumentales where id = old.instrumental_id)) then
    return null;
  end if;
  if tg_op = 'DELETE' then v_t := old; else v_t := new; end if;
  v_titulo := case
    when tg_op = 'INSERT' then 'Nueva tarea · '
    when tg_op = 'DELETE' then 'Tarea borrada · '
    when new.hecha and not old.hecha then '✓ Tarea corregida · '
    when old.hecha and not new.hecha then 'Tarea reabierta · '
    else 'Tarea editada · '
  end || v_t.titulo;
  insert into novedades (origen, seccion, titulo, detalle)
  values (case when auth.uid() is null then 'claude' else 'app' end, 'tareas', v_titulo,
          case when tg_op = 'INSERT' then concat_ws(' · ', 'Médico: ' || v_t.medico, v_t.detalle) end);
  return null;
end;
$$;
create trigger tareas_novedad after insert or update or delete on tareas
  for each row execute function _novedad_tarea();

-- ---------------- permisos ----------------
alter table novedades enable row level security;
alter table tareas    enable row level security;
revoke all on novedades, tareas from anon;

-- novedades: todos los usuarios leen; el admin agrega notas manuales; nadie edita ni borra.
create policy novedades_select on novedades for select to authenticated using (es_usuario());
create policy novedades_insert on novedades for insert to authenticated
  with check (es_admin() and origen = 'manual');
revoke insert, update, delete, truncate on novedades from authenticated;
grant insert (seccion, titulo, detalle) on novedades to authenticated;

-- tareas: todos leen; el admin crea, edita, marca y borra.
create policy tareas_select on tareas for select to authenticated using (es_usuario());
create policy tareas_insert on tareas for insert to authenticated with check (es_admin());
create policy tareas_update on tareas for update to authenticated using (es_admin()) with check (es_admin());
create policy tareas_delete on tareas for delete to authenticated using (es_admin());
revoke insert, update on tareas from authenticated;
grant insert (titulo, detalle, medico, caja_id, instrumental_id, prioridad, hecha) on tareas to authenticated;
grant update (titulo, detalle, medico, caja_id, instrumental_id, prioridad, hecha) on tareas to authenticated;

-- ---------------- primeras novedades ----------------
insert into novedades (creado_en, origen, seccion, titulo, detalle, autor_nombre) values
  ('2026-11-09 12:14:36-03', 'sistema', 'codigo', 'Versión inicial de la app (MVP)',
   'Resumen de cajas, carga rápida por QR, qué fabricar, planos, historial de stock y administración.', 'Franco Martinez'),
  ('2026-11-09 12:20:14-03', 'sistema', 'codigo', 'Repositorio preparado para trabajar en equipo',
   'CLAUDE.md con las reglas del proyecto, plantilla de PR y CI en GitHub.', 'Franco Martinez'),
  (now(), 'claude', 'codigo', 'Nuevas secciones: Novedades y Tareas de mejora',
   'Novedades registra sola cada alta, edición o baja de cajas, instrumentales, medidas/partes, planos, notas y tareas, '
   || 'con fecha, hora y autor. Tareas guarda las aclaraciones de los médicos con un check de «corregido».', null);
