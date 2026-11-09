-- =============================================================
-- Datos de ejemplo. Correr DESPUÉS de las 3 migraciones (SQL Editor de Supabase).
-- Los registros de ejemplo quedan con ejemplo = true y se ven con la etiqueta "Ejemplo".
-- Se puede correr de nuevo: borra y vuelve a crear las 3 cajas.
-- =============================================================

delete from cajas where numero in (1, 2, 3);

with c1 as (
  insert into cajas (numero, nombre, ejemplo) values (1, 'Caja Doble Movilidad', true) returning id
),
ins as (
  insert into instrumentales
    (caja_id, codigo, nombre, tipo, cant_por_caja, stock_terminado, material, terminacion, origen, proveedor, link_2d, orden, ejemplo)
  select c1.id, v.codigo, v.nombre, v.tipo::tipo_instrumental, v.cpc, v.stock, v.material, v.terminacion,
         v.origen::origen_fabricacion, v.proveedor, v.link_2d, v.orden, true
  from c1, (values
    ('1.1',  'Probador de cúpula',   'medidas',  1, 0, 'Acero inox. 420', 'Pulido',   'propio',      null,              null, 1),
    ('1.2',  'Mango impactor',       'complejo', 1, 0, 'Acero inox. 304', 'Arenado',  'propio',      null,              null, 2),
    ('1.3',  'Plástico convexo',     'simple',   2, 1, 'POM (Delrin)',    null,       'tercerizado', 'Proveedor de ejemplo', null, 3),
    ('1.4',  'Plástico cóncavo',     'simple',   1, 0, 'POM (Delrin)',    null,       'tercerizado', 'Proveedor de ejemplo', null, 4),
    ('1.5',  'Colocadores Rojos DM', 'medidas',  2, 0, 'Aluminio',        'Anodizado rojo', 'propio', null, 'https://drive.google.com/', 5),
    ('1.6',  'Liner DM',             'medidas',  1, 0, null,              null,       'propio',      null,              null, 6),
    ('1.7',  'Prensa',               'complejo', 1, 0, null,              null,       'propio',      null,              null, 7),
    ('1.8',  'Cabeza de prueba',     'medidas',  1, 0, null,              null,       'propio',      null,              null, 8),
    ('1.9',  'Mango de fresas',      'complejo', 1, 0, null,              null,       'propio',      null,              null, 9),
    ('1.10', 'Fresas acetabulares',  'medidas',  1, 0, null,              null,       'propio',      null,              null, 10)
  ) as v(codigo, nombre, tipo, cpc, stock, material, terminacion, origen, proveedor, link_2d, orden)
  returning id, codigo
)
insert into partes (instrumental_id, codigo_o_medida, cant_por_unidad, stock, orden, ejemplo)
select ins.id, m.medida, 1, m.stock, m.orden, true
from ins
join (values
  ('Ø44', 4, 1), ('Ø46', 3, 2), ('Ø48', 2, 3), ('Ø50', 5, 4), ('Ø52', 1, 5),
  ('Ø54', 2, 6), ('Ø56', 3, 7), ('Ø58', 0, 8), ('Ø60', 2, 9)
) as m(medida, stock, orden) on ins.codigo = '1.5';

-- Una nota de ejemplo
insert into notas (instrumental_id, tipo, texto, creado_por)
select id, 'Proceso', 'Anodizar en tandas de 9 (un juego completo). Verificar color con la muestra patrón.', null
from instrumentales where codigo = '1.5' and ejemplo;

insert into cajas (numero, nombre) values (2, 'Caja 2'), (3, 'Caja 3');
