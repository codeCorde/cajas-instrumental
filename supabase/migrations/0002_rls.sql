-- =============================================================
-- 0002 · Permisos y Row Level Security
--
-- Reglas:
--  * Cualquier usuario logueado LEE cajas, instrumentales, partes y notas.
--  * Solo el admin crea / edita / borra la estructura.
--  * NADIE (ni el admin) cambia el stock con UPDATE directo: las columnas de stock
--    no tienen permiso de escritura. El stock solo se modifica con las funciones RPC
--    de 0003, que registran el movimiento en la misma transacción.
--  * El historial (movimientos) no se edita ni se borra; solo el admin lo lee.
-- =============================================================

create or replace function es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function es_usuario()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfiles where id = auth.uid());
$$;

alter table perfiles       enable row level security;
alter table cajas          enable row level security;
alter table instrumentales enable row level security;
alter table partes         enable row level security;
alter table notas          enable row level security;
alter table movimientos    enable row level security;

-- Sin acceso anónimo a nada
revoke all on perfiles, cajas, instrumentales, partes, notas, movimientos from anon;

-- ---------------- perfiles ----------------
create policy perfiles_select on perfiles for select to authenticated
  using (id = auth.uid() or es_admin());
create policy perfiles_update_admin on perfiles for update to authenticated
  using (es_admin()) with check (es_admin());
revoke insert, update, delete on perfiles from authenticated;
grant update (nombre, rol) on perfiles to authenticated;

-- ---------------- cajas ----------------
create policy cajas_select on cajas for select to authenticated using (es_usuario());
create policy cajas_insert on cajas for insert to authenticated with check (es_admin());
create policy cajas_update on cajas for update to authenticated using (es_admin()) with check (es_admin());
create policy cajas_delete on cajas for delete to authenticated using (es_admin());
revoke insert, update on cajas from authenticated;
grant insert (numero, nombre, foto_url, activa) on cajas to authenticated;
grant update (numero, nombre, foto_url, activa) on cajas to authenticated;  -- cajas_armadas: solo RPC

-- ---------------- instrumentales ----------------
create policy instr_select on instrumentales for select to authenticated using (es_usuario());
create policy instr_insert on instrumentales for insert to authenticated with check (es_admin());
create policy instr_update on instrumentales for update to authenticated using (es_admin()) with check (es_admin());
create policy instr_delete on instrumentales for delete to authenticated using (es_admin());
revoke insert, update on instrumentales from authenticated;
grant insert (caja_id, codigo, nombre, alias, tipo, cant_por_caja, material, terminacion, barra,
              origen, proveedor, foto_url, link_2d, link_3d, link_cnc, link_fotos, orden)
  on instrumentales to authenticated;
grant update (codigo, nombre, alias, tipo, cant_por_caja, material, terminacion, barra,
              origen, proveedor, foto_url, link_2d, link_3d, link_cnc, link_fotos, orden)
  on instrumentales to authenticated;  -- stock_terminado / unidades_armadas: solo RPC

-- ---------------- partes ----------------
create policy partes_select on partes for select to authenticated using (es_usuario());
create policy partes_insert on partes for insert to authenticated with check (es_admin());
create policy partes_update on partes for update to authenticated using (es_admin()) with check (es_admin());
create policy partes_delete on partes for delete to authenticated using (es_admin());
revoke insert, update on partes from authenticated;
grant insert (instrumental_id, codigo_o_medida, nombre, cant_por_unidad, nota, orden) on partes to authenticated;
grant update (codigo_o_medida, nombre, cant_por_unidad, nota, orden) on partes to authenticated;  -- stock: solo RPC

-- ---------------- notas ----------------
create policy notas_select on notas for select to authenticated using (es_usuario());
create policy notas_insert on notas for insert to authenticated with check (es_admin());
create policy notas_update on notas for update to authenticated using (es_admin()) with check (es_admin());
create policy notas_delete on notas for delete to authenticated using (es_admin());

-- ---------------- movimientos ----------------
create policy movimientos_select_admin on movimientos for select to authenticated using (es_admin());
-- Sin políticas de insert/update/delete: solo las RPC (security definer) escriben.
revoke insert, update, delete, truncate on movimientos from authenticated;
