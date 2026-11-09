-- =============================================================
-- 0001 · Tablas del Control de Producción de Cajas de Instrumental
-- =============================================================


create type rol_usuario        as enum ('admin', 'operario');
create type tipo_instrumental  as enum ('simple', 'medidas', 'complejo');
create type origen_fabricacion as enum ('propio', 'tercerizado');
create type motivo_movimiento  as enum ('carga', 'correccion', 'armado_caja', 'entrega');

-- -------------------------------------------------------------
-- Perfiles (1 a 1 con auth.users)
-- -------------------------------------------------------------
create table perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  nombre    text not null default '',
  email     text,
  rol       rol_usuario not null default 'operario',
  creado_en timestamptz not null default now()
);

-- Cada usuario nuevo de Auth recibe un perfil "operario".
-- El rol NUNCA se toma de los metadatos del registro (lo podría falsear el usuario):
-- lo asigna un admin después.
create or replace function crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, nombre, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function crear_perfil_nuevo_usuario();

-- -------------------------------------------------------------
-- Cajas
-- -------------------------------------------------------------
create table cajas (
  id            uuid primary key default gen_random_uuid(),
  numero        int  not null unique,
  nombre        text not null,
  foto_url      text,
  cajas_armadas int  not null default 0 check (cajas_armadas >= 0),
  activa        boolean not null default true,
  ejemplo       boolean not null default false,
  creado_en     timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Instrumentales (cada uno pertenece a UNA caja)
-- -------------------------------------------------------------
create table instrumentales (
  id               uuid primary key default gen_random_uuid(),
  caja_id          uuid not null references cajas (id) on delete cascade,
  codigo           text not null,
  nombre           text not null,
  alias            text,
  tipo             tipo_instrumental not null default 'simple',
  cant_por_caja    int  not null default 1 check (cant_por_caja >= 1),
  stock_terminado  int  not null default 0 check (stock_terminado >= 0),   -- solo Simple
  unidades_armadas int  not null default 0 check (unidades_armadas >= 0),  -- solo Complejo
  material         text,
  terminacion      text,
  barra            text,
  origen           origen_fabricacion not null default 'propio',
  proveedor        text,
  foto_url         text,
  link_2d          text,
  link_3d          text,
  link_cnc         text,
  link_fotos       text,
  orden            int  not null default 0,
  ejemplo          boolean not null default false,
  creado_en        timestamptz not null default now()
);
create index instrumentales_caja_idx on instrumentales (caja_id, orden);

-- -------------------------------------------------------------
-- Partes: medidas de un instrumental "Medidas" o piezas de uno "Complejo"
-- -------------------------------------------------------------
create table partes (
  id              uuid primary key default gen_random_uuid(),
  instrumental_id uuid not null references instrumentales (id) on delete cascade,
  codigo_o_medida text not null,                       -- "Ø44" o "A"
  nombre          text,                                -- "Base" (piezas)
  cant_por_unidad int  not null default 1 check (cant_por_unidad >= 1), -- por juego / por instrumental
  stock           int  not null default 0 check (stock >= 0),
  nota            text,
  orden           int  not null default 0,
  ejemplo         boolean not null default false
);
create index partes_instrumental_idx on partes (instrumental_id, orden);

-- -------------------------------------------------------------
-- Notas de fabricación
-- -------------------------------------------------------------
create table notas (
  id              uuid primary key default gen_random_uuid(),
  instrumental_id uuid not null references instrumentales (id) on delete cascade,
  tipo            text not null default 'General',  -- General, Herramienta, Medición, Proceso, ...
  texto           text not null,
  creado_por      uuid references perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now()
);
create index notas_instrumental_idx on notas (instrumental_id, creado_en desc);

-- -------------------------------------------------------------
-- Movimientos (historial, solo inserción vía RPC)
-- Se guarda una "foto" de los nombres para que el historial sobreviva a borrados.
-- -------------------------------------------------------------
create table movimientos (
  id                  bigint generated always as identity primary key,
  creado_en           timestamptz not null default now(),
  usuario_id          uuid references perfiles (id) on delete set null,
  usuario_nombre      text,
  caja_id             uuid references cajas (id) on delete set null,
  caja_nombre         text,
  instrumental_id     uuid references instrumentales (id) on delete set null,
  instrumental_nombre text,
  parte_id            uuid references partes (id) on delete set null,
  parte_nombre        text,
  campo               text not null check (campo in ('stock_terminado', 'unidades_armadas', 'stock_parte', 'cajas_armadas')),
  delta               int  not null,
  stock_resultante    int  not null,
  motivo              motivo_movimiento not null,
  nota                text
);
create index movimientos_fecha_idx on movimientos (creado_en desc);
create index movimientos_caja_idx  on movimientos (caja_id, creado_en desc);
