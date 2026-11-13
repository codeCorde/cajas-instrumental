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
