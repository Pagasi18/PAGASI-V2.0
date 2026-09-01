# API de MiCODUS — lo que descubrimos

> Levantado el 1 de septiembre de 2026 inspeccionando la propia plataforma
> con la sesión de `info@pagasi.io`. **No es la API pública documentada**:
> son los servicios internos que usa su interfaz web. Funcionan, pero léase
> primero la sección de riesgos.

## Cuenta

| | |
|---|---|
| Usuario | `info@pagasi.io` |
| Tipo | Distributor |
| `UserID` | **139351** |
| Equipos | 500, todos modelo **MV710G** |
| Base | `https://www.micodus.net` |

Autenticación: **cookie de sesión** de ASP.NET. No hay API key ni token.

## Endpoints confirmados

Todos son `POST` con `Content-Type: application/json`. La respuesta viene
envuelta en `{"d": "..."}` y **lo de adentro es JavaScript relajado**, con
las claves sin comillas — `JSON.parse` directo falla. Hay que normalizar:

```js
const j = await r.json();
const obj = JSON.parse(j.d.replace(/([{,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":'));
```

### Lista de equipos

```
POST /Ajax/DevicesAjax.asmx/GetDevices
{UserID:139351, PageNo:1, PageCount:500, SN:'', TimeZones:'', ExpDays:0}
```

Devuelve `{nowPage, resSize, userID, devices:[...]}`. Cada equipo:

| campo | qué es |
|---|---|
| `id` | id interno de MiCODUS — **es el que pide GetTracking** |
| `sn` | serial del equipo (el "ID GPS" del Excel) |
| `model` | `MV710G` |
| `carNum` | **placa** de la moto, si se la cargaron |
| `state` | 1 = activo |
| `lock` | 0 = normal, 1 = bloqueado |
| `createDate` | alta en la plataforma |
| `activeDate` | primera activación (vacío = nunca reportó) |
| `phone`, `uname` | vacíos en nuestra cuenta |

**No devuelve IMEI ni nada de la SIM.** La plataforma recibe el IMEI al dar
de alta un equipo (`SaveDevices` lleva un campo `IMEIs`) pero nunca lo
expone al leer. De ICCID o línea no sabe nada: cero menciones en todo su
código.

### Posición en vivo

```
POST /Ajax/DevicesAjax.asmx/GetTracking
{DeviceID:521709, TimeZone:'-4'}
```

`DeviceID` es el `id` de GetDevices, **no el `sn`**. Respuesta real:

| campo | qué es | ejemplo |
|---|---|---|
| `latitude` / `longitude` | posición | `10.46842` / `-66.54793` |
| `deviceUtcDate` | cuándo reportó el equipo | `2026-09-01 22:42:07` |
| `serverUtcDate` | cuándo lo recibió el servidor | igual o poco después |
| `battery` | batería en % | `100` |
| `dy` | voltaje de la moto | `13` |
| `acc` | contacto: 0 apagado, 1 encendido | `0` |
| `speed` | km/h | `0.00` |
| `course` | rumbo en grados | `130` |
| `status` / `isStop` | `Stop` o movimiento | `Stop` / `1` |
| `dataType` | 1 = GPS, 2 = LBS (antena), 3 = WiFi | `1` |
| `satellite` / `satellitegl` / `satellitebd` | GPS / GLONASS / BeiDou | `9` / `4` / `5` |
| `signal` | señal GSM | `26` |
| `distance` | odómetro en metros | `289.8531` |

Devuelve `""` o `"{}"` si el equipo nunca reportó.

`dataType` importa para la cobranza: si es 2, la posición viene de
triangulación de antenas y puede errar cientos de metros. No sirve para
decir "la moto está en esta casa".

### Otros que existen

| endpoint | para qué |
|---|---|
| `DevicesAjax.asmx/SearchDevices2024` | buscar (no logramos dar con sus parámetros) |
| `DevicesAjax.asmx/SaveDevices` | dar de alta por IMEI |
| `DevicesAjax.asmx/UpdateSetLock` | bloquear / desbloquear |
| `DevicesAjax.asmx/ChangeDevicesUser` | mover equipos entre subcuentas |
| `ExceptionMessageAjax.asmx/GetAlarmByDevice` | alarmas por equipo |
| `UsersAjax.asmx/GetOnlineCount` | cuántos en línea |
| `UsersAjax.asmx/GetLowerUsers2` | subcuentas |

Páginas de la interfaz, no servicios: `Tracking.aspx` (mapa),
`Command2.aspx` y `Command3.aspx` (comandos), **`oilset2.aspx`** (corte de
combustible), `ProductUpdate.aspx` (editar equipo).

## Corte de motor

El comando documentado del fabricante es `RELAY,1#` para cortar y `RELAY,0#`
para restituir, soportado por MV710/MV720/MV730/MV740. En la plataforma se
maneja desde `oilset2.aspx`; no levantamos su servicio interno porque
todavía no hace falta.

**El equipo trae el resguardo de fábrica:** por encima de 20 km/h no ejecuta
el corte — pulsa el suministro cada 2 segundos hasta que baje de 20, y ahí
corta. No hay que construir esa protección.

**Falta la cláusula del contrato.** La 1.6 autoriza instalar el equipo y
tratar sus datos, pero **no autoriza inmovilizar el vehículo**. Hasta que la
abogada agregue ese párrafo, esto no se implementa.

## Riesgos de usar esto tal cual

1. **No está documentado.** Lo pueden cambiar sin avisar y se rompe.
2. **Autentica por cookie de sesión, no por API key.** Automatizarlo desde
   GitHub Actions obliga a guardar la contraseña de MiCODUS como secreto y
   scriptear el login.
3. Probablemente va contra sus términos de servicio.

Por eso sigue en pie pedirle a MiCODUS (`sales@micodus.com`) o al proveedor
la **API oficial con credenciales propias**. Este documento sirve para saber
exactamente qué pedir, y como plan B si no la dan.
