-- =============================================================
-- 0003 · Funciones RPC de stock (transaccionales)
--
-- Cada función bloquea las filas que toca (SELECT ... FOR UPDATE), cambia el stock e
-- inserta el movimiento en la MISMA transacción. Si dos operarios cargan a la vez,
-- el segundo espera al primero y nunca se pisan.
-- Orden de bloqueo (para evitar deadlocks): caja → instrumentales → partes.
-- =============================================================

-- Inserta un movimiento con la "foto" de nombres. Uso interno.
create or replace function _registrar_movimiento(
  p_caja uuid, p_instrumental uuid, p_parte uuid,
  p_campo text, p_delta int, p_resultante int,
  p_motivo motivo_movimiento, p_nota text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into movimientos (usuario_id, usuario_nombre, caja_id, caja_nombre,
                           instrumental_id, instrumental_nombre, parte_id, parte_nombre,
                           campo, delta, stock_resultante, motivo, nota)
  select auth.uid(),
         (select coalesce(nullif(nombre, ''), email) from perfiles where id = auth.uid()),
         p_caja,
         (select nombre from cajas where id = p_caja),
         p_instrumental,
         (select codigo || ' ' || nombre from instrumentales where id = p_instrumental),
         p_parte,
         (select codigo_o_medida || coalesce(' ' || nombre, '') from partes where id = p_parte),
         p_campo, p_delta, p_resultante, p_motivo, nullif(p_nota, '');
end;
$$;
revoke all on function _registrar_movimiento from public, anon, authenticated;

-- -------------------------------------------------------------
-- ajustar_stock: + / − sobre stock terminado, unidades armadas o una parte.
-- El stock nunca baja de 0 (si piden −5 y hay 3, baja 3 y registra −3).
-- Devuelve el stock resultante.
-- -------------------------------------------------------------
create or replace function ajustar_stock(
  p_instrumental uuid,
  p_campo        text,          -- 'stock_terminado' | 'unidades_armadas' | 'stock_parte'
  p_delta        int,
  p_parte        uuid default null,
  p_motivo       motivo_movimiento default 'carga',
  p_nota         text default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst   instrumentales%rowtype;
  v_parte  partes%rowtype;
  v_actual int;
  v_nuevo  int;
begin
  if not es_usuario() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_motivo not in ('carga', 'correccion') then
    raise exception 'Motivo inválido para un ajuste de stock';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'La cantidad no puede ser 0';
  end if;

  select * into v_inst from instrumentales where id = p_instrumental for update;
  if not found then raise exception 'Instrumental inexistente'; end if;

  if p_campo = 'stock_terminado' then
    if v_inst.tipo <> 'simple' then raise exception 'Solo los instrumentales simples tienen stock terminado'; end if;
    v_actual := v_inst.stock_terminado;
    v_nuevo  := greatest(0, v_actual + p_delta);
    update instrumentales set stock_terminado = v_nuevo where id = p_instrumental;

  elsif p_campo = 'unidades_armadas' then
    if v_inst.tipo <> 'complejo' then raise exception 'Solo los instrumentales complejos tienen unidades armadas'; end if;
    v_actual := v_inst.unidades_armadas;
    v_nuevo  := greatest(0, v_actual + p_delta);
    update instrumentales set unidades_armadas = v_nuevo where id = p_instrumental;

  elsif p_campo = 'stock_parte' then
    if v_inst.tipo = 'simple' then raise exception 'Un instrumental simple no tiene medidas ni partes'; end if;
    select * into v_parte from partes where id = p_parte and instrumental_id = p_instrumental for update;
    if not found then raise exception 'La medida/parte no pertenece a ese instrumental'; end if;
    v_actual := v_parte.stock;
    v_nuevo  := greatest(0, v_actual + p_delta);
    update partes set stock = v_nuevo where id = p_parte;

  else
    raise exception 'Campo inválido: %', p_campo;
  end if;

  if v_nuevo <> v_actual then
    perform _registrar_movimiento(v_inst.caja_id, p_instrumental,
                                  case when p_campo = 'stock_parte' then p_parte end,
                                  p_campo, v_nuevo - v_actual, v_nuevo, p_motivo, p_nota);
  end if;
  return v_nuevo;
end;
$$;

-- -------------------------------------------------------------
-- armar_caja: suma 1 caja armada y DESCUENTA lo que lleva una caja.
--
-- >>> REGLA DE DESCUENTO (aislada acá; la misma regla está en lib/armado.ts para
-- >>> mostrar la vista previa. Si se cambia una, cambiar la otra).
--   Simple   → stock_terminado −= cant_por_caja
--   Medidas  → cada medida: stock −= cant_por_unidad × cant_por_caja
--   Complejo → primero unidades_armadas; si no alcanzan, el resto se arma con
--              partes sueltas: cada parte stock −= cant_por_unidad × resto
-- Si falta algo, NO modifica nada y devuelve { ok: false, faltantes: [...] }.
-- -------------------------------------------------------------
create or replace function armar_caja(p_caja uuid, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caja       cajas%rowtype;
  v_inst       record;
  v_parte      record;
  v_faltantes  text[] := '{}';
  v_cant_inst  int := 0;
  v_usa_arm    int;
  v_resto      int;
  v_necesita   int;
  v_tiene_partes boolean;
begin
  if not es_usuario() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_caja from cajas where id = p_caja for update;
  if not found then raise exception 'Caja inexistente'; end if;

  -- Bloqueo en orden: instrumentales y después partes
  perform 1 from instrumentales where caja_id = p_caja order by id for update;
  perform 1 from partes p join instrumentales i on i.id = p.instrumental_id
   where i.caja_id = p_caja order by p.id for update of p;

  -- 1) Verificar
  for v_inst in select * from instrumentales where caja_id = p_caja order by orden, codigo loop
    v_cant_inst := v_cant_inst + 1;
    if v_inst.tipo = 'simple' then
      if v_inst.stock_terminado < v_inst.cant_por_caja then
        v_faltantes := v_faltantes || format('%s %s: hay %s de %s', v_inst.codigo, v_inst.nombre,
                                             v_inst.stock_terminado, v_inst.cant_por_caja);
      end if;
    else
      if v_inst.tipo = 'medidas' then
        v_resto := v_inst.cant_por_caja;
      else
        v_resto := v_inst.cant_por_caja - least(v_inst.unidades_armadas, v_inst.cant_por_caja);
      end if;
      if v_resto > 0 then
        select exists (select 1 from partes where instrumental_id = v_inst.id) into v_tiene_partes;
        if not v_tiene_partes then
          v_faltantes := v_faltantes || format('%s %s: sin %s cargadas', v_inst.codigo, v_inst.nombre,
                                               case when v_inst.tipo = 'medidas' then 'medidas' else 'partes' end);
        end if;
        for v_parte in select * from partes where instrumental_id = v_inst.id order by orden loop
          v_necesita := v_parte.cant_por_unidad * v_resto;
          if v_parte.stock < v_necesita then
            v_faltantes := v_faltantes || format('%s %s · %s: hay %s de %s', v_inst.codigo, v_inst.nombre,
                                                 v_parte.codigo_o_medida, v_parte.stock, v_necesita);
          end if;
        end loop;
      end if;
    end if;
  end loop;

  if v_cant_inst = 0 then
    v_faltantes := array['La caja no tiene instrumentales cargados'];
  end if;
  if array_length(v_faltantes, 1) > 0 then
    return jsonb_build_object('ok', false, 'faltantes', to_jsonb(v_faltantes), 'cajas_armadas', v_caja.cajas_armadas);
  end if;

  -- 2) Descontar
  for v_inst in select * from instrumentales where caja_id = p_caja order by orden, codigo loop
    if v_inst.tipo = 'simple' then
      update instrumentales set stock_terminado = stock_terminado - v_inst.cant_por_caja where id = v_inst.id;
      perform _registrar_movimiento(p_caja, v_inst.id, null, 'stock_terminado', -v_inst.cant_por_caja,
                                    v_inst.stock_terminado - v_inst.cant_por_caja, 'armado_caja', p_nota);
    else
      if v_inst.tipo = 'medidas' then
        v_resto := v_inst.cant_por_caja;
      else
        v_usa_arm := least(v_inst.unidades_armadas, v_inst.cant_por_caja);
        v_resto   := v_inst.cant_por_caja - v_usa_arm;
        if v_usa_arm > 0 then
          update instrumentales set unidades_armadas = unidades_armadas - v_usa_arm where id = v_inst.id;
          perform _registrar_movimiento(p_caja, v_inst.id, null, 'unidades_armadas', -v_usa_arm,
                                        v_inst.unidades_armadas - v_usa_arm, 'armado_caja', p_nota);
        end if;
      end if;
      if v_resto > 0 then
        for v_parte in select * from partes where instrumental_id = v_inst.id order by orden loop
          v_necesita := v_parte.cant_por_unidad * v_resto;
          update partes set stock = stock - v_necesita where id = v_parte.id;
          perform _registrar_movimiento(p_caja, v_inst.id, v_parte.id, 'stock_parte', -v_necesita,
                                        v_parte.stock - v_necesita, 'armado_caja', p_nota);
        end loop;
      end if;
    end if;
  end loop;

  update cajas set cajas_armadas = cajas_armadas + 1 where id = p_caja;
  perform _registrar_movimiento(p_caja, null, null, 'cajas_armadas', 1, v_caja.cajas_armadas + 1, 'armado_caja', p_nota);

  return jsonb_build_object('ok', true, 'faltantes', '[]'::jsonb, 'cajas_armadas', v_caja.cajas_armadas + 1);
end;
$$;

-- -------------------------------------------------------------
-- entregar_caja: resta 1 caja armada (entrega / venta). Solo baja el contador.
-- motivo 'correccion' solo lo puede usar el admin.
-- -------------------------------------------------------------
create or replace function entregar_caja(
  p_caja   uuid,
  p_motivo motivo_movimiento default 'entrega',
  p_nota   text default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caja cajas%rowtype;
begin
  if not es_usuario() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_motivo not in ('entrega', 'correccion') then
    raise exception 'Motivo inválido';
  end if;
  if p_motivo = 'correccion' and not es_admin() then
    raise exception 'Solo el admin puede corregir el contador' using errcode = '42501';
  end if;

  select * into v_caja from cajas where id = p_caja for update;
  if not found then raise exception 'Caja inexistente'; end if;
  if v_caja.cajas_armadas <= 0 then
    raise exception 'No hay cajas armadas en stock';
  end if;

  update cajas set cajas_armadas = cajas_armadas - 1 where id = p_caja;
  perform _registrar_movimiento(p_caja, null, null, 'cajas_armadas', -1, v_caja.cajas_armadas - 1, p_motivo, p_nota);
  return v_caja.cajas_armadas - 1;
end;
$$;

revoke all on function ajustar_stock(uuid, text, int, uuid, motivo_movimiento, text) from public, anon;
revoke all on function armar_caja(uuid, text) from public, anon;
revoke all on function entregar_caja(uuid, motivo_movimiento, text) from public, anon;
grant execute on function ajustar_stock(uuid, text, int, uuid, motivo_movimiento, text) to authenticated;
grant execute on function armar_caja(uuid, text) to authenticated;
grant execute on function entregar_caja(uuid, motivo_movimiento, text) to authenticated;
