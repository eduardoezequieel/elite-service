# 044 — Entrada a la pista solo con PIN

**Estado:** Terminada
**Módulo:** employees / floor auth | **Depende de:** 003 (RN-18), 001

## Contexto

Hoy el empleado entra a la pista con usuario **y** PIN. De pie, con una tablet y a veces con
guantes, escribir el usuario sobra: el PIN alcanza si es único en todo el taller. El usuario se
queda como dato de oficina (ficha, tabla, búsqueda), pero deja de ser credencial.

## Historias

- Como empleado de pista, quiero entrar tecleando solo mi PIN, para no escribir mi usuario cada vez.
- Como usuario con `employees.manage`, quiero que el sistema me avise si el PIN que asigno ya es de
  otro empleado, para no dejar a dos personas con la misma llave.

## Criterios de aceptación

- **Dado** un empleado activo con PIN `123456`, **cuando** se teclean esos 6 dígitos en
  `/floor/login`, **entonces** la sesión de pista queda abierta y la pantalla va a `/floor`, sin
  pedir usuario.
- **Dado** un PIN que no pertenece a nadie, **cuando** se envía, **entonces** el API responde `401`
  `INVALID_CREDENTIALS` con el mensaje «PIN incorrecto.».
- **Dado** un empleado **desactivado**, **cuando** se teclea su PIN, **entonces** la respuesta es
  idéntica a la del PIN inexistente: mismo código y mismo mensaje.
- **Dado** un empleado con PIN `123456`, **cuando** se crea o edita otro empleado con ese mismo PIN,
  **entonces** el API responde `409` `PIN_TAKEN` y no se guarda nada.
- **Dado** un PIN de 5 dígitos o con letras en el alta de empleados, **cuando** se envía,
  **entonces** el API responde `422` `VALIDATION_ERROR` y el formulario lo marca antes de enviar.
- **Dado** 5 intentos fallidos seguidos desde la misma IP, **cuando** llega el sexto en menos de
  60 s, **entonces** el API responde `429` `TOO_MANY_ATTEMPTS` sin tocar la base.
- **Dado** que a un empleado se le cambia el PIN, **cuando** usa una sesión de pista abierta desde
  antes, **entonces** esa sesión deja de valer (RN-18 de 003, sin cambios).

## Reglas de negocio

- **RN-1:** Entrar a la pista es **solo PIN**. `username` sigue existiendo en el empleado como dato
  de oficina —ficha, tabla, búsqueda— y no es credencial de nada.
- **RN-2:** El PIN son **6 dígitos exactos**, solo números. Reemplaza el rango 4–8 de 003.
- **RN-3:** El PIN es **único entre todos los empleados**, activos e inactivos. Un empleado
  desactivado retiene su PIN: no se reparte de nuevo por accidente.
- **RN-4:** El PIN se guarda como `HMAC-SHA256(PIN_PEPPER, pin)` en hexadecimal, con índice único en
  la base. Es determinístico a propósito: un PIN-only necesita encontrar al empleado **por** el PIN,
  y bcrypt —que no lo permite— obligaría a probar contra cada empleado en cada intento. La fuerza
  ya no viene del costo del hash sino del secreto: sin `PIN_PEPPER` un volcado de la base no dice
  ningún PIN, y el freno de RN-6 cubre el intento a ciegas.
- **RN-5:** Los hashes bcrypt actuales no corresponden a ningún HMAC, así que **los PINs vigentes
  dejan de servir** al desplegar: oficina los reasigna una vez, empleado por empleado. No hay
  migración de datos posible y no se inventa una.
- **RN-6:** Freno de intentos: 5 fallos desde la misma IP dejan `/floor/login` cerrado 60 s para esa
  IP, con `429` `TOO_MANY_ATTEMPTS`. El contador vive en memoria del proceso —una instancia— y un
  login correcto lo borra.
- **RN-7:** PIN inexistente y empleado desactivado responden lo mismo, con el mismo mensaje. La
  respuesta nunca dice de quién es un PIN ni si existe.
- **RN-8:** El PIN no vuelve nunca al cliente, no se guarda en `localStorage` y no se escribe en
  logs. Tampoco su HMAC.

## Permisos

Ninguno nuevo. El alta y la edición de empleados siguen pidiendo `employees.manage`; `/floor/login`
sigue siendo público.

## Datos

- `Employee.pinHash`: pasa a `@unique`. Migración Prisma nueva, solo el índice; los valores viejos
  quedan donde están y no matchean nunca (RN-5).
- Variable nueva `PIN_PEPPER` en `.env.example`, `render.yaml` y la tabla de entorno remoto de
  `AGENTS.md`. El API no arranca sin ella (`getOrThrow`).

## API

| Método | Ruta             | Request                                     | Response               | Errores                                                                    |
| ------ | ---------------- | ------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| POST   | `/floor/login`   | `{ pin }`                                   | `FloorSessionResponse` | `401 INVALID_CREDENTIALS`, `429 TOO_MANY_ATTEMPTS`, `422 VALIDATION_ERROR` |
| POST   | `/employees`     | `{ fullName, username, pin }`               | `PublicEmployee`       | `409 USERNAME_TAKEN`, `409 PIN_TAKEN`, `422 VALIDATION_ERROR`              |
| PATCH  | `/employees/:id` | `{ fullName?, username?, pin?, isActive? }` | `PublicEmployee`       | `409 USERNAME_TAKEN`, `409 PIN_TAKEN`, `404 NOT_FOUND`                     |

Códigos nuevos en `@elite/shared`: `PIN_TAKEN`, `TOO_MANY_ATTEMPTS`.

## UI

- **`/floor/login`:** desaparece el campo Usuario y el usuario recordado en `localStorage`. Queda un
  visor de 6 casillas y un teclado numérico en pantalla —`1`–`9`, `0` y borrar— con botones de al
  menos `56px` de alto en densidad `bahia`. Al sexto dígito se envía solo: no hay botón «Entrar».
  Mientras responde el API, el teclado queda deshabilitado. Si falla, las casillas se vacían, el
  error ocupa un renglón reservado y el foco vuelve al teclado. El teclado físico también escribe:
  dígitos, `Backspace` y `Enter`.
- **Empleados (oficina):** el campo PIN pide 6 dígitos en alta y edición, con el mismo mensaje de
  formato que el schema. `PIN_TAKEN` se muestra sobre el campo PIN: «Ese PIN ya lo usa otro
  empleado.». El usuario sigue igual que hoy en tabla, ficha y búsqueda.

## Fuera de alcance

- El login de oficina (correo + contraseña, spec 001) no se toca.
- Que el empleado cambie su propio PIN desde la pista.
- Recordar al empleado entre sesiones en la tablet.
- Cualquier freno distribuido entre instancias: el de RN-6 es por proceso.

## Verificación

`scripts/verify-044.sh` contra el stack levantado: login con PIN bueno abre sesión, PIN inexistente
y empleado desactivado devuelven el mismo `401`, PIN repetido en el alta devuelve `409 PIN_TAKEN`,
y el sexto intento fallido seguido devuelve `429`.

## Tareas

- [x] `@elite/shared`: `PIN_LENGTH = 6`, schema `pin` de 6 dígitos exactos, `floorLoginSchema` sin
      `username`, códigos `PIN_TAKEN` y `TOO_MANY_ATTEMPTS`.
- [x] Prisma: `pinHash @unique` + migración.
- [x] `PinHasher` pasa al puerto determinístico `PinDigest` (`digest(pin)`); implementación
      HMAC-SHA256 con `PIN_PEPPER`; se borran `BcryptPinHasher` y el hash de descarte del login.
- [x] `EmployeeRepository`: `findByPinHash`, `existsByPinHash(pinHash, exceptId?)` e in-memory al
      día; se va `findByUsername`, que ya no usa nadie.
- [x] `FloorLoginUseCase` busca por digest; `CreateEmployeeUseCase` y `UpdateEmployeeUseCase` tiran
      `PIN_TAKEN`; tests de cada uno.
- [x] Freno de intentos por IP en `/floor/login` (RN-6) con test.
- [x] Web: teclado numérico en `/floor/login`, sin usuario ni usuario recordado.
- [x] Web: campo PIN de 6 dígitos y error `PIN_TAKEN` en la pantalla de empleados.
- [x] `.env.example`, `render.yaml` y `AGENTS.md` con `PIN_PEPPER`; RN-18 de `specs/003-carwash.md`
      marcada como reemplazada por esta spec.
- [x] `scripts/verify-044.sh`, y los `verify-*.sh` anteriores al día: PIN de 6 dígitos, uno
      distinto por empleado, y login de pista sin usuario.
