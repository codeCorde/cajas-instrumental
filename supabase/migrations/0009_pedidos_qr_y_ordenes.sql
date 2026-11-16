-- =============================================================
-- 0009 · Pedidos por QR, órdenes de producción, firma y remito
--
-- Flujo nuevo (fotos "Realizar pedidos" y "Órdenes de producción"):
--   1. El solicitante escanea el QR → /pedir → elige caja y cantidades de cada pieza → nombre + firma.
--      El pedido entra como estado 'pendiente' (= "Por recepcionar").
--   2. El equipo lo recepciona → 'en_produccion' (= orden de producción). Suma al listado general.
--   3. "Armar pedido" → finalizar_pedido descuenta las piezas terminadas → 'listo' (= "Finalizado", letras naranjas).
--   4. Firma de quien recibe → firmar_pedido → 'entregado' (letras verdes). Queda el remito.
--   Se puede cancelar desde las dos páginas mientras no esté entregado (si estaba finalizado, devuelve el stock).
--
-- Los estados de la tabla no cambian (pendiente, en_produccion, listo, entregado, cancelado): cambian las etiquetas en la app.
-- Es aditiva: la app de main sigue funcionando con esta migración aplicada.
-- =============================================================

set search_path = taller, public;

-- ---------------- pedidos: datos nuevos ----------------
create sequence if not exists taller.pedidos_numero_seq;
alter table taller.pedidos
  alter column numero set default 'OP-' || lpad(nextval('taller.pedidos_numero_seq')::text, 4, '0'),
  add column origen            text not null default 'interno' check (origen in ('qr', 'interno')),
  add column token             uuid not null default gen_random_uuid(),   -- link de seguimiento del solicitante
  add column ip                text,
  add column firma_solicitante text check (firma_solicitante is null or length(firma_solicitante) < 400000),
  add column recepcionado_en   timestamptz,
  add column recepcionado_por  text,
  add column finalizado_en     timestamptz,
  add column finalizado_por    text,
  add column recibido_por      text,
  add column recibido_en       timestamptz,
  add column firma_recepcion   text check (firma_recepcion is null or length(firma_recepcion) < 400000),
  add column cancelado_en      timestamptz,
  add column cancelado_por     text,
  add column motivo_cancelacion text;
create unique index pedidos_token_uq on taller.pedidos (token);
create index pedidos_ip_idx on taller.pedidos (ip, creado_en desc);

-- ---------------- piezas pedidas (el pedido por QR es por pieza, no por caja) ----------------
create table taller.pedido_piezas (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references taller.pedidos (id) on delete cascade,
  instrumental_id uuid not null references taller.instrumentales (id) on delete restrict,
  caja_id         uuid references taller.cajas (id) on delete set null,   -- desde qué caja se eligió (para mostrar)
  cantidad        integer not null check (cantidad > 0)
);
create index pedido_piezas_pedido_idx on taller.pedido_piezas (pedido_id);
create index pedido_piezas_instrumental_idx on taller.pedido_piezas (instrumental_id);

alter table taller.pedido_piezas enable row level security;
revoke all on taller.pedido_piezas from public, anon, authenticated;
grant all on taller.pedido_piezas to service_role;
grant usage, select on sequence taller.pedidos_numero_seq to service_role;

-- ---------------- etapa de producción y datos de taller por pieza ----------------
alter table taller.instrumentales
  add column etapa        text,
  add column maquina      text,
  add column herramientas text;   -- mechas, machos, insertos…
alter table taller.componentes
  add column etapa        text,
  add column maquina      text,
  add column herramientas text;

-- ---------------- historial: motivos nuevos ----------------
alter table taller.movimientos drop constraint movimientos_motivo_check;
alter table taller.movimientos add constraint movimientos_motivo_check
  check (motivo in ('carga', 'correccion', 'armado_instrumental', 'armado_caja', 'desarmado', 'entrega', 'pedido', 'cancelacion'));

-- =============================================================
-- RPC
-- =============================================================

-- Crea un pedido con sus piezas en una sola transacción. p_items = [{instrumental_id, caja_id, cantidad}].
-- Se suman las piezas repetidas. Devuelve { id, numero, token }.
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
    select (x->>'instrumental_id')::uuid inst, nullif(x->>'caja_id', '')::uuid caja, sum((x->>'cantidad')::int)::int cant
    from jsonb_array_elements(p_items) x
    group by 1, 2
  loop
    if r.cant is null or r.cant < 1 or r.cant > 10000 then raise exception 'Cantidad no válida'; end if;
    if not exists (select 1 from taller.instrumentales where id = r.inst) then raise exception 'Una de las piezas ya no existe'; end if;
    insert into taller.pedido_piezas (pedido_id, instrumental_id, caja_id, cantidad) values (v_ped.id, r.inst, r.caja, r.cant);
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'El pedido no tiene piezas'; end if;

  return jsonb_build_object('id', v_ped.id, 'numero', v_ped.numero, 'token', v_ped.token);
end;
$$;

-- Finaliza ("arma") un pedido en producción: descuenta las piezas terminadas y pasa a 'listo' (Finalizado).
-- Misma regla que lib/calculos.ts → planFinalizarPedido.
--   Simple   → cantidad del stock terminado.
--   Medidas  → cant_por_unidad × cantidad de cada medida (sets completos).
--   Complejo → cantidad de unidades armadas (las piezas sueltas se arman antes con armar_instrumental).
--   Cajas (pedidos viejos, por caja) → cantidad de cajas armadas.
-- Devuelve { ok:true } o { ok:false, faltantes:[...] } sin tocar nada.
create or replace function taller.finalizar_pedido(p_pedido uuid, p_autor text)
returns jsonb
language plpgsql
set search_path = taller, public
as $$
declare
  v_ped  taller.pedidos%rowtype;
  r      record;
  v_p    taller.componentes%rowtype;
  v_falt text[] := '{}';
  v_comp integer;
  v_nota text;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien arma el pedido'; end if;
  select * into v_ped from taller.pedidos where id = p_pedido for update;
  if not found then raise exception 'No existe el pedido'; end if;
  if v_ped.estado <> 'en_produccion' then raise exception 'Solo se arman pedidos en producción (este está %)', v_ped.estado; end if;
  if not exists (select 1 from taller.pedido_piezas where pedido_id = p_pedido)
     and not exists (select 1 from taller.pedido_items where pedido_id = p_pedido) then
    raise exception 'El pedido no tiene piezas';
  end if;
  v_nota := 'Pedido ' || v_ped.numero;

  -- 1) Verificar
  for r in
    select i.*, sum(pp.cantidad)::int cantidad
    from taller.pedido_piezas pp join taller.instrumentales i on i.id = pp.instrumental_id
    where pp.pedido_id = p_pedido group by i.id order by min(i.orden)
  loop
    perform 1 from taller.instrumentales where id = r.id for update;
    if r.tipo = 'simple' then
      if r.stock_terminado < r.cantidad then v_falt := v_falt || format('%s: hay %s terminados de %s', r.nombre, r.stock_terminado, r.cantidad); end if;
    elsif r.tipo = 'medidas' then
      v_comp := 0;
      for v_p in select * from taller.componentes where instrumental_id = r.id and clase = 'medida' order by orden for update loop
        v_comp := v_comp + 1;
        if v_p.stock < v_p.cant_por_unidad * r.cantidad then
          v_falt := v_falt || format('%s %s: hay %s de %s', r.nombre, v_p.codigo_o_medida, v_p.stock, v_p.cant_por_unidad * r.cantidad);
        end if;
      end loop;
      if v_comp = 0 then v_falt := v_falt || format('%s: sin medidas cargadas', r.nombre); end if;
    else
      if r.unidades_armadas < r.cantidad then v_falt := v_falt || format('%s: hay %s armados de %s', r.nombre, r.unidades_armadas, r.cantidad); end if;
    end if;
  end loop;
  for r in
    select c.id, c.nombre, c.cajas_armadas, sum(pi.cantidad)::int cantidad
    from taller.pedido_items pi join taller.cajas c on c.id = pi.caja_id
    where pi.pedido_id = p_pedido group by c.id
  loop
    perform 1 from taller.cajas where id = r.id for update;
    if r.cajas_armadas < r.cantidad then v_falt := v_falt || format('%s: hay %s cajas armadas de %s', r.nombre, r.cajas_armadas, r.cantidad); end if;
  end loop;
  if array_length(v_falt, 1) > 0 then return jsonb_build_object('ok', false, 'faltantes', to_jsonb(v_falt)); end if;

  -- 2) Descontar
  for r in
    select i.*, sum(pp.cantidad)::int cantidad
    from taller.pedido_piezas pp join taller.instrumentales i on i.id = pp.instrumental_id
    where pp.pedido_id = p_pedido group by i.id
  loop
    if r.tipo = 'simple' then
      update taller.instrumentales set stock_terminado = stock_terminado - r.cantidad where id = r.id;
      insert into taller.movimientos (autor, instrumental_id, instrumental_nombre, campo, delta, stock_resultante, motivo, nota)
      values (trim(p_autor), r.id, r.nombre, 'stock_terminado', -r.cantidad, r.stock_terminado - r.cantidad, 'pedido', v_nota);
    elsif r.tipo = 'medidas' then
      for v_p in select * from taller.componentes where instrumental_id = r.id and clase = 'medida' order by orden loop
        update taller.componentes set stock = stock - v_p.cant_por_unidad * r.cantidad where id = v_p.id;
        insert into taller.movimientos (autor, instrumental_id, componente_id, instrumental_nombre, componente_nombre, campo, delta, stock_resultante, motivo, nota)
        values (trim(p_autor), r.id, v_p.id, r.nombre, v_p.codigo_o_medida, 'stock', -v_p.cant_por_unidad * r.cantidad,
                v_p.stock - v_p.cant_por_unidad * r.cantidad, 'pedido', v_nota);
      end loop;
    else
      update taller.instrumentales set unidades_armadas = unidades_armadas - r.cantidad where id = r.id;
      insert into taller.movimientos (autor, instrumental_id, instrumental_nombre, campo, delta, stock_resultante, motivo, nota)
      values (trim(p_autor), r.id, r.nombre, 'unidades_armadas', -r.cantidad, r.unidades_armadas - r.cantidad, 'pedido', v_nota);
    end if;
  end loop;
  for r in
    select c.id, c.nombre, c.cajas_armadas, sum(pi.cantidad)::int cantidad
    from taller.pedido_items pi join taller.cajas c on c.id = pi.caja_id
    where pi.pedido_id = p_pedido group by c.id
  loop
    update taller.cajas set cajas_armadas = cajas_armadas - r.cantidad where id = r.id;
    insert into taller.movimientos (autor, caja_id, caja_nombre, campo, delta, stock_resultante, motivo, nota)
    values (trim(p_autor), r.id, r.nombre, 'cajas_armadas', -r.cantidad, r.cajas_armadas - r.cantidad, 'pedido', v_nota);
  end loop;

  update taller.pedidos set estado = 'listo', finalizado_en = now(), finalizado_por = trim(p_autor) where id = p_pedido;
  return jsonb_build_object('ok', true);
end;
$$;

-- Firma de quien recibe: el pedido finalizado pasa a 'entregado' (queda el remito). No toca stock.
create or replace function taller.firmar_pedido(p_pedido uuid, p_autor text, p_recibio text, p_firma text)
returns void
language plpgsql
set search_path = taller, public
as $$
declare v_ped taller.pedidos%rowtype;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien entrega'; end if;
  if coalesce(trim(p_recibio), '') = '' then raise exception 'Falta el nombre de quien recibe'; end if;
  if coalesce(p_firma, '') !~ '^data:image/png;base64,' then raise exception 'Falta la firma'; end if;
  select * into v_ped from taller.pedidos where id = p_pedido for update;
  if not found then raise exception 'No existe el pedido'; end if;
  if v_ped.estado <> 'listo' then raise exception 'Solo se firman pedidos finalizados (este está %)', v_ped.estado; end if;
  update taller.pedidos
     set estado = 'entregado', entregado_en = now(), recibido_en = now(), recibido_por = left(trim(p_recibio), 80), firma_recepcion = p_firma
   where id = p_pedido;
end;
$$;

-- Cancela un pedido que todavía no se entregó. Si ya estaba finalizado, devuelve lo que se había descontado.
create or replace function taller.cancelar_pedido(p_pedido uuid, p_autor text, p_motivo text default null)
returns void
language plpgsql
set search_path = taller, public
as $$
declare
  v_ped  taller.pedidos%rowtype;
  r      record;
  v_p    taller.componentes%rowtype;
  v_nota text;
begin
  if coalesce(trim(p_autor), '') = '' then raise exception 'Falta el nombre de quien cancela'; end if;
  select * into v_ped from taller.pedidos where id = p_pedido for update;
  if not found then raise exception 'No existe el pedido'; end if;
  if v_ped.estado in ('entregado', 'cancelado') then raise exception 'El pedido ya está %', v_ped.estado; end if;
  v_nota := 'Cancelación del pedido ' || v_ped.numero;

  if v_ped.estado = 'listo' then
    for r in
      select i.*, sum(pp.cantidad)::int cantidad
      from taller.pedido_piezas pp join taller.instrumentales i on i.id = pp.instrumental_id
      where pp.pedido_id = p_pedido group by i.id
    loop
      perform 1 from taller.instrumentales where id = r.id for update;
      if r.tipo = 'simple' then
        update taller.instrumentales set stock_terminado = stock_terminado + r.cantidad where id = r.id;
        insert into taller.movimientos (autor, instrumental_id, instrumental_nombre, campo, delta, stock_resultante, motivo, nota)
        values (trim(p_autor), r.id, r.nombre, 'stock_terminado', r.cantidad, r.stock_terminado + r.cantidad, 'cancelacion', v_nota);
      elsif r.tipo = 'medidas' then
        for v_p in select * from taller.componentes where instrumental_id = r.id and clase = 'medida' order by orden for update loop
          update taller.componentes set stock = stock + v_p.cant_por_unidad * r.cantidad where id = v_p.id;
          insert into taller.movimientos (autor, instrumental_id, componente_id, instrumental_nombre, componente_nombre, campo, delta, stock_resultante, motivo, nota)
          values (trim(p_autor), r.id, v_p.id, r.nombre, v_p.codigo_o_medida, 'stock', v_p.cant_por_unidad * r.cantidad,
                  v_p.stock + v_p.cant_por_unidad * r.cantidad, 'cancelacion', v_nota);
        end loop;
      else
        update taller.instrumentales set unidades_armadas = unidades_armadas + r.cantidad where id = r.id;
        insert into taller.movimientos (autor, instrumental_id, instrumental_nombre, campo, delta, stock_resultante, motivo, nota)
        values (trim(p_autor), r.id, r.nombre, 'unidades_armadas', r.cantidad, r.unidades_armadas + r.cantidad, 'cancelacion', v_nota);
      end if;
    end loop;
    for r in
      select c.id, c.nombre, c.cajas_armadas, sum(pi.cantidad)::int cantidad
      from taller.pedido_items pi join taller.cajas c on c.id = pi.caja_id
      where pi.pedido_id = p_pedido group by c.id
    loop
      update taller.cajas set cajas_armadas = cajas_armadas + r.cantidad where id = r.id;
      insert into taller.movimientos (autor, caja_id, caja_nombre, campo, delta, stock_resultante, motivo, nota)
      values (trim(p_autor), r.id, r.nombre, 'cajas_armadas', r.cantidad, r.cajas_armadas + r.cantidad, 'cancelacion', v_nota);
    end loop;
  end if;

  update taller.pedidos
     set estado = 'cancelado', cancelado_en = now(), cancelado_por = trim(p_autor), motivo_cancelacion = nullif(trim(p_motivo), '')
   where id = p_pedido;
end;
$$;

revoke all on all functions in schema taller from public, anon, authenticated;
grant execute on all functions in schema taller to service_role;

-- ---------------- Novedades ----------------
insert into taller.novedades (autor, origen, seccion, titulo, detalle) values
  ('Claude', 'claude', 'codigo', 'Pedidos por QR y órdenes de producción',
   'Nuevo QR de pedidos (InstrumentARG): el solicitante elige caja y cantidades de cada pieza, pone su nombre y firma. '
   || 'Nueva sección Producción con 4 pestañas: Órdenes de producción (listado general sumado), Stock de partes (etapa, '
   || 'máquina, herramientas y planos por pieza), Piezas terminadas (● completa, ■ incompleta, ✕ vacía) y Pedidos entregados '
   || '(finalizado en naranja → firmar → entregado en verde, con remito). Se puede cancelar un pedido desde las dos páginas.');

reset search_path;
