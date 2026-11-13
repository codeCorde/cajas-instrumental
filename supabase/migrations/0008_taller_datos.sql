-- =============================================================
-- 0008 · Datos iniciales de la app nueva (esquema taller)
--
-- Catálogo armado a partir de las carpetas de planos del taller. Todo el stock en 0,
-- cant_por_caja = 1 y a_confirmar = true, para que el dueño lo revise desde la web.
-- Se pasan desde la app anterior (esquema public): las cajas (mismos id), los 100 archivos
-- ya subidos (mismo bucket "planos", no se copia nada), las personas, tareas, novedades y chat.
-- Se puede correr una sola vez (falla si ya hay cajas en taller).
-- =============================================================

do $$ begin
  if exists (select 1 from taller.cajas) then raise exception 'taller ya tiene datos: esta migración se corre una sola vez'; end if;
end $$;

-- ---------------- cajas (se conservan los id de la app anterior si existen) ----------------
insert into taller.cajas (id, codigo, nombre, descripcion, orden)
select coalesce((select id from public.cajas where numero = v.numero), gen_random_uuid()), v.codigo, v.nombre, v.descripcion, v.numero
from (values
  (1, 'DM',  'Caja Doble Movilidad', 'Instrumental para cotilo de doble movilidad.'),
  (2, 'CHM', 'Caja Charnley-Muller', 'Instrumental para tallos Charnley y Muller.'),
  (3, 'TRI', 'Caja Tricónico',       'Instrumental para tallos tricónicos.')
) as v (numero, codigo, nombre, descripcion);

-- ---------------- catálogo ----------------
create temp table _cat (
  codigo text, nombre text, alias text, tipo text, cajas text[], componentes text[], descripcion text, orden int
);

insert into _cat values
  -- compartidos
  ('COM-01', 'Probador de componente cefálico', 'Cabeza de prueba', 'medidas', '{DM,TRI,CHM}', '{Ø28,Ø32}', null, 1),
  ('COM-02', 'Mango de fresa', null, 'complejo', '{DM,CHM}', '{1/4,2/4,3/4,4/4}', null, 2),
  ('COM-03', 'Cureta de cadera', null, 'simple', '{TRI,CHM}', null, null, 3),
  ('COM-04', 'Escopio para cajón', null, 'simple', '{TRI,CHM}', null, null, 4),
  ('COM-05', 'Impactor de cabeza', null, 'simple', '{TRI,CHM}', null, null, 5),
  ('COM-06', 'Palanca dislocadora', null, 'complejo', '{TRI,CHM}', '{1/2,2/2}', null, 6),
  ('COM-07', 'Probador de tapón endomedular', null, 'complejo', '{TRI,CHM}', '{Probador,Mango,Mango en T}', null, 7),
  -- Doble Movilidad
  ('DM-01', 'Colocador de cúpula doble movilidad', null, 'medidas', '{DM}', '{Ø44,Ø46,Ø48,Ø50,Ø52,Ø54,Ø56,Ø58,Ø60,Ø62}', 'Medidas Ø44 a Ø62 a confirmar. Existe un "Modelo IP".', 10),
  ('DM-02', 'Mango para colocador de cúpula', null, 'simple', '{DM}', null, null, 11),
  ('DM-03', 'Probador de cotilo', 'Probador de cúpula', 'medidas', '{DM}', '{Ø44,Ø46,Ø48,Ø50,Ø52,Ø54,Ø56,Ø58,Ø60,Ø62}', 'Medidas Ø44 a Ø62 a confirmar.', 12),
  ('DM-04', 'Probador de liner', 'Para cúpula doble movilidad', 'medidas', '{DM}', '{}', 'Medidas a definir.', 13),
  ('DM-05', 'Fresas acetabulares', null, 'medidas', '{DM}', '{Ø44,Ø46,Ø48,Ø50,Ø52,Ø54,Ø56,Ø58,Ø60,Ø62}', 'Medidas Ø44 a Ø62 a confirmar.', 14),
  ('DM-06', 'Extractor de liner', 'Para cúpula doble movilidad', 'complejo', '{DM}', '{1/5|Mango,2/5|Varilla,3/5|Mandíbula superior,4/5|Mandíbula inferior,5/5|Tornillo}', null, 15),
  ('DM-07', 'Prensa', 'Prensita', 'complejo', '{DM}', '{Base plástica,Pie de rey con H,Tornillo,Puente,Cilindro,Varilla roscada}', null, 16),
  ('DM-08', 'Plástico cóncavo', 'Para impactores', 'simple', '{DM}', null, null, 17),
  ('DM-09', 'Plástico convexo', 'Para impactores', 'simple', '{DM}', null, null, 18),
  ('DM-10', 'Empujador', null, 'simple', '{DM}', null, null, 19),
  -- Tricónico
  ('TRI-01', 'Calisuar en T', null, 'medidas', '{TRI}', '{Ø12,Ø16}', null, 30),
  ('TRI-02', 'Colocador de tallo tricónico', null, 'complejo', '{TRI}', '{1/3,2/3,3/3}', null, 31),
  ('TRI-03', 'Mango para raspas', null, 'complejo', '{TRI}', '{1/4,2/4,3/4,4/4}', null, 32),
  ('TRI-04', 'Raspas para tallos tricónicos', null, 'medidas', '{TRI}', '{}', 'Medidas a definir.', 33),
  ('TRI-05', 'Probador de cono para tallos tricónicos', null, 'simple', '{TRI}', null, null, 34),
  ('TRI-06', 'Llave Allen 5/32"', null, 'simple', '{TRI}', null, 'Posible tercerizado. Según el archivo, entra también la llave de 4 mm.', 35),
  -- Charnley-Muller
  ('CHM-01', 'Raspa Muller', null, 'medidas', '{CHM}', '{N°7.5,N°10,N°12.5,N°15,N°17.5,N°20}', null, 50),
  ('CHM-02', 'Broca con tope', null, 'complejo', '{CHM}', '{1/3,2/3,3/3}', null, 51),
  ('CHM-03', 'Perno para raspa', null, 'simple', '{CHM}', null, null, 52),
  ('CHM-04', 'Tirabuzón de Putti', null, 'simple', '{CHM}', null, null, 53),
  ('CHM-05', 'Llave Allen 2.5', null, 'simple', '{CHM}', null, 'Posible tercerizado.', 54);

insert into taller.instrumentales (codigo, nombre, alias, tipo, descripcion, a_confirmar, orden)
select codigo, nombre, alias, tipo, descripcion, true, orden from _cat;

-- Componentes: "1/5|Mango" → código 1/5, nombre Mango. Las medidas no llevan nombre.
insert into taller.componentes (instrumental_id, clase, codigo_o_medida, nombre, cant_por_unidad, orden)
select i.id,
       case when c.tipo = 'medidas' then 'medida' else 'pieza' end,
       split_part(x.comp, '|', 1),
       nullif(split_part(x.comp, '|', 2), ''),
       1, x.n
from _cat c
join taller.instrumentales i on i.codigo = c.codigo
cross join lateral unnest(coalesce(c.componentes, '{}')) with ordinality as x (comp, n);

-- Composición: cada instrumental en sus cajas, cant_por_caja = 1
insert into taller.composicion_caja (caja_id, instrumental_id, cant_por_caja, orden)
select cj.id, i.id, 1, c.orden
from _cat c
join taller.instrumentales i on i.codigo = c.codigo
cross join lateral unnest(c.cajas) as x (cod)
join taller.cajas cj on cj.codigo = x.cod;

-- ---------------- bandeja Sin clasificar ----------------
insert into taller.sin_clasificar (caja_id, nombre, nota)
select cj.id, v.nombre, v.nota
from (values
  ('CHM', '1', 'Pieza sin rótulo en el plano de la caja (nombre provisorio).'),
  ('CHM', '2', 'Pieza sin rótulo en el plano de la caja (nombre provisorio).'),
  ('CHM', 'Acople', 'Pieza sin rótulo en el plano de la caja.'),
  ('CHM', 'Guía de mecha', 'Pieza sin rótulo en el plano de la caja.'),
  ('CHM', 'Mango colocador', 'Pieza sin rótulo en el plano de la caja.'),
  ('CHM', 'Mecha flexible', 'Pieza sin rótulo en el plano de la caja.'),
  ('CHM', 'Perno', 'Pieza sin rótulo en el plano de la caja.'),
  ('CHM', 'Probadores', 'Pieza sin rótulo en el plano de la caja.'),
  ('DM',  'Impactor de cabeza (cúpula doble movilidad)', 'Tiene planos en la carpeta de Doble Movilidad pero no figura en el listado de la caja. ¿Va con los plásticos cóncavo/convexo?')
) as v (caja, nombre, nota)
join taller.cajas cj on cj.codigo = v.caja;

-- ---------------- archivos: los planos ya subidos ----------------
-- Equivalencia: (número de caja anterior, código anterior) → instrumental nuevo o bandeja.
create temp table _eq (numero int, codigo_viejo text, codigo_nuevo text, sin_clasificar text);
insert into _eq values
  (1, '1.1', 'DM-01', null), (1, '1.2', 'DM-10', null), (1, '1.3', 'DM-06', null), (1, '1.4', 'DM-05', null),
  (1, '1.5', null, 'Impactor de cabeza (cúpula doble movilidad)'), (1, '1.6', 'COM-02', null), (1, '1.7', 'DM-07', null),
  (1, '1.8', 'COM-01', null), (1, '1.9', 'DM-03', null), (1, '1.10', 'DM-04', null),
  (2, '2.1', 'CHM-02', null), (2, '2.2', 'COM-03', null), (2, '2.3', 'COM-04', null), (2, '2.4', 'COM-05', null),
  (2, '2.5', 'CHM-05', null), (2, '2.6', 'COM-02', null), (2, '2.7', 'COM-06', null), (2, '2.8', 'CHM-03', null),
  (2, '2.9', 'COM-01', null), (2, '2.10', 'COM-07', null), (2, '2.11', 'CHM-01', null), (2, '2.12', 'CHM-04', null),
  (2, '2.13', null, 'Acople'), (2, '2.14', null, 'Guía de mecha'), (2, '2.15', null, 'Mango colocador'),
  (2, '2.16', null, 'Mecha flexible'), (2, '2.17', null, 'Perno'), (2, '2.18', null, 'Probadores'),
  (2, '2.19', null, '1'), (2, '2.20', null, '2'),
  (3, '3.1', 'TRI-01', null), (3, '3.2', 'TRI-02', null), (3, '3.3', 'COM-03', null), (3, '3.4', 'COM-04', null),
  (3, '3.5', 'COM-05', null), (3, '3.6', 'TRI-06', null), (3, '3.7', 'TRI-03', null), (3, '3.8', 'COM-06', null),
  (3, '3.9', 'COM-01', null), (3, '3.10', 'TRI-05', null), (3, '3.11', 'COM-07', null), (3, '3.12', 'TRI-04', null);

insert into taller.archivos (entidad, entidad_id, nombre, tipo, tamano, storage_path, subido_por, creado_en)
select
  case when p.instrumental_id is null then 'caja'
       when e.codigo_nuevo is not null then 'instrumental'
       else 'sin_clasificar' end,
  case when p.instrumental_id is null then p.caja_id
       when e.codigo_nuevo is not null then
         -- el PDF del mango del colocador va al instrumental "Mango para colocador de cúpula"
         case when e.codigo_nuevo = 'DM-01' and p.nombre ilike 'Mango para colocador%'
              then (select id from taller.instrumentales where codigo = 'DM-02')
              else (select id from taller.instrumentales where codigo = e.codigo_nuevo) end
       else (select s.id from taller.sin_clasificar s join taller.cajas cj on cj.id = s.caja_id
             where s.nombre = e.sin_clasificar and cj.orden = c.numero) end,
  p.nombre, p.formato, p.tamano, p.ruta, 'Importación inicial', p.creado_en
from public.planos p
join public.cajas c on c.id = p.caja_id
left join public.instrumentales iv on iv.id = p.instrumental_id
left join _eq e on e.numero = c.numero and e.codigo_viejo = iv.codigo
where p.instrumental_id is null or e.numero is not null;

-- ---------------- personas, tareas, novedades y chat de la app anterior ----------------
insert into taller.personas (nombre)
select distinct on (lower(n)) n from (
  select trim(coalesce(nullif(nombre, ''), split_part(email, '@', 1))) n from public.perfiles
) x where n <> ''
on conflict do nothing;

insert into taller.tareas (titulo, detalle, medico, caja_id, prioridad, hecha, hecha_en, hecha_por, creado_por, creado_en)
select t.titulo, t.detalle, t.medico, (select id from taller.cajas where id = t.caja_id), t.prioridad::text,
       t.hecha, t.hecha_en, t.hecha_por_nombre, t.creado_por_nombre, t.creado_en
from public.tareas t;

insert into taller.novedades (creado_en, autor, origen, seccion, titulo, detalle)
select creado_en, coalesce(autor_nombre, 'Sistema'), origen, seccion, titulo, detalle
from public.novedades order by id;

insert into taller.mensajes (autor, texto, creado_en)
select coalesce(autor_nombre, 'Sin nombre'), texto, creado_en from public.mensajes order by id;

-- ---------------- configuración y plantilla de calidad ----------------
insert into taller.config (clave, valor) values
  ('apariencia', '{"empresa": "Cajas de Instrumental", "color": "#1d4f7c", "logo_path": null, "modo": "auto"}'),
  ('calidad', '{"motivos": ["Medida fuera de tolerancia", "Rebabas", "Terminación superficial", "Grabado ilegible", "Falta de pieza", "Material incorrecto"]}');

insert into taller.plantillas_calidad (nombre, items) values
  ('Control general', '["Sin rebabas ni filos", "Terminación superficial pareja", "Grabado legible", "Medidas según plano", "Encastre / armado correcto", "Limpio y sin restos de aceite"]');

-- ---------------- novedad de la migración ----------------
insert into taller.novedades (autor, origen, seccion, titulo, detalle) values
  ('Claude', 'claude', 'codigo', 'Nueva versión de la app',
   'Catálogo único de instrumental con stock compartido entre cajas, ingreso con contraseña única, pestañas Conteo, Instrumental, Stock, QR del taller, pedidos, control de calidad y configuración. El catálogo se precargó con stock en 0 y marcado "A confirmar".');

drop table _cat;
drop table _eq;
