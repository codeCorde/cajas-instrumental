# Decisiones y supuestos

1. **Diferencias con el Excel (a propósito).** En el Excel, a «Probador de cúpula» le faltan las fórmulas de
   «Juegos que alcanza» en las filas Ø44–Ø60, por eso marca 7 juegos aunque Ø44 y Ø46 estén en 0. Además, la
   sub-tabla de «Fresas acetabulares» está pisada sobre las filas de piezas de «Mango de fresas». La web calcula
   con la regla correcta (lo limita la medida que menos hay) y cada medida/parte pertenece a un solo instrumental.
2. **Seed.** Se usaron los datos de ejemplo del pedido, no los del Excel: 1.5 Colocadores tiene Ø44–Ø60 con stock
   variado (da «Falta: Ø52, Ø58»), y el resto de los Medidas/Complejo arrancan sin medidas/partes.
   El material, la terminación y el proveedor de ejemplo son inventados y están marcados como «Ejemplo».
3. **Estado «Sin partes cargadas».** Lo tiene un Medidas sin medidas, o un Complejo sin partes **y** sin unidades
   armadas. Un Complejo con unidades armadas se evalúa normal aunque no tenga partes definidas.
   Se cuenta aparte en el resumen (no suma como «Falta»).
4. **Cant. por caja ≥ 1** obligatoria en la base (el Excel la dejaba vacía con un aviso).
5. **El stock solo cambia por RPC.** Las columnas de stock no tienen permiso de `UPDATE` para nadie; las RPC
   (`security definer`) bloquean las filas (`FOR UPDATE`), cambian el stock y registran el movimiento en la misma
   transacción. Si piden −10 y hay 3, baja a 0 y el historial registra −3.
6. **Armado de caja.** Se verifica todo y, si falta algo, no se toca nada. Con stock suficiente se descuenta según la
   regla pedida y se generan movimientos con motivo «Armado de caja». Entregar solo baja el contador.
   «Corrección» del contador solo la puede usar el admin.
7. **Historial.** Guarda una copia de los nombres (usuario, caja, instrumental, parte) para que siga legible aunque
   se borre o renombre algo. Solo el admin lo ve; nadie lo puede editar ni borrar (sin políticas ni permisos).
8. **Fechas** del historial y filtros en hora de Argentina (UTC−3).
9. **Usuarios.** Todo usuario nuevo nace operario (el rol nunca se toma de lo que manda el registro). El admin puede
   invitar por email o crear el usuario con una contraseña inicial (útil si el SMTP de prueba de Supabase limita
   los envíos). Para eso hace falta `SUPABASE_SERVICE_ROLE_KEY`, que solo se usa en el servidor.
10. **Cambio de tipo** de instrumental: advierte, pero no borra medidas/partes ni stock; quedan guardadas.
11. **Borrado de cajas/instrumentales:** borra en cascada estructura y notas; el historial se conserva.
    Para ocultar una caja sin perder nada está el check «Activa».
12. **Optimismo en los + / −.** Se aplica al instante; si la RPC falla se revierte y se muestra el error. Con varios
    toques seguidos, al terminar el último se toma el valor que devuelve la base (por si otro operario cargó a la vez).
13. **CSV** con separador `;` y BOM, para que Excel en español lo abra con acentos y columnas bien.
14. **Versiones:** Next.js 15.5 y Vitest 3.2 (Vitest 4 hace fallar `npm install` por un bug de dependencias de npm 10).
15. **Planos en Supabase Storage**, no en Drive: bucket privado con links firmados de 10 minutos, así un link copiado no
    queda abierto para siempre. El navegador los sube directo a Storage (Vercel limita a 4,5 MB lo que pasa por el
    servidor). Al borrar un instrumental o una caja se borran también sus archivos.
16. **Carga de las 3 cajas** (`scripts/importar-cajas.mjs`): una subcarpeta = un instrumental, con todas sus hojas
    como planos. Los archivos de una serie de medidas (Raspas Muller N°7,5–20, Probador cefálico Ø28/Ø32, Calisuar
    Ø12/Ø16) se cargaron como un instrumental tipo Medidas. El stock arranca en 0 y la cantidad por caja en 1.
    En la Caja Doble Movilidad los planos se asociaron a los instrumentales que ya existían cuando el nombre coincidía
    o era equivalente (Probador de cotilo → 1.1 Probador de cúpula, Impactor de cabeza → 1.2 Mango impactor,
    Colocador → 1.5, Probador de liner → 1.6 Liner DM, Probador cefálico → 1.8 Cabeza de prueba); el nombre del plano
    quedó como alias. Los DWG de la caja completa quedaron como «Plano de la caja».

---

## App nueva (esquema `taller`, migraciones 0007–0008)

1. **Esquema aparte.** La app nueva vive en el esquema `taller` de la misma base; `public` (0001–0006) quedó intacto para
   que la versión anterior siguiera andando hasta publicar. Se puede borrar más adelante con una migración.
2. **Sin Supabase Auth.** Contraseña única (bcrypt, guardada en base64 porque los `$` se rompen en los `.env`) + nombre
   elegido, en una cookie firmada con `jose` por 30 días. No hay roles: cualquiera con la contraseña puede todo.
3. **Base cerrada.** Las tablas de `taller` no tienen permisos para `anon`/`authenticated`; el servidor usa la service_role.
   Por eso el chat se actualiza preguntando cada 4 s (no hay Realtime desde el navegador) y los archivos se suben con
   links firmados de Storage.
4. **Catálogo inicial** (0008): el del pedido, con stock en 0, `cant_por_caja = 1` y «A confirmar». Códigos: `COM-xx`
   compartidos, `DM-xx`, `TRI-xx`, `CHM-xx`. Las cajas conservan sus id (los QR viejos de `/cargar/<id>` ya no existen:
   hay que imprimir los nuevos de `/taller/<código>`).
5. **Planos de la app anterior:** los 100 archivos quedaron vinculados a su instrumental nuevo sin volver a subirlos.
   El «Impactor de cabeza (cúpula doble movilidad)» no figura en el listado de la caja DM: quedó en «Sin clasificar».
   El PDF del mango del colocador fue a «Mango para colocador de cúpula».
6. **Medidas y piezas a confirmar:** Colocador, Probador de cotilo y Fresas con Ø44–Ø62 de a 2; Probador de liner y Raspas
   tricónicas sin medidas (quedan «Sin definir» hasta cargarlas).
7. **Desarmar caja** devuelve los complejos como **unidades armadas** (no se desarman en piezas).
8. **Stock que no baja de 0:** un − mayor que el stock deja 0 y el historial registra lo que realmente bajó.
9. **Foto** del instrumental y de la caja = la primera imagen vigente de sus archivos (no hay un campo aparte).
10. **Procesos con formato básico** se escriben como texto con marcas simples (`## título`, `1. paso`, `- viñeta`, `**negrita**`)
    y se muestran armados; nunca se guarda HTML.
11. **Fuera de alcance (preparado):** usuarios con permisos, visor 3D/DWG, QR por pieza, CNC, importación de Excel, clientes y facturación.

---

## Pedidos por QR y órdenes de producción (migración 0009)

Basado en las fotos de las carpetas «Realizar pedidos» y «Órdenes de producción».

1. **`/pedir` es público.** El solicitante no tiene la contraseña del equipo. Para que sea seguro: solo crea pedidos
   «por recepcionar» por RPC (`crear_pedido`, transaccional), no muestra stock, limita a 10 pedidos por hora por IP y la
   firma tiene que ser un PNG chico. Ver y cancelar el pedido se hace con un **token** al azar (link secreto), no con el número.
   Las fotos de las cajas se sirven solo si son imágenes de una caja (`/pedir/foto/<id>`).
2. **Pedido por pieza, no por caja.** Tabla nueva `pedido_piezas` (instrumental + caja desde la que se eligió). Los pedidos
   viejos por caja (`pedido_items`) siguen andando: al finalizar descuentan cajas armadas.
3. **Estados sin cambiar la base.** Se reusan los valores (`pendiente`, `en_produccion`, `listo`, `entregado`, `cancelado`)
   con etiquetas nuevas: Por recepcionar, En producción, **Finalizado** (naranja), **Entregado** (verde), Cancelado.
4. **Pieza terminada** = simple: stock terminado · set completo: juegos completos de medidas · compleja: **solo unidades
   armadas** (las piezas sueltas son «stock de partes»; para sumar una compleja terminada hay que «Armar 1», que descuenta
   1 de cada parte, como pide la foto).
5. **Finalizar descuenta, firmar entrega.** «Armar pedido» → `finalizar_pedido` descuenta las piezas terminadas (todo o nada,
   con la lista de faltantes). La firma de quien recibe (`firmar_pedido`) pasa a Entregado y habilita el remito.
   Así el listado general solo suma órdenes en producción.
6. **Cancelar** se permite desde las dos páginas hasta que se entrega. Si ya estaba finalizado, `cancelar_pedido` devuelve
   el stock y lo deja en el historial (motivo «Pedido cancelado»).
7. **Etapa del proceso** por pieza/parte: texto elegido de una lista editable (config `etapas`). No mueve stock.
8. **Máquina y herramientas** (mechas, machos) como columnas por pieza y por parte; los comentarios largos van en Notas.
   Se pueden subir programas de mecanizado (.txt, .nc, .gcode, .ngc, .tap, .cnc).
9. **Avisos**: Telegram, WhatsApp (CallMeBot) y ntfy, todos opcionales por variables de entorno. Un aviso que falla nunca
   rompe la acción. Resumen diario con Vercel Cron (`vercel.json`, 11:00 UTC = 8:00 en Argentina).
10. **Colores de la marca InstrumentARG**: «AR» negro sobre celeste y «G» dorada sobre blanco (a confirmar con el dueño).

---

## Respuestas del dueño (migración 0010)

1. **Marca:** «A» y «G» negras sobre celeste, «R» dorada sobre blanco.
2. **Quién pide:** gente de la empresa (clientas internas, operarias, supervisoras). Por eso `/pedir` ya no es público:
   necesita la clave del QR (`?k=`, en `taller.config`), que se cambia desde la app si se filtra.
3. **Sets:** se piden enteros por defecto; se pueden personalizar sacando medidas (`pedido_piezas.componente_id`).
4. **Información faltante:** `infoFaltante` (lib/calculos.ts) arma las preguntas; la pantalla «Info que falta» y los
   recordatorios las muestran. Claude las carga por `/api/claude` cuando el dueño responde (dictado, texto o fotos).
5. **Firma de recepción** en el celular del dueño: así se constata que la persona fue a buscar el material.
6. **Cancelar** en cualquier momento salvo entregado, por el solicitante o por el taller; registro en «Cancelados».
7. **Entregar parcial:** `entregar_parcial` descuenta lo elegido, guarda la entrega con su firma (`entregas`) y, si se
   completó todo, pasa a entregado. Al finalizar o cancelar solo se cuenta lo que falta entregar. La regla de descuento
   está una sola vez en SQL (`taller._necesidades`) y su espejo es `planFinalizarPedido`.
8. **Avisos:** WhatsApp (CallMeBot). Resumen 6:40 y recordatorios 9:40 / 12:40 / 15:40. Se programan con **GitHub Actions**
   (Vercel Hobby solo permite crons una vez por día y sin hora exacta). GitHub puede atrasarse unos minutos.
9. **Acceso privado:** el taller es solo para los socios y quienes ellos inviten. Invitación = link de un solo uso (7 días).
   Al ingresar con contraseña solo se elige a una persona habilitada; `quienSoy()` corta el acceso de las desactivadas.
10. **Claude carga datos** por una API con clave propia (`CLAUDE_API_TOKEN`), nunca con la service_role en su equipo.
11. **Investigación diaria** con una tarea programada de Claude: propone, el dueño aprueba con «Sí».

---

## Stock de emergencia, procesos y lo que viene (migración 0011)

1. **Stock de emergencia:** 10 cajas armadas de cada tipo como mínimo. Las órdenes de reposición (RE-…) son internas y separadas
   de los pedidos (OP-…): no usan su numeración, no piden firma y no descuentan stock. Se crean solas por lo que falta y se
   cumplen solas al volver al mínimo. Regla en SQL (`revisar_stock_emergencia`) con espejo en `faltanteEmergencia`.
2. **Procesos por pieza** (no un tiempo total): cada proceso con máquina, minutos por pieza y de preparación. Así el costeo
   futuro puede calcular piezas por hora, el costo de una parte, de una pieza compleja y de la caja completa.
3. **Lo que viene (pedido por el dueño):** app de costeo (costo de 1 pieza y producción por hora) y un agente de atención al
   cliente que arme cotizaciones a partir del pedido; si el cliente acepta precio y forma de pago, el pedido pasa a la app del
   taller para fabricar. Se usan los procesos y tiempos de esta migración.
