-- =============================================================
-- 0010 · Sets personalizados, entrega parcial y registro de entregas
--
-- Respuestas del dueño (PR #8):
--   · Un set completo se pide entero por defecto, pero se puede personalizar sacando medidas
--     → pedido_piezas.componente_id (null = pieza o set entero; con valor = una medida suelta).
--   · «Entregar parcial»: se eligen piezas y cantidades de un pedido en producción, firma quien recibe
--     y se descuenta del stock de piezas terminadas → pedido_piezas.entregada + tablas entregas / entrega_piezas.
--   · Cancelar en cualquier momento salvo entregado, por el solicitante o por el taller; queda registrado.
--
-- Reemplaza crear_pedido, finalizar_pedido, firmar_pedido y cancelar_pedido de la 0009 (no se edita la 0009).
-- La regla de descuento vive en un solo lugar: taller._necesidades (espejo: planFinalizarPedido en lib/calculos.ts).
-- =============================================================

set search_path = taller, public;

-- ---------------- piezas pedidas: medida suelta y cantidad entregada ----------------
alter table taller.pedido_piezas
  add column componente_id uuid references taller.componentes (id) on delete restrict,
  add column entregada     integer not null default 0 check (entregada >= 0);
alter table taller.pedido_piezas add constraint pedido_piezas_entregada_max check (entregada <= cantidad);

-- ---------------- entregas (cada firma de recepción, total o parcial) ----------------
create table taller.entregas (
  id           uuid primary key default gen_random_uuid(),
  pedido_id    uuid not null references taller.pedidos (id) on delete cascade,
  parcial      boolean not null,
  autor        text not null,
  recibido_por text not null check (length(trim(recibido_por)) > 0),
  firma        text not null check (firma ~ '^data:image/png;base64,' and length(firma) < 400000),
  creado_en    timestamptz not null default now()
);
create index entregas_pedido_idx on taller.entregas (pedido_id, creado_en);

create table taller.entrega_piezas (
  entrega_id      uuid not null references taller.entregas (id) on delete cascade,
  pedido_pieza_id uuid not null references taller.pedido_piezas (id) on delete cascade,
  cantidad        integer not null check (cantidad > 0),
  primary key (entrega_id, pedido_pieza_id)
);

alter table taller.entregas enable row level security;
alter table taller.entrega_piezas enable row level security;
revoke all on taller.entregas, taller.entrega_piezas from public, anon, authenticated;
grant all on taller.entregas, taller.entrega_piezas to service_role;

-- =============================================================
-- Regla de descuento (una sola vez)
-- =============================================================

-- Qué stock hace falta para entregar p_cants = {"<pedido_pieza_id>": cantidad, ...}. Se agrupa por destino
-- (una misma medida pedida en el set entero y suelta suma). Simple → stock terminado · Complejo → armados ·
-- Set entero → cada medida × cant_por_unidad · Medida suelta → esa medida × cant_por_unidad.
create or replace function taller._necesidades(p_cants jsonb)
returns table (campo text, objetivo uuid, inst_id uuid, inst_nombre text, comp_nombre text, cantidad integer, hay integer)
language sql
stable
set search_path = taller, public
as $$
  with pp as (
    select p.*, (p_cants ->> p.id::text)::int as n
    from taller.pedido_piezas p
    where p_cants ? p.id::text and (p_cants ->> p.id::text)::int > 0
  ), nec as (
    select 'stock'::text campo, c.id objetivo, i.id inst_id, i.nombre inst_nombre, c.codigo_o_medida comp_nombre, pp.n * c.cant_por_unidad cant, c.stock hay
      from pp join taller.componentes c on c.id = pp.componente_id join taller.instrumentales i on i.id = c.instrumental_id
    union all
    select 'stock', c.id, i.id, i.nombre, c.codigo_o_medida, pp.n * c.cant_por_unidad, c.stock
      from pp join taller.instrumentales i on i.id = pp.instrumental_id
      join taller.componentes c on c.instrumental_id = i.id and c.clase = 'medida'
     where pp.componente_id is null and i.tipo = 'medidas'
    union all
    select 'sin_medidas', i.id, i.id, i.nombre, null, 1, 0
      from pp join taller.instrumentales i on i.id = pp.instrumental_id
     where pp.componente_id is null and i.tipo = 'medidas'
       and not exists (select 1 from taller.componentes c where c.instrumental_id = i.id and c.clase = 'medida')
    union all
    select 'stock_terminado', i.id, i.id, i.nombre, null, pp.n, i.stock_terminado
      from pp join taller.instrumentales i on i.id = pp.instrumental_id where pp.componente_id is null and i.tipo = 'simple'
    union all
    select 'unidades_armadas', i.id, i.id, i.nombre, null, pp.n, i.unidades_armadas
      from pp join taller.instrumentales i on i.id = pp.instrumental_id where pp.componente_id is null and i.tipo = 'complejo'
  )
  select campo, objetivo, min(inst_id::text)::uuid, min(inst_nombre), min(comp_nombre), sum(cant)::int, min(hay)
  from nec group by campo, objetivo
$$;

-- Faltantes con el mismo texto que planFinalizarPedido.
create or replace function taller._faltantes(p_cants jsonb)
returns text[]
language sql
stable
set search_path = taller, public
as $$
  select coalesce(array_agg(
           case when campo = 'sin_medidas' then format('%s: sin medidas cargadas', inst_nombre)
                else format('%s: hay %s de %s',
                            inst_nombre || case when campo = 'stock' then ' ' || comp_nombre when campo = 'unidades_armadas' then ' (armados)' else '' end,
                            hay, cantidad) end
           order by inst_nombre, comp_nombre), '{}')
  from taller._necesidades(p_cants)
  where campo = 'sin_medidas' or hay < cantidad
$$;

-- Bloquea las filas de stock que toca un pedido (antes de verificar y descontar).
create or replace function taller._bloquear_pedido(p_pedido uuid)
returns void
language plpgsql
set search_path = taller, public
as $$
begin
  perform 1 from taller.instrumentales where id in (select instrumental_id from taller.pedido_piezas where pedido_id = p_pedido) for update;
  perform 1 from taller.componentes where instrumental_id in (select instrumental_id from taller.pedido_piezas where pedido_id = p_pedido) for update;
  perform 1 from taller.cajas where id in (select caja_id from taller.pedido_items where pedido_id = p_pedido) for update;
end;
$$;

-- Aplica el descuento (p_signo = -1) o la devolución (+1) y lo registra en el historial.
create or replace function taller._aplicar(p_cants jsonb, p_signo integer, p_autor text, p_motivo text, p_nota text)
returns void
language plpgsql
set search_path = taller, public
as $$
declare r record; v_res integer;
begin
  for r in select * from taller._necesidades(p_cants) where campo <> 'sin_medidas' loop
    if r.campo = 'stock' then
      update taller.componentes set stock = stock + p_signo * r.cantidad where id = r.objetivo returning stock into v_res;
      insert into taller.movimientos (autor, instrumental_id, componente_id, instrumental_nombre, componente_nombre, campo, delta, stock_resultante, motivo, nota)
      values (trim(p_autor), r.inst_id, r.objetivo, r.inst_nombre, r.comp_nombre, 'stock', p_signo * r.cantidad, v_res, p_motivo, p_nota);
    elsif r.campo = 'stock_terminado' then
      update taller.instrumentales set stock_terminado = stock_terminado + p_signo * r.cantidad where id = r.objetivo returning stock_terminado into v_res;
      insert into taller.movimientos (autor, instrumental_id, instrumental_nombre, campo, delta, stock_resultante, motivo, nota)
      values (trim(p_autor), r.objetivo, r.inst_nombre, 'stock_terminado', p_signo * r.cantidad, v_res, p_motivo, p_nota);
    else
      update taller.instrumentales set unidades_armadas = unidades_armadas + p_signo * r.cantidad where id = r.objetivo returning unidades_armadas into v_res;
      insert into taller.movimientos (autor, instrumental_id, instrumental_nombre, campo, delta, stock_resultante, motivo, nota)
      values (trim(p_autor), r.objetivo, r.inst_nombre, 'unidades_armadas', p_signo * r.cantidad, v_res, p_motivo, p_nota);
    end if;
  end loop;
end;
$$;

-- Lo que falta entregar de cada pieza del pedido: {"<pedido_pieza_id>": cantidad - entregada}.
create or replace function taller._pendientes(p_pedido uuid)
returns jsonb
language sql
stable
set search_path = taller, public
as $$
  select coalesce(jsonb_object_agg(id::text, cantidad - entregada), '{}'::jsonb)
  from taller.pedido_piezas where pedido_id = p_pedido and cantidad > entregada
$$;

-- Cajas armadas que faltan (pedidos viejos por caja).
create or replace function taller._faltan_cajas(p_pedido uuid)
returns text[]
language sql
stable
set search_path = taller, public
as $$
  select coalesce(array_agg(format('%s: hay %s cajas armadas de %s', c.nombre, c.cajas_armadas, x.n)), '{}')
  from (select caja_id, sum(cantidad)::int n from taller.pedido_items where pedido_id = p_pedido group by caja_id) x
  join taller.cajas c on c.id = x.caja_id
  where c.cajas_armadas < x.n
$$;

create or replace function taller._mover_cajas(p_pedido uuid, p_signo integer, p_autor text, p_motivo text, p_nota text)
returns void
language plpgsql
set search_path = taller, public
as $$
declare r record;
begin
  for r in
    select c.id, c.nombre, c.cajas_armadas, sum(pi.cantidad)::int cantidad
    from taller.pedido_items pi join taller.cajas c on c.id = pi.caja_id
    where pi.pedido_id = p_pedido group by c.id
  loop
    update taller.cajas set cajas_armadas = cajas_armadas + p_signo * r.cantidad where id = r.id;
    insert into taller.movimientos (autor, caja_id, caja_nombre, campo, delta, stock_resultante, motivo, nota)
    values (trim(p_autor), r.id, r.nombre, 'cajas_armadas', p_signo * r.cantidad, r.cajas_armadas + p_signo * r.cantidad, p_motivo, p_nota);
  end loop;
end;
$$;

-- =============================================================
-- RPC públicas para la app (reemplazan las de la 0009)
-- =============================================================

-- p_items = [{instrumental_id, caja_id?, componente_id?, cantidad}]. componente_id = una medida suelta del set.
create or replace function taller.crear_pedido(
  p_solicitante text, p_items jsonb, p_origen text default 'qr', p_firma text default null, p_ip text default null, p_notas text default null
) returns jsonb
language plpgsql
set search_path = taller, public
as $$
declare
  v_ped taller.pedidos%rowtype;
  r     record;
  v_n   integer := 0;
begin
  if coalesce(trim(p_solicitante), '') = '' then raise exception 'Falta el nombre de quien pide'; end if;
  if p_origen not in ('qr', 'interno') then raise exception 'Origen no válido'; end if;
  if p_firma is not null and p_firma !~ '^data:image/png;base64,' then raise exception 'La firma no es válida'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Faltan las piezas del pedido'; end if;

  insert into taller.pedidos (cliente, origen, firma_solicitante, ip, notas)
  values (left(trim(p_solicitante), 80), p_origen, p_firma, p_ip, nullif(trim(p_notas), ''))
  returning * into v_ped;

  for r in
    select (x->>'instrumental_id')::uuid inst, nullif(x->>'caja_id', '')::uuid caja, nullif(x->>'componente_id', '')::uuid comp,
           sum((x->>'cantidad')::int)::int cant
    from jsonb_array_elements(p_items) x
    group by 1, 2, 3
  loop
    if r.cant is null or r.cant < 1 or r.cant > 10000 then raise exception 'Cantidad no válida'; end if;
    if not exists (select 1 from taller.instrumentales where id = r.inst) then raise exception 'Una de las piezas ya no existe'; end if;
    if r.comp is not null and not exists (select 1 from taller.componentes where id = r.comp and instrumental_id = r.inst and clase = 'medida') then
      raise exception 'Una de las medidas no corresponde a su set';
    end if;
    insert into taller.pedido_piezas (pedido_id, instrumental_id, caja_id, componente_id, cantidad) values (v_ped.id, r.inst, r.caja, r.comp, r.cant);
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'El pedido no tiene piezas'; end if;

  return jsonb_build_object('id', v_ped.id, 'numero', v_ped.numero, 'token', v_ped.token);
end;
$$;

-- Finaliza ("arma") lo que falta entregar de un pedido en producción → 'listo' (Finalizado). Todo o nada.
create or replace function taller.finalizar_pedido(p_pedido uuid, p_autor text)
returns jsonb
language plpgsql
set search_path = taller, public
as $$
declare
  v_ped  taller.pedidos%rowtype;
  v_cant jsonb;
  v_falt text[];
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien arma el pedido'; end if;
  select * into v_ped from taller.pedidos where id = p_pedido for update;
  if not found then raise exception 'No existe el pedido'; end if;
  if v_ped.estado <> 'en_produccion' then raise exception 'Solo se arman pedidos en producción (este está %)', v_ped.estado; end if;
  perform taller._bloquear_pedido(p_pedido);
  v_cant := taller._pendientes(p_pedido);
  if v_cant = '{}'::jsonb and not exists (select 1 from taller.pedido_items where pedido_id = p_pedido) then
    raise exception 'El pedido no tiene piezas pendientes';
  end if;

  v_falt := taller._faltantes(v_cant) || taller._faltan_cajas(p_pedido);
  if array_length(v_falt, 1) > 0 then return jsonb_build_object('ok', false, 'faltantes', to_jsonb(v_falt)); end if;

  perform taller._aplicar(v_cant, -1, p_autor, 'pedido', 'Pedido ' || v_ped.numero);
  perform taller._mover_cajas(p_pedido, -1, p_autor, 'pedido', 'Pedido ' || v_ped.numero);
  update taller.pedidos set estado = 'listo', finalizado_en = now(), finalizado_por = trim(p_autor) where id = p_pedido;
  return jsonb_build_object('ok', true);
end;
$$;

-- Entrega parcial de un pedido en producción: p_items = [{pieza_id, cantidad}] (pieza_id = pedido_piezas.id).
-- Descuenta las piezas terminadas, registra la entrega con la firma y, si ya se entregó todo, pasa a 'entregado'.
create or replace function taller.entregar_parcial(p_pedido uuid, p_autor text, p_items jsonb, p_recibio text, p_firma text)
returns jsonb
language plpgsql
set search_path = taller, public
as $$
declare
  v_ped   taller.pedidos%rowtype;
  v_cant  jsonb := '{}'::jsonb;
  v_falt  text[];
  v_ent   uuid;
  r       record;
  v_queda boolean;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien entrega'; end if;
  if coalesce(trim(p_recibio), '') = '' then raise exception 'Falta el nombre de quien recibe'; end if;
  if coalesce(p_firma, '') !~ '^data:image/png;base64,' then raise exception 'Falta la firma'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Elegí qué piezas se entregan'; end if;
  select * into v_ped from taller.pedidos where id = p_pedido for update;
  if not found then raise exception 'No existe el pedido'; end if;
  if v_ped.estado <> 'en_produccion' then raise exception 'Solo se entrega parcial un pedido en producción (este está %)', v_ped.estado; end if;
  perform taller._bloquear_pedido(p_pedido);
  perform 1 from taller.pedido_piezas where pedido_id = p_pedido for update;

  for r in
    select (x->>'pieza_id')::uuid pieza, sum((x->>'cantidad')::int)::int n from jsonb_array_elements(p_items) x group by 1
  loop
    if r.n is null or r.n < 1 then continue; end if;
    if not exists (select 1 from taller.pedido_piezas where id = r.pieza and pedido_id = p_pedido and cantidad - entregada >= r.n) then
      raise exception 'Se quiere entregar más de lo que falta de una pieza';
    end if;
    v_cant := v_cant || jsonb_build_object(r.pieza::text, r.n);
  end loop;
  if v_cant = '{}'::jsonb then raise exception 'Elegí al menos una pieza para entregar'; end if;

  v_falt := taller._faltantes(v_cant);
  if array_length(v_falt, 1) > 0 then return jsonb_build_object('ok', false, 'faltantes', to_jsonb(v_falt)); end if;

  perform taller._aplicar(v_cant, -1, p_autor, 'pedido', 'Entrega parcial del pedido ' || v_ped.numero);
  insert into taller.entregas (pedido_id, parcial, autor, recibido_por, firma)
  values (p_pedido, true, trim(p_autor), left(trim(p_recibio), 80), p_firma) returning id into v_ent;
  for r in select key::uuid pieza, value::int n from jsonb_each_text(v_cant) loop
    update taller.pedido_piezas set entregada = entregada + r.n where id = r.pieza;
    insert into taller.entrega_piezas (entrega_id, pedido_pieza_id, cantidad) values (v_ent, r.pieza, r.n);
  end loop;

  v_queda := exists (select 1 from taller.pedido_piezas where pedido_id = p_pedido and entregada < cantidad)
          or exists (select 1 from taller.pedido_items where pedido_id = p_pedido);
  if not v_queda then
    update taller.pedidos
       set estado = 'entregado', finalizado_en = coalesce(finalizado_en, now()), finalizado_por = coalesce(finalizado_por, trim(p_autor)),
           entregado_en = now(), recibido_en = now(), recibido_por = left(trim(p_recibio), 80), firma_recepcion = p_firma
     where id = p_pedido;
  end if;
  return jsonb_build_object('ok', true, 'completo', not v_queda);
end;
$$;

-- Firma de quien recibe el resto de un pedido finalizado → 'entregado'. No toca stock (ya se descontó al finalizar).
create or replace function taller.firmar_pedido(p_pedido uuid, p_autor text, p_recibio text, p_firma text)
returns void
language plpgsql
set search_path = taller, public
as $$
declare v_ped taller.pedidos%rowtype; v_ent uuid;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien entrega'; end if;
  if coalesce(trim(p_recibio), '') = '' then raise exception 'Falta el nombre de quien recibe'; end if;
  if coalesce(p_firma, '') !~ '^data:image/png;base64,' then raise exception 'Falta la firma'; end if;
  select * into v_ped from taller.pedidos where id = p_pedido for update;
  if not found then raise exception 'No existe el pedido'; end if;
  if v_ped.estado <> 'listo' then raise exception 'Solo se firman pedidos finalizados (este está %)', v_ped.estado; end if;

  insert into taller.entregas (pedido_id, parcial, autor, recibido_por, firma)
  values (p_pedido, false, trim(p_autor), left(trim(p_recibio), 80), p_firma) returning id into v_ent;
  insert into taller.entrega_piezas (entrega_id, pedido_pieza_id, cantidad)
  select v_ent, id, cantidad - entregada from taller.pedido_piezas where pedido_id = p_pedido and cantidad > entregada;
  update taller.pedido_piezas set entregada = cantidad where pedido_id = p_pedido;
  update taller.pedidos
     set estado = 'entregado', entregado_en = now(), recibido_en = now(), recibido_por = left(trim(p_recibio), 80), firma_recepcion = p_firma
   where id = p_pedido;
end;
$$;

-- Cancela en cualquier momento salvo entregado (lo puede hacer el solicitante o el taller).
-- Si estaba finalizado, devuelve lo que se había descontado y no se entregó. Lo entregado en parciales queda entregado.
create or replace function taller.cancelar_pedido(p_pedido uuid, p_autor text, p_motivo text default null)
returns void
language plpgsql
set search_path = taller, public
as $$
declare v_ped taller.pedidos%rowtype; v_nota text;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien cancela'; end if;
  select * into v_ped from taller.pedidos where id = p_pedido for update;
  if not found then raise exception 'No existe el pedido'; end if;
  if v_ped.estado in ('entregado', 'cancelado') then raise exception 'El pedido ya está %', v_ped.estado; end if;
  v_nota := 'Cancelación del pedido ' || v_ped.numero;
  if v_ped.estado = 'listo' then
    perform taller._bloquear_pedido(p_pedido);
    perform taller._aplicar(taller._pendientes(p_pedido), 1, p_autor, 'cancelacion', v_nota);
    perform taller._mover_cajas(p_pedido, 1, p_autor, 'cancelacion', v_nota);
  end if;
  update taller.pedidos
     set estado = 'cancelado', cancelado_en = now(), cancelado_por = trim(p_autor), motivo_cancelacion = nullif(trim(p_motivo), '')
   where id = p_pedido;
end;
$$;

revoke all on all functions in schema taller from public, anon, authenticated;
grant execute on all functions in schema taller to service_role;

-- =============================================================
-- Acceso privado: solo por invitación (pedido del dueño)
--   · Al ingresar con la contraseña solo se puede elegir una persona HABILITADA (ya no se crean nombres nuevos).
--   · Para sumar a alguien: Configuración → Invitaciones → link de un solo uso que vence a los 7 días.
--   · Desactivar a una persona le corta el acceso (la app lo revisa en cada pantalla).
-- =============================================================
create table taller.invitaciones (
  id         uuid primary key default gen_random_uuid(),
  token      uuid not null unique default gen_random_uuid(),
  nombre     text not null check (length(trim(nombre)) between 1 and 40),
  creada_por text not null,
  creado_en  timestamptz not null default now(),
  vence_en   timestamptz not null default now() + interval '7 days',
  usada_en   timestamptz
);
alter table taller.invitaciones enable row level security;
revoke all on taller.invitaciones from public, anon, authenticated;
grant all on taller.invitaciones to service_role;

-- Acepta una invitación (una sola vez, sin vencer): habilita a la persona y devuelve su nombre.
create or replace function taller.aceptar_invitacion(p_token uuid)
returns text
language plpgsql
set search_path = taller, public
as $$
declare v taller.invitaciones%rowtype; v_nombre text;
begin
  select * into v from taller.invitaciones where token = p_token for update;
  if not found or v.usada_en is not null or v.vence_en < now() then raise exception 'La invitación no es válida o ya se usó'; end if;
  select nombre into v_nombre from taller.personas where lower(trim(nombre)) = lower(trim(v.nombre));
  if v_nombre is null then
    insert into taller.personas (nombre) values (trim(v.nombre)) returning nombre into v_nombre;
  else
    update taller.personas set activa = true where lower(trim(nombre)) = lower(trim(v.nombre));
  end if;
  update taller.invitaciones set usada_en = now() where id = v.id;
  return v_nombre;
end;
$$;
revoke all on function taller.aceptar_invitacion(uuid) from public, anon, authenticated;
grant execute on function taller.aceptar_invitacion(uuid) to service_role;

-- Clave del QR de pedidos: /pedir solo funciona con el link del QR (?k=…). Se puede cambiar desde la app.
insert into taller.config (clave, valor) values ('pedir', jsonb_build_object('clave', replace(gen_random_uuid()::text, '-', '')))
on conflict (clave) do nothing;

-- ---------------- Novedades ----------------
insert into taller.novedades (autor, origen, seccion, titulo, detalle) values
  ('Claude', 'claude', 'codigo', 'Sets personalizados, entrega parcial y avisos por WhatsApp',
   'Los sets se piden enteros y se pueden personalizar sacando medidas. Nuevo «Entregar parcial» con firma de quien recibe. '
   || 'Registro de entregas y de pedidos cancelados (el solicitante y el taller pueden cancelar hasta que se entrega). '
   || 'Avisos por WhatsApp (CallMeBot): resumen 6:40 y recordatorios 9:40, 12:40 y 15:40 con la información que falta cargar.');

reset search_path;
