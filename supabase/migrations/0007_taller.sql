-- =============================================================
-- 0007 · App nueva: esquema "taller"
--
-- Catálogo único de instrumental con stock compartido entre cajas, composición de cada caja,
-- componentes (medidas o piezas), archivos, notas, movimientos, pedidos, control de calidad,
-- configuración y personas (acceso con contraseña única, sin Supabase Auth).
--
-- Seguridad: TODO pasa por el servidor con la service_role. RLS activado en todas las tablas
-- y sin permisos para anon/authenticated: desde el navegador no se puede leer ni escribir nada.
-- El esquema "public" (app anterior) queda intacto hasta que se dé de baja.
-- =============================================================

create schema if not exists taller;
revoke all on schema taller from public, anon, authenticated;
grant usage on schema taller to service_role;

set search_path = taller, public;

-- ---------------- personas ----------------
create table taller.personas (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (length(trim(nombre)) > 0),
  activa    boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index personas_nombre_uq on taller.personas (lower(trim(nombre)));

-- ---------------- cajas ----------------
create table taller.cajas (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique check (codigo ~ '^[A-Z0-9-]{1,12}$'),
  nombre        text not null check (length(trim(nombre)) > 0),
  descripcion   text,
  foto_path     text,
  cajas_armadas integer not null default 0 check (cajas_armadas >= 0),
  orden         integer not null default 0,
  activa        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- ---------------- instrumentales (catálogo único) ----------------
create table taller.instrumentales (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique check (length(trim(codigo)) > 0),
  nombre           text not null check (length(trim(nombre)) > 0),
  alias            text,
  tipo             text not null default 'simple' check (tipo in ('simple', 'medidas', 'complejo')),
  stock_terminado  integer not null default 0 check (stock_terminado >= 0),
  unidades_armadas integer not null default 0 check (unidades_armadas >= 0),
  material         text,
  terminacion      text,
  origen           text not null default 'propia' check (origen in ('propia', 'tercerizado')),
  proveedor        text,
  foto_path        text,
  descripcion      text,
  proceso          text,
  a_confirmar      boolean not null default false,
  orden            integer not null default 0,
  creado_en        timestamptz not null default now()
);

-- ---------------- composición de cada caja ----------------
create table taller.composicion_caja (
  caja_id         uuid not null references taller.cajas (id) on delete cascade,
  instrumental_id uuid not null references taller.instrumentales (id) on delete cascade,
  cant_por_caja   integer not null default 1 check (cant_por_caja > 0),
  orden           integer not null default 0,
  primary key (caja_id, instrumental_id)
);
create index composicion_instrumental_idx on taller.composicion_caja (instrumental_id);

-- ---------------- componentes: medidas o piezas ----------------
create table taller.componentes (
  id              uuid primary key default gen_random_uuid(),
  instrumental_id uuid not null references taller.instrumentales (id) on delete cascade,
  clase           text not null check (clase in ('medida', 'pieza')),
  codigo_o_medida text not null check (length(trim(codigo_o_medida)) > 0),
  nombre          text,
  cant_por_unidad integer not null default 1 check (cant_por_unidad > 0),
  stock           integer not null default 0 check (stock >= 0),
  descripcion     text,
  proceso         text,
  orden           integer not null default 0,
  creado_en       timestamptz not null default now()
);
create index componentes_instrumental_idx on taller.componentes (instrumental_id, orden);

-- ---------------- bandeja "Sin clasificar" ----------------
create table taller.sin_clasificar (
  id        uuid primary key default gen_random_uuid(),
  caja_id   uuid references taller.cajas (id) on delete set null,
  nombre    text not null check (length(trim(nombre)) > 0),
  nota      text,
  creado_en timestamptz not null default now()
);

-- ---------------- archivos técnicos ----------------
create table taller.archivos (
  id           uuid primary key default gen_random_uuid(),
  entidad      text not null check (entidad in ('instrumental', 'componente', 'caja', 'calidad', 'sin_clasificar')),
  entidad_id   uuid not null,
  nombre       text not null,
  tipo         text not null,          -- extensión en minúscula: pdf, dwg, stp, step, png, jpg...
  tamano       bigint not null default 0,
  storage_path text not null unique,   -- ruta dentro del bucket privado "planos"
  vigente      boolean not null default true,
  subido_por   text,
  creado_en    timestamptz not null default now()
);
create index archivos_entidad_idx on taller.archivos (entidad, entidad_id);

-- ---------------- notas cortas ----------------
create table taller.notas (
  id              uuid primary key default gen_random_uuid(),
  instrumental_id uuid not null references taller.instrumentales (id) on delete cascade,
  componente_id   uuid references taller.componentes (id) on delete cascade,
  tipo            text not null default 'General' check (tipo in ('General', 'Herramienta', 'Medición', 'Proceso', 'Proveedor')),
  texto           text not null check (length(trim(texto)) > 0),
  autor           text,
  creado_en       timestamptz not null default now()
);
create index notas_instrumental_idx on taller.notas (instrumental_id, creado_en desc);

-- ---------------- movimientos (solo inserción) ----------------
create table taller.movimientos (
  id               bigint generated always as identity primary key,
  creado_en        timestamptz not null default now(),
  autor            text not null,
  caja_id          uuid references taller.cajas (id) on delete set null,
  instrumental_id  uuid references taller.instrumentales (id) on delete set null,
  componente_id    uuid references taller.componentes (id) on delete set null,
  -- copias de nombres para que el historial se lea aunque se borre algo
  caja_nombre         text,
  instrumental_nombre text,
  componente_nombre   text,
  campo            text not null check (campo in ('stock_terminado', 'unidades_armadas', 'stock', 'cajas_armadas')),
  delta            integer not null,
  stock_resultante integer not null,
  motivo           text not null check (motivo in ('carga', 'correccion', 'armado_instrumental', 'armado_caja', 'desarmado', 'entrega')),
  nota             text
);
create index movimientos_fecha_idx on taller.movimientos (creado_en desc);
create index movimientos_instrumental_idx on taller.movimientos (instrumental_id, creado_en desc);

create or replace function taller._solo_insercion() returns trigger language plpgsql as $$
begin
  raise exception 'El historial no se puede modificar ni borrar';
end;
$$;
create trigger movimientos_inmutables before update or delete on taller.movimientos
  for each row execute function taller._solo_insercion();

-- ---------------- pedidos ----------------
create table taller.pedidos (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique check (length(trim(numero)) > 0),
  cliente          text not null check (length(trim(cliente)) > 0),
  fecha_pedido     date not null default current_date,
  fecha_compromiso date,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'en_produccion', 'listo', 'entregado', 'cancelado')),
  notas            text,
  entregado_en     timestamptz,
  creado_en        timestamptz not null default now()
);
create table taller.pedido_items (
  id        uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references taller.pedidos (id) on delete cascade,
  caja_id   uuid not null references taller.cajas (id) on delete restrict,
  cantidad  integer not null check (cantidad > 0)
);
create index pedido_items_pedido_idx on taller.pedido_items (pedido_id);

-- ---------------- control de calidad ----------------
create table taller.plantillas_calidad (
  id              uuid primary key default gen_random_uuid(),
  instrumental_id uuid references taller.instrumentales (id) on delete cascade,  -- null = general
  nombre          text not null check (length(trim(nombre)) > 0),
  items           jsonb not null default '[]'::jsonb,                            -- ["Rebabas", "Grabado legible", ...]
  creado_en       timestamptz not null default now()
);

create table taller.inspecciones (
  id                uuid primary key default gen_random_uuid(),
  fecha             date not null default current_date,
  inspector         text not null,
  entidad           text not null check (entidad in ('instrumental', 'componente', 'caja', 'pedido')),
  entidad_id        uuid not null,
  instrumental_id   uuid references taller.instrumentales (id) on delete set null,  -- para filtrar (también si es una pieza)
  caja_id           uuid references taller.cajas (id) on delete set null,
  pedido_id         uuid references taller.pedidos (id) on delete set null,
  cantidad          integer check (cantidad is null or cantidad > 0),
  lote              text,
  resultado         text not null check (resultado in ('conforme', 'observaciones', 'no_conforme')),
  motivo            text,
  checklist         jsonb not null default '[]'::jsonb,   -- [{item, ok}]
  medidas           jsonb not null default '[]'::jsonb,   -- [{cota, nominal, tolerancia, medido, ok}]
  observaciones     text,
  accion_correctiva text,
  accion_cerrada    boolean not null default false,
  cerrada_en        timestamptz,
  cerrada_por       text,
  creado_en         timestamptz not null default now()
);
create index inspecciones_fecha_idx on taller.inspecciones (fecha desc, creado_en desc);

-- ---------------- configuración ----------------
create table taller.config (
  clave text primary key,
  valor jsonb not null
);

-- ---------------- límite de intentos de ingreso ----------------
create table taller.intentos_login (
  id        bigint generated always as identity primary key,
  ip        text not null,
  creado_en timestamptz not null default now()
);
create index intentos_login_idx on taller.intentos_login (ip, creado_en desc);

-- ---------------- equipo: novedades, tareas y chat ----------------
create table taller.novedades (
  id        bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  autor     text not null default 'Sistema',
  origen    text not null default 'app' check (origen in ('app', 'manual', 'claude', 'sistema')),
  seccion   text not null default 'general',
  titulo    text not null check (length(trim(titulo)) > 0),
  detalle   text
);
create index novedades_fecha_idx on taller.novedades (creado_en desc);

create table taller.tareas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null check (length(trim(titulo)) > 0),
  detalle         text,
  medico          text,
  caja_id         uuid references taller.cajas (id) on delete set null,
  instrumental_id uuid references taller.instrumentales (id) on delete set null,
  prioridad       text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  hecha           boolean not null default false,
  hecha_en        timestamptz,
  hecha_por       text,
  creado_por      text,
  creado_en       timestamptz not null default now()
);

create table taller.mensajes (
  id        bigint generated always as identity primary key,
  autor     text not null,
  texto     text not null check (length(trim(texto)) between 1 and 2000),
  creado_en timestamptz not null default now()
);

-- =============================================================
-- Permisos: RLS en todo y solo service_role
-- =============================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'taller' loop
    execute format('alter table taller.%I enable row level security', t);
    execute format('revoke all on taller.%I from public, anon, authenticated', t);
    execute format('grant all on taller.%I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema taller to service_role;
-- movimientos: solo inserción, también para la service_role
revoke update, delete, truncate on taller.movimientos from service_role;

-- =============================================================
-- RPC (transaccionales). Todas registran el movimiento y el stock nunca baja de 0.
-- =============================================================

-- Mueve un contador de stock. p_objetivo:
--   'stock_terminado' | 'unidades_armadas'  → p_id = instrumental
--   'stock'                                 → p_id = componente (medida o pieza)
--   'cajas_armadas'                         → p_id = caja
-- Devuelve el stock resultante. Si el delta lo dejaría en negativo, baja hasta 0 y registra lo que realmente bajó.
create or replace function taller.ajustar_stock(
  p_objetivo text, p_id uuid, p_delta integer, p_autor text,
  p_motivo text default 'carga', p_nota text default null, p_caja_id uuid default null
) returns integer
language plpgsql
set search_path = taller, public
as $$
declare
  v_actual integer;
  v_nuevo  integer;
  v_inst   taller.instrumentales%rowtype;
  v_comp   taller.componentes%rowtype;
  v_caja   taller.cajas%rowtype;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien carga'; end if;
  if p_delta = 0 then raise exception 'La cantidad no puede ser 0'; end if;
  if p_motivo not in ('carga', 'correccion') then raise exception 'Motivo no permitido para un ajuste: %', p_motivo; end if;

  if p_objetivo in ('stock_terminado', 'unidades_armadas') then
    select * into v_inst from taller.instrumentales where id = p_id for update;
    if not found then raise exception 'No existe el instrumental'; end if;
    if p_objetivo = 'stock_terminado' and v_inst.tipo <> 'simple' then
      raise exception '"%" es de tipo %: cargá sus medidas o piezas', v_inst.nombre, v_inst.tipo;
    end if;
    if p_objetivo = 'unidades_armadas' and v_inst.tipo <> 'complejo' then
      raise exception 'Solo los instrumentales complejos tienen unidades armadas';
    end if;
    v_actual := case when p_objetivo = 'stock_terminado' then v_inst.stock_terminado else v_inst.unidades_armadas end;
    v_nuevo := greatest(0, v_actual + p_delta);
    if p_objetivo = 'stock_terminado' then
      update taller.instrumentales set stock_terminado = v_nuevo where id = p_id;
    else
      update taller.instrumentales set unidades_armadas = v_nuevo where id = p_id;
    end if;
  elsif p_objetivo = 'stock' then
    select * into v_comp from taller.componentes where id = p_id for update;
    if not found then raise exception 'No existe la medida o pieza'; end if;
    select * into v_inst from taller.instrumentales where id = v_comp.instrumental_id;
    v_actual := v_comp.stock;
    v_nuevo := greatest(0, v_actual + p_delta);
    update taller.componentes set stock = v_nuevo where id = p_id;
  elsif p_objetivo = 'cajas_armadas' then
    select * into v_caja from taller.cajas where id = p_id for update;
    if not found then raise exception 'No existe la caja'; end if;
    v_actual := v_caja.cajas_armadas;
    v_nuevo := greatest(0, v_actual + p_delta);
    update taller.cajas set cajas_armadas = v_nuevo where id = p_id;
  else
    raise exception 'Objetivo desconocido: %', p_objetivo;
  end if;

  if v_nuevo <> v_actual then
    insert into taller.movimientos (autor, caja_id, instrumental_id, componente_id, caja_nombre, instrumental_nombre,
                                    componente_nombre, campo, delta, stock_resultante, motivo, nota)
    values (trim(p_autor), coalesce(p_caja_id, v_caja.id), v_inst.id, v_comp.id,
            coalesce(v_caja.nombre, (select nombre from taller.cajas where id = p_caja_id)), v_inst.nombre,
            case when v_comp.id is null then null else concat_ws(' · ', v_comp.codigo_o_medida, v_comp.nombre) end,
            p_objetivo, v_nuevo - v_actual, v_nuevo, p_motivo, p_nota);
  end if;
  return v_nuevo;
end;
$$;

-- Arma 1 unidad de un instrumental complejo: descuenta sus piezas y suma 1 a unidades armadas.
create or replace function taller.armar_instrumental(p_instrumental uuid, p_autor text)
returns integer
language plpgsql
set search_path = taller, public
as $$
declare
  v_inst taller.instrumentales%rowtype;
  v_p    taller.componentes%rowtype;
  v_falt text[] := '{}';
  v_n    integer := 0;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien arma'; end if;
  select * into v_inst from taller.instrumentales where id = p_instrumental for update;
  if not found then raise exception 'No existe el instrumental'; end if;
  if v_inst.tipo <> 'complejo' then raise exception 'Solo se arman los instrumentales complejos'; end if;

  for v_p in select * from taller.componentes where instrumental_id = p_instrumental and clase = 'pieza' order by orden for update loop
    v_n := v_n + 1;
    if v_p.stock < v_p.cant_por_unidad then
      v_falt := v_falt || format('%s (hay %s de %s)', concat_ws(' · ', v_p.codigo_o_medida, v_p.nombre), v_p.stock, v_p.cant_por_unidad);
    end if;
  end loop;
  if v_n = 0 then raise exception 'Todavía no cargaste las piezas de "%"', v_inst.nombre; end if;
  if array_length(v_falt, 1) > 0 then raise exception 'Faltan piezas: %', array_to_string(v_falt, ', '); end if;

  for v_p in select * from taller.componentes where instrumental_id = p_instrumental and clase = 'pieza' order by orden loop
    update taller.componentes set stock = stock - v_p.cant_por_unidad where id = v_p.id;
    insert into taller.movimientos (autor, instrumental_id, componente_id, instrumental_nombre, componente_nombre, campo, delta, stock_resultante, motivo)
    values (trim(p_autor), v_inst.id, v_p.id, v_inst.nombre, concat_ws(' · ', v_p.codigo_o_medida, v_p.nombre), 'stock',
            -v_p.cant_por_unidad, v_p.stock - v_p.cant_por_unidad, 'armado_instrumental');
  end loop;
  update taller.instrumentales set unidades_armadas = unidades_armadas + 1 where id = p_instrumental;
  insert into taller.movimientos (autor, instrumental_id, instrumental_nombre, campo, delta, stock_resultante, motivo)
  values (trim(p_autor), v_inst.id, v_inst.nombre, 'unidades_armadas', 1, v_inst.unidades_armadas + 1, 'armado_instrumental');
  return v_inst.unidades_armadas + 1;
end;
$$;

-- Arma 1 caja: verifica todo y descuenta en una sola transacción. Misma regla que lib/calculos.ts → planArmadoCaja.
--   Simple   → cant_por_caja del stock terminado.
--   Medidas  → cant_por_unidad × cant_por_caja de cada medida.
--   Complejo → primero unidades armadas; lo que falte, con piezas sueltas (cant_por_unidad × unidades que faltan).
-- Devuelve { ok, cajas_armadas } o { ok:false, faltantes:[...] } sin tocar nada.
create or replace function taller.armar_caja(p_caja uuid, p_autor text)
returns jsonb
language plpgsql
set search_path = taller, public
as $$
declare
  v_caja  taller.cajas%rowtype;
  r       record;
  v_p     taller.componentes%rowtype;
  v_falt  text[] := '{}';
  v_n     integer := 0;
  v_comp  integer;
  v_usa_armadas integer;
  v_resto integer;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien arma'; end if;
  select * into v_caja from taller.cajas where id = p_caja for update;
  if not found then raise exception 'No existe la caja'; end if;

  -- 1) Verificar (bloqueando las filas)
  for r in
    select i.*, c.cant_por_caja from taller.composicion_caja c join taller.instrumentales i on i.id = c.instrumental_id
    where c.caja_id = p_caja order by c.orden for update of i
  loop
    v_n := v_n + 1;
    if r.tipo = 'simple' then
      if r.stock_terminado < r.cant_por_caja then
        v_falt := v_falt || format('%s: hay %s de %s', r.nombre, r.stock_terminado, r.cant_por_caja);
      end if;
    elsif r.tipo = 'medidas' then
      v_comp := 0;
      for v_p in select * from taller.componentes where instrumental_id = r.id and clase = 'medida' order by orden for update loop
        v_comp := v_comp + 1;
        if v_p.stock < v_p.cant_por_unidad * r.cant_por_caja then
          v_falt := v_falt || format('%s %s: hay %s de %s', r.nombre, v_p.codigo_o_medida, v_p.stock, v_p.cant_por_unidad * r.cant_por_caja);
        end if;
      end loop;
      if v_comp = 0 then v_falt := v_falt || format('%s: sin medidas cargadas', r.nombre); end if;
    else
      v_resto := greatest(0, r.cant_por_caja - r.unidades_armadas);
      if v_resto > 0 then
        v_comp := 0;
        for v_p in select * from taller.componentes where instrumental_id = r.id and clase = 'pieza' order by orden for update loop
          v_comp := v_comp + 1;
          if v_p.stock < v_p.cant_por_unidad * v_resto then
            v_falt := v_falt || format('%s · %s: hay %s de %s', r.nombre, concat_ws(' ', v_p.codigo_o_medida, v_p.nombre), v_p.stock, v_p.cant_por_unidad * v_resto);
          end if;
        end loop;
        if v_comp = 0 then
          v_falt := v_falt || format('%s: hay %s armados de %s y no tiene piezas cargadas', r.nombre, r.unidades_armadas, r.cant_por_caja);
        end if;
      end if;
    end if;
  end loop;
  if v_n = 0 then return jsonb_build_object('ok', false, 'faltantes', jsonb_build_array('La caja no tiene instrumental cargado')); end if;
  if array_length(v_falt, 1) > 0 then return jsonb_build_object('ok', false, 'faltantes', to_jsonb(v_falt)); end if;

  -- 2) Descontar
  for r in
    select i.*, c.cant_por_caja from taller.composicion_caja c join taller.instrumentales i on i.id = c.instrumental_id
    where c.caja_id = p_caja order by c.orden
  loop
    if r.tipo = 'simple' then
      update taller.instrumentales set stock_terminado = stock_terminado - r.cant_por_caja where id = r.id;
      insert into taller.movimientos (autor, caja_id, instrumental_id, caja_nombre, instrumental_nombre, campo, delta, stock_resultante, motivo)
      values (trim(p_autor), p_caja, r.id, v_caja.nombre, r.nombre, 'stock_terminado', -r.cant_por_caja, r.stock_terminado - r.cant_por_caja, 'armado_caja');
    elsif r.tipo = 'medidas' then
      for v_p in select * from taller.componentes where instrumental_id = r.id and clase = 'medida' order by orden loop
        update taller.componentes set stock = stock - v_p.cant_por_unidad * r.cant_por_caja where id = v_p.id;
        insert into taller.movimientos (autor, caja_id, instrumental_id, componente_id, caja_nombre, instrumental_nombre, componente_nombre, campo, delta, stock_resultante, motivo)
        values (trim(p_autor), p_caja, r.id, v_p.id, v_caja.nombre, r.nombre, v_p.codigo_o_medida, 'stock',
                -v_p.cant_por_unidad * r.cant_por_caja, v_p.stock - v_p.cant_por_unidad * r.cant_por_caja, 'armado_caja');
      end loop;
    else
      v_usa_armadas := least(r.unidades_armadas, r.cant_por_caja);
      v_resto := r.cant_por_caja - v_usa_armadas;
      if v_usa_armadas > 0 then
        update taller.instrumentales set unidades_armadas = unidades_armadas - v_usa_armadas where id = r.id;
        insert into taller.movimientos (autor, caja_id, instrumental_id, caja_nombre, instrumental_nombre, campo, delta, stock_resultante, motivo)
        values (trim(p_autor), p_caja, r.id, v_caja.nombre, r.nombre, 'unidades_armadas', -v_usa_armadas, r.unidades_armadas - v_usa_armadas, 'armado_caja');
      end if;
      if v_resto > 0 then
        for v_p in select * from taller.componentes where instrumental_id = r.id and clase = 'pieza' order by orden loop
          update taller.componentes set stock = stock - v_p.cant_por_unidad * v_resto where id = v_p.id;
          insert into taller.movimientos (autor, caja_id, instrumental_id, componente_id, caja_nombre, instrumental_nombre, componente_nombre, campo, delta, stock_resultante, motivo)
          values (trim(p_autor), p_caja, r.id, v_p.id, v_caja.nombre, r.nombre, concat_ws(' · ', v_p.codigo_o_medida, v_p.nombre), 'stock',
                  -v_p.cant_por_unidad * v_resto, v_p.stock - v_p.cant_por_unidad * v_resto, 'armado_caja');
        end loop;
      end if;
    end if;
  end loop;

  update taller.cajas set cajas_armadas = cajas_armadas + 1 where id = p_caja;
  insert into taller.movimientos (autor, caja_id, caja_nombre, campo, delta, stock_resultante, motivo)
  values (trim(p_autor), p_caja, v_caja.nombre, 'cajas_armadas', 1, v_caja.cajas_armadas + 1, 'armado_caja');
  return jsonb_build_object('ok', true, 'cajas_armadas', v_caja.cajas_armadas + 1);
end;
$$;

-- Desarma 1 caja: resta 1 a cajas armadas y devuelve el instrumental
-- (simples al stock terminado, medidas a cada medida, complejos a unidades armadas).
create or replace function taller.desarmar_caja(p_caja uuid, p_autor text)
returns integer
language plpgsql
set search_path = taller, public
as $$
declare
  v_caja taller.cajas%rowtype;
  r      record;
  v_p    taller.componentes%rowtype;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien desarma'; end if;
  select * into v_caja from taller.cajas where id = p_caja for update;
  if not found then raise exception 'No existe la caja'; end if;
  if v_caja.cajas_armadas < 1 then raise exception 'No hay cajas armadas de "%" para desarmar', v_caja.nombre; end if;

  for r in
    select i.*, c.cant_por_caja from taller.composicion_caja c join taller.instrumentales i on i.id = c.instrumental_id
    where c.caja_id = p_caja order by c.orden for update of i
  loop
    if r.tipo = 'simple' then
      update taller.instrumentales set stock_terminado = stock_terminado + r.cant_por_caja where id = r.id;
      insert into taller.movimientos (autor, caja_id, instrumental_id, caja_nombre, instrumental_nombre, campo, delta, stock_resultante, motivo)
      values (trim(p_autor), p_caja, r.id, v_caja.nombre, r.nombre, 'stock_terminado', r.cant_por_caja, r.stock_terminado + r.cant_por_caja, 'desarmado');
    elsif r.tipo = 'medidas' then
      for v_p in select * from taller.componentes where instrumental_id = r.id and clase = 'medida' order by orden for update loop
        update taller.componentes set stock = stock + v_p.cant_por_unidad * r.cant_por_caja where id = v_p.id;
        insert into taller.movimientos (autor, caja_id, instrumental_id, componente_id, caja_nombre, instrumental_nombre, componente_nombre, campo, delta, stock_resultante, motivo)
        values (trim(p_autor), p_caja, r.id, v_p.id, v_caja.nombre, r.nombre, v_p.codigo_o_medida, 'stock',
                v_p.cant_por_unidad * r.cant_por_caja, v_p.stock + v_p.cant_por_unidad * r.cant_por_caja, 'desarmado');
      end loop;
    else
      update taller.instrumentales set unidades_armadas = unidades_armadas + r.cant_por_caja where id = r.id;
      insert into taller.movimientos (autor, caja_id, instrumental_id, caja_nombre, instrumental_nombre, campo, delta, stock_resultante, motivo)
      values (trim(p_autor), p_caja, r.id, v_caja.nombre, r.nombre, 'unidades_armadas', r.cant_por_caja, r.unidades_armadas + r.cant_por_caja, 'desarmado');
    end if;
  end loop;

  update taller.cajas set cajas_armadas = cajas_armadas - 1 where id = p_caja;
  insert into taller.movimientos (autor, caja_id, caja_nombre, campo, delta, stock_resultante, motivo)
  values (trim(p_autor), p_caja, v_caja.nombre, 'cajas_armadas', -1, v_caja.cajas_armadas - 1, 'desarmado');
  return v_caja.cajas_armadas - 1;
end;
$$;

-- Marca un pedido como entregado y, si se pide, descuenta las cajas armadas de cada ítem.
create or replace function taller.entregar_pedido(p_pedido uuid, p_autor text, p_descontar boolean)
returns jsonb
language plpgsql
set search_path = taller, public
as $$
declare
  v_ped  taller.pedidos%rowtype;
  r      record;
  v_falt text[] := '{}';
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien entrega'; end if;
  select * into v_ped from taller.pedidos where id = p_pedido for update;
  if not found then raise exception 'No existe el pedido'; end if;
  if v_ped.estado in ('entregado', 'cancelado') then raise exception 'El pedido ya está %', v_ped.estado; end if;

  if p_descontar then
    perform 1 from taller.cajas where id in (select caja_id from taller.pedido_items where pedido_id = p_pedido) for update;
    for r in
      select c.id, c.nombre, c.cajas_armadas, sum(pi.cantidad)::int cantidad
      from taller.pedido_items pi join taller.cajas c on c.id = pi.caja_id
      where pi.pedido_id = p_pedido group by c.id
    loop
      if r.cajas_armadas < r.cantidad then
        v_falt := v_falt || format('%s: hay %s armadas de %s', r.nombre, r.cajas_armadas, r.cantidad);
      end if;
    end loop;
    if array_length(v_falt, 1) > 0 then return jsonb_build_object('ok', false, 'faltantes', to_jsonb(v_falt)); end if;
    for r in
      select c.id, c.nombre, c.cajas_armadas, sum(pi.cantidad)::int cantidad
      from taller.pedido_items pi join taller.cajas c on c.id = pi.caja_id
      where pi.pedido_id = p_pedido group by c.id
    loop
      update taller.cajas set cajas_armadas = cajas_armadas - r.cantidad where id = r.id;
      insert into taller.movimientos (autor, caja_id, caja_nombre, campo, delta, stock_resultante, motivo, nota)
      values (trim(p_autor), r.id, r.nombre, 'cajas_armadas', -r.cantidad, r.cajas_armadas - r.cantidad, 'entrega', 'Pedido ' || v_ped.numero);
    end loop;
  end if;

  update taller.pedidos set estado = 'entregado', entregado_en = now() where id = p_pedido;
  return jsonb_build_object('ok', true);
end;
$$;

-- Solo la service_role (el servidor de la app) ejecuta las funciones.
revoke all on all functions in schema taller from public, anon, authenticated;
grant execute on all functions in schema taller to service_role;

reset search_path;
