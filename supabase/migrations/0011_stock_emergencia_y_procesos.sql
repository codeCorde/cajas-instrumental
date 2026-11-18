-- =============================================================
-- 0011 · Stock de emergencia y procesos con tiempos
--
-- 1) Stock de emergencia: cada caja tiene un mínimo de cajas armadas (completas y terminadas, listas para entregar).
--    Arranca en 10 por caja. Si las cajas armadas + lo que ya está en órdenes de reposición abiertas no llega
--    al mínimo, se crea sola una «orden de reposición» (RE-0001…) por lo que falta. Cuando se vuelve a llegar al
--    mínimo, la orden queda cumplida. Las órdenes de reposición son internas: no usan la numeración de los
--    pedidos (OP-0001…) ni descuentan stock.
--    La regla está en taller.revisar_stock_emergencia y su espejo es faltanteEmergencia (lib/calculos.ts).
--
-- 2) Procesos: cada pieza (o cada parte de una pieza compleja / medida de un set) tiene sus procesos en orden,
--    con máquina, minutos por pieza y minutos de preparación. Es la base del costeo (piezas por hora).
-- =============================================================

-- ---------------- 1) stock de emergencia ----------------
alter table taller.cajas add column stock_minimo integer not null default 0 check (stock_minimo between 0 and 10000);
update taller.cajas set stock_minimo = 10 where activa;

create sequence taller.ordenes_reposicion_seq;
create table taller.ordenes_reposicion (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique default 'RE-' || lpad(nextval('taller.ordenes_reposicion_seq')::text, 4, '0'),
  caja_id      uuid not null references taller.cajas (id) on delete cascade,
  cantidad     integer not null check (cantidad > 0),
  estado       text not null default 'abierta' check (estado in ('abierta', 'cumplida', 'cancelada')),
  autor        text not null,
  creado_en    timestamptz not null default now(),
  cerrada_en   timestamptz
);
create index ordenes_reposicion_caja_idx on taller.ordenes_reposicion (caja_id, estado);
alter table taller.ordenes_reposicion enable row level security;
revoke all on taller.ordenes_reposicion from public, anon, authenticated;
grant all on taller.ordenes_reposicion to service_role;
revoke all on sequence taller.ordenes_reposicion_seq from public, anon, authenticated;
grant usage, select on sequence taller.ordenes_reposicion_seq to service_role;

-- Revisa todas las cajas: cierra las órdenes de las que ya llegaron al mínimo y crea órdenes por lo que falta.
-- Devuelve {creadas: [{numero, caja, cantidad}], cumplidas: [{numero, caja}]}.
create or replace function taller.revisar_stock_emergencia(p_autor text)
returns jsonb
language plpgsql
set search_path = taller, public
as $$
declare
  r          record;
  v_abiertas integer;
  v_faltan   integer;
  v_numero   text;
  v_creadas  jsonb := '[]'::jsonb;
  v_cumplidas jsonb := '[]'::jsonb;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el autor'; end if;
  for r in select id, nombre, cajas_armadas, stock_minimo from taller.cajas where activa order by orden, nombre for update loop
    if r.cajas_armadas >= r.stock_minimo then
      with c as (
        update taller.ordenes_reposicion set estado = 'cumplida', cerrada_en = now()
        where caja_id = r.id and estado = 'abierta' returning numero
      )
      select v_cumplidas || coalesce(jsonb_agg(jsonb_build_object('numero', numero, 'caja', r.nombre)), '[]'::jsonb) into v_cumplidas from c;
    else
      select coalesce(sum(cantidad), 0)::int into v_abiertas from taller.ordenes_reposicion where caja_id = r.id and estado = 'abierta';
      v_faltan := r.stock_minimo - r.cajas_armadas - v_abiertas;
      if v_faltan > 0 then
        insert into taller.ordenes_reposicion (caja_id, cantidad, autor) values (r.id, v_faltan, trim(p_autor)) returning numero into v_numero;
        v_creadas := v_creadas || jsonb_build_object('numero', v_numero, 'caja', r.nombre, 'cantidad', v_faltan);
      end if;
    end if;
  end loop;
  return jsonb_build_object('creadas', v_creadas, 'cumplidas', v_cumplidas);
end;
$$;
revoke all on function taller.revisar_stock_emergencia(text) from public, anon, authenticated;
grant execute on function taller.revisar_stock_emergencia(text) to service_role;

-- ---------------- 2) procesos y tiempos ----------------
create table taller.procesos (
  id                  uuid primary key default gen_random_uuid(),
  instrumental_id     uuid not null references taller.instrumentales (id) on delete cascade,
  componente_id       uuid references taller.componentes (id) on delete cascade,  -- null = la pieza entera
  orden               integer not null default 0,
  nombre              text not null check (length(trim(nombre)) between 1 and 80),
  maquina             text,
  minutos_pieza       numeric(8, 2) not null default 0 check (minutos_pieza >= 0),
  minutos_preparacion numeric(8, 2) not null default 0 check (minutos_preparacion >= 0),
  tercerizado         boolean not null default false,
  notas               text,
  creado_en           timestamptz not null default now()
);
create index procesos_pieza_idx on taller.procesos (instrumental_id, componente_id, orden);
alter table taller.procesos enable row level security;
revoke all on taller.procesos from public, anon, authenticated;
grant all on taller.procesos to service_role;

-- Primeras órdenes de reposición: 10 cajas de cada una (todavía no hay cajas armadas).
select taller.revisar_stock_emergencia('Claude');

insert into taller.novedades (autor, origen, seccion, titulo, detalle) values
  ('Claude', 'claude', 'codigo', 'Stock de emergencia y procesos con tiempos',
   'Cada caja tiene un mínimo de cajas armadas (10). Si una entrega o un cambio deja la caja por debajo, la app crea sola una '
   || 'orden de reposición (RE-0001…) y avisa por Telegram. En Stock de partes cada pieza tiene sus procesos con máquina, '
   || 'minutos por pieza y de preparación: es la base del costeo (piezas por hora).');
