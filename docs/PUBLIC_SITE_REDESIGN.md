# Rediseño del sitio público Pagasi

Base de comparación: `4585bcf`. Implementación: septiembre de 2026.

## Alcance

Inicio, catálogo, simulador, solicitud, nosotros y presentación de Mi Cuenta. Se conserva el logo original `assets/pagasi-logo.png`, con mayor tamaño. La interfaz usa azul y blanco, componentes compartidos y navegación adaptable; no requiere compilación ni cambia el despliegue de GitHub Pages.

Los estilos y scripts nuevos están en `assets/public/`. El panel administrativo, `modules/`, `logic/`, las reglas de Firebase y las integraciones de cobranza no se modifican.

## Contratos conservados

- Los 46 IDs, precios y concesionarios del catálogo original se mantienen.
- `catalog.js` centraliza la fórmula existente del simulador: inicial del 50%, 12 meses, 24 cuotas y APY del 380%. Los resultados redondeados coinciden con el simulador anterior. La vista mensual es una equivalencia informativa; no cambia la frecuencia de pago.
- Los importes de portada y catálogo ahora se derivan de esa misma fórmula. Antes existían cifras estáticas inconsistentes entre páginas.
- Los campos, opciones, validación, evaluación, estructura del documento de solicitud, colección `clientes`, autenticación anónima, protección contra doble envío y manejo de errores permanecen iguales.
- La solicitud recibe los 46 modelos compartidos, corrigiendo la omisión anterior de los IDs 42–46 (Benmo). Catálogo, simulador y solicitud conservan el modelo por `?moto=ID`.
- El código del portal de clientes y sus dependencias son idénticos a la base: autenticación, permisos del equipo, lectura de créditos, cálculo de cuotas, gamificación y envío de comprobantes. El cambio del portal es de HTML y CSS.
- WhatsApp de ventas sigue en las páginas públicas; Mi Cuenta conserva la línea de cobranza.

## Imágenes

La portada usa una vista ilustrativa de la EK Xpress 150 Lite en tres cuartos, creada con la herramienta integrada de generación de imágenes a partir de la foto existente. Está identificada como ilustrativa; el simulador permite ver la foto real del catálogo. El logo no fue generado ni sustituido.

Archivo publicado: `assets/public/ek-xpress-hero.webp` (1254 × 1254, 185.326 bytes). Se convirtió el PNG generado a WebP con calidad 90 para reducir su peso aproximadamente un 89%, sin cambiar composición. El PNG maestro corresponde a `exec-3f2917a5-0bc7-4fcb-9a60-3216df6693fe.png` en la carpeta local de imágenes generadas de Codex.

Se conservan las fotografías reales disponibles. Los cinco modelos Benmo muestran “Fotografía por confirmar” hasta disponer de las fotos correctas; no se les asigna la imagen de otra moto.

## Validación

- `node tests/public-site.test.js`: 13 comprobaciones aprobadas, sin red. Compara los 46 planes con la fórmula original, IDs y campos, SDKs, código del portal, evaluación y payload con distintos perfiles, modelos Benmo, pasos del formulario, protección contra doble envío y reintentos ante errores.
- `node tests/credito-ledger.test.js`: aprobado.
- `node tests/financial-audit.test.js`: aprobado.
- `node tests/run.js`: 909 aprobadas y 3 fallos preexistentes en Coromoto. El resultado fue idéntico antes y después del rediseño: ER periodo (500 / 1500), ER neta (300 / 1300) y resultados acumulados (1000 / 0), expresados como esperado / obtenido. No se modificó esa lógica.
- Navegador: seis páginas revisadas a 320, 390, 768 y 1440 px, sin desbordamiento horizontal ni imágenes visibles rotas. Navegación móvil, filtros, búsqueda sin resultados, ordenamiento, cambios de modelo y equivalencia mensual comprobados.
- Recorrido completo catálogo → simulador → solicitud probado, incluidos modelos Benmo. Avanzar y retroceder en la solicitud conserva los datos. No se envían solicitudes ni SMS reales durante estas pruebas.
- Acceso del equipo revisado con `?equipo=1`. Presentación del portal con crédito y pagos revisada en escritorio y a 320 px mediante un documento temporal con datos ficticios y sin scripts de red. El documento temporal se eliminó y no se publica. No se probó una sesión real de cliente ni el envío real de comprobantes.
- Sintaxis JavaScript, enlaces locales e IDs únicos revisados; consola del navegador sin errores en las páginas públicas.

## Publicación y reversión

GitHub Pages sirve la raíz de `main`, con dominio `pagasi.io`. Las rutas existentes permanecen iguales. Los recursos nuevos llevan versión en sus URLs. Para revertir, hacer `git revert` del commit del rediseño y publicar el revert en `main`; no requiere migración de datos.
