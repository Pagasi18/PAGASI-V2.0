# PAGASI v2.0

Sistema de gestión de créditos de motocicletas: clientes, inventario, créditos,
pagos, cobranza, contratos, comisiones, cuentas y reportes.

App web (HTML/CSS/JS vanilla) sobre Firebase (Firestore + Auth + Storage).

---

## Inicio rápido

- **Punto de entrada:** `admin.html`
- **Núcleo del sistema:** `assets/pagasi-app.js` (estado, router, base de datos)
- **Estilos:** `assets/pagasi.css`
- **Vistas:** carpeta `modules/`  ·  **Lógica:** carpeta `logic/`

## Documentación

- **`docs/ARQUITECTURA.md`** — cómo está organizado todo, cómo se comunica,
  cómo agregar módulos y trabajar sin romper nada. **Empieza por aquí.**
- **`docs/SEGURIDAD.md`** — reglas de Firestore, roles y buenas prácticas.

## Para hacer cambios (resumen)

1. Identifica si tocas una **vista** (`modules/`) o **lógica** (`logic/`).
2. Valida sintaxis: `node -c ruta/al/archivo.js`
3. Si tocaste cálculos de dinero, corre los tests:
   `node tests/credito-ledger.test.js` y `node tests/financial-audit.test.js`
4. Al subir a GitHub: **sube la carpeta completa**, no archivos sueltos.
5. Si cambiaste el CSS, sube la versión del `?v=` en `admin.html`.

## Recordatorios importantes

- El **sidebar y el dashboard** se generan por JavaScript, no desde el HTML
  estático. Para cambiarlos, edita el JS (`pagasi-app.js` / `modules/dash.js`).
- La **seguridad real** está en las Reglas de Firestore (servidor), no en el
  control de roles del JavaScript (que es solo visual).
- Las llaves de Firebase en el código son **públicas por diseño**, no son un secreto.
