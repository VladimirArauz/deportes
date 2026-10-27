# Plan: integrar TheSportsDB en "Análisis" (Fútbol y NFL)

Documentación: https://www.thesportsdb.com/documentation

## Estado (2026-10-26): fases 0–9 hechas

Referencia actual de la API y sus alcances: **`docs/API_THESPORTSDB.md`** (reemplaza a `docs/sportsdb-muestras.md`).

**Después (2026-10-26):** a pedido del dueño se quitaron el campo de clave (se usa siempre la gratis `123`) y la
parte de API-Football (sus tablas, "Partido de la semana" y `js/analisis.js`). La Fase 8 quedó sin efecto.

La Fase 0 cambió el plan:
- **Tabla, tendencias, equipos y próximos se calculan con `eventsround.php`** (jornada completa, sin
  recorte en el plan gratis). `lookuptable` solo da 5 filas y la NFL no tiene tabla.
- `search_all_seasons` devuelve las temporadas más antiguas: el selector se arma desde `strCurrentSeason`.
- El límite real es más bajo que 30/min: una consulta cada 5 s, 2 reintentos (70 s y 120 s) y 10 s entre
  consultas durante 10 min después de un corte.
- La vista "Temporada" se reemplazó por "Por jornada" + "Cara a cara".

## Qué sabemos de la API (verificado el 2026-10-26)

- **Base v1:** `https://www.thesportsdb.com/api/v1/json/{CLAVE}/…`. La clave gratis es `123`.
  La v2 (`/api/v2/json/…`, clave en el header `X-API-KEY`) es solo Premium.
- **CORS abierto** (`access-control-allow-origin: *`): se puede llamar directo desde el navegador
  sin servidor ni PHP.
- **Límite:** 30 peticiones/min con la clave gratis (100 con Premium). Si se pasa, responde HTTP 429.
  En la prueba, Cloudflare también bloqueó con `error code: 1015` (texto, no JSON) después de unas
  10 llamadas seguidas. **Todas las llamadas deben ir en fila, espaciadas y con caché.**
- **IDs de ligas:** NFL `4391` (temporada `2026`) · Liga MX `4350` (`2026-2027`) ·
  Ligue 1 `4334` (`2026-2027`) · Primera División Argentina `4406` (`2026`) · Premier League `4328`.
  La temporada actual viene en `strCurrentSeason` de `lookupleague.php`.
- **Equipos:** cada equipo trae `idAPIfootball` e `idESPN`. Así se pueden unir con las tablas de
  API-Football que ya existen.

### Qué devuelve cada endpoint v1 (límite de resultados: gratis / Premium)

| Dato | Endpoint | Gratis | Premium |
|---|---|---|---|
| Liga (logo, banner, descripción, temporada actual, país) | `lookupleague.php?id=` | 1 | 1 |
| Tabla de posiciones (rank, PJ, G-E-P, GF, GC, DIF, PTS, forma) | `lookuptable.php?l=&s=` | 5 (*) | 100 |
| Equipos de la liga (estadio, ciudad, fundación, colores, escudo, redes, descripción ES) | `search_all_teams.php?l=` | 10 | 3000 |
| Ficha de equipo | `lookupteam.php?id=` | 1 | 1 |
| Uniformes | `lookupequipment.php?id=` | 2 | 100 |
| Estadio (capacidad, ubicación, foto) | `lookupvenue.php?id=` | 1 | 1 |
| Plantilla (posición, número, nacionalidad, nacimiento, altura, peso, foto) | `lookup_all_players.php?id=` | 10 | 3000 |
| Jugador: palmarés / equipos anteriores / hitos / contratos / estadísticas / resultados | `lookuphonours` `lookupformerteams` `lookupmilestones` `lookupcontracts` `lookupplayerstats` `playerresults` | 1–10 | 100–10000 |
| Partidos de la temporada | `eventsseason.php?id=&s=` | 15 | 3000 |
| Últimos / próximos de la liga | `eventspastleague.php` / `eventsnextleague.php?id=` | 1 | 20 |
| Últimos / próximos de un equipo (gratis: solo de local) | `eventslast.php` / `eventsnext.php?id=` | 1 | 10 |
| Partidos de un día | `eventsday.php?d=&s=&l=` | 3 | 1500 |
| Partido: estadísticas / alineación / cronología / TV / resultados | `lookupeventstats` `lookuplineup` `lookuptimeline` `lookuptv` `eventresults` | 2–5 | 100 |
| Resúmenes en video | `eventshighlights.php?d=&l=` | 2 | 50 |

(*) En la prueba, Liga MX devolvió la tabla con datos. Hay que confirmar cuántas filas da con la
clave gratis y si la NFL tiene tabla. Si no, se calcula a partir de `eventsseason`.

**Conclusión:** con la clave `123` se pueden mostrar todas las *secciones*, pero muchas listas
llegan recortadas (10 equipos, 15 partidos, 1 próximo partido). El diseño debe aceptar una clave
Premium (≈ USD 9/mes) en un campo de la página, igual que la de API-Football, para que las listas
salgan completas sin cambiar código. Cuando una lista esté recortada, la página debe decirlo.

## Decisiones de diseño

1. **No tocar lo que ya funciona.** Las tablas de API-Football se quedan igual. TheSportsDB va en
   una sección nueva de `analisis.html`, debajo del encabezado, con pestañas **Fútbol | NFL**.
2. **Archivos nuevos:** `js/sportsdb.js` (cliente: fila, caché, errores) y `js/sportsdb-ui.js`
   (pantallas). `analisis.js` solo se toca para enlazar equipos por `idAPIfootball` (fase 8).
3. **Solo navegador:** sin PHP ni base de datos. Caché en `localStorage` con caducidad según el dato
   (liga/equipos/estadios 7 días · tabla y resultados 6 h · próximos partidos 1 h).
4. **Fila de peticiones:** una petición cada ~2.5 s como máximo (≤ 24/min). Si llega 429 o 1015,
   esperar 60 s y reintentar una vez, mostrando "La API pidió esperar un minuto…".
5. **Carga perezosa:** al abrir una pestaña solo se pide liga + tabla + equipos + partidos. El
   detalle de partido, la plantilla y los jugadores se piden al tocarlos.
6. **Mismo estilo:** variables CSS existentes (`--lima`, `--panel`, Barlow Condensed), tablas con
   `.tabla-scroll` y columnas ordenables, sin scroll horizontal de la página en celular.

## Fases

| # | Fase | Archivos | Resultado |
|---|---|---|---|
| 0 | Reconocimiento | `docs/sportsdb-muestras.md` | Respuestas reales y límites confirmados |
| 1 | Cliente de la API | `js/sportsdb.js` | Fila, caché, clave, errores |
| 2 | Estructura de la sección | `analisis.html`, `js/sportsdb-ui.js` | Pestañas, selector de liga, clave |
| 3 | Liga y tabla de posiciones | `js/sportsdb-ui.js` | Encabezado de liga + tabla ordenable |
| 4 | Equipos y estadios | `js/sportsdb-ui.js` | Fichas de equipo con estadio |
| 5 | Partidos y tendencias | `js/sportsdb-ui.js` | Resultados, próximos, local/visita |
| 6 | Detalle de partido | `js/sportsdb-ui.js` | Estadísticas, alineación, cronología, TV, video |
| 7 | Plantillas y jugadores | `js/sportsdb-ui.js` | Plantilla + ficha de jugador |
| 8 | Unir con API-Football | `js/analisis.js` | Escudo/estadio/forma en las tablas actuales |
| 9 | Pruebas y documentación | `README.md`, `PROMPTS.md` | Verificado en XAMPP |

## Reglas para cualquier agente que ejecute estos prompts

Pega este bloque al inicio de cada prompt:

> Trabaja solo dentro de `/home/aumf-ubuntu-080704/deportes`. Hay otro agente trabajando en otro
> proyecto en esta máquina: no reinicies, detengas ni reconfigures XAMPP (Apache, MySQL, ProFTPD),
> no edites nada en `/opt/lampp` y no toques otras carpetas de `htdocs`. La página ya se sirve en
> `http://localhost/deportes/` mediante un enlace simbólico. Para probar, usa esa URL o `curl`.
> No hagas commit ni push sin que te lo pida. Respeta el límite de la API: no más de una petición
> cada 2.5 s, también en tus pruebas con `curl`.

---

## Prompts

### Fase 0 · Reconocimiento

> Lee `PLAN_THESPORTSDB.md`. Con la clave gratis `123` de TheSportsDB (v1), haz una petición a cada
> endpoint de la tabla del plan, una cada 3 s, usando la NFL (`4391`, temporada `2026` y `2025`) y la
> Liga MX (`4350`, temporada `2026-2027` y `2025-2026`). Para los endpoints de equipo, jugador,
> estadio y partido, usa IDs que salgan de las respuestas anteriores. En
> `docs/sportsdb-muestras.md` anota por endpoint: la URL, si respondió, cuántos resultados dio y la
> lista de campos con un valor de ejemplo. Recorta textos largos (descripciones a 80 caracteres).
> Responde en especial: ¿cuántas filas da `lookuptable` gratis? ¿La NFL tiene tabla? ¿Cuántos
> partidos da `eventsseason`? ¿`lookupeventstats`, `lookuplineup` y `lookuptimeline` traen datos
> para fútbol y para NFL? Si recibes 429 o `error code: 1015`, espera 60 s y continúa.
> Al final, propón cambios al plan si algo no coincide.

### Fase 1 · Cliente de la API

> Crea `js/sportsdb.js` como IIFE sin dependencias, con el mismo estilo de `js/analisis.js`
> (ES5, `'use strict'`, funciones `leer`/`guardar` con try/catch). Debe exponer `window.SportsDB` con:
> - `pedir(ruta, params, horasCache)`: arma la URL v1 con la clave guardada en `localStorage`
>   (`sdb:clave`, por defecto `123`), devuelve una Promise con el JSON.
> - Una fila global: una petición a la vez y al menos 2.5 s entre peticiones. Si llegan varias
>   peticiones iguales al mismo tiempo, se comparten (no se duplican).
> - Caché en `localStorage` con prefijo `sdb:cache:` y caducidad por llamada. Guarda solo los
>   campos que usa la interfaz para no llenar el almacenamiento. Si está lleno, sigue sin caché.
> - Errores claros: 429 o texto `error code: 1015` → espera 60 s, reintenta una vez y avisa con un
>   evento `sdb:espera` para que la interfaz muestre "La API pidió esperar un minuto". Respuesta
>   `null` → arreglo vacío, no error.
> - `estaRecortado(endpoint, n)`: dice si `n` llegó al tope del plan gratis (tabla del plan).
> - `borrarCache()` y `setClave(clave)`.
> Funciones de alto nivel: `liga(id)`, `tabla(id, temporada)`, `equipos(nombreLiga)`, `equipo(id)`,
> `estadio(id)`, `uniformes(id)`, `plantilla(idEquipo)`, `jugador(id)`, `temporada(idLiga, temp)`,
> `ultimosLiga(id)`, `proximosLiga(id)`, `ultimosEquipo(id)`, `proximosEquipo(id)`, `partido(id)`,
> `estadisticas(id)`, `alineacion(id)`, `cronologia(id)`, `tv(id)`, `videos(fecha, idLiga)`.
> Aún no toques `analisis.html`. Prueba en la consola del navegador en
> `http://localhost/deportes/analisis.html` cargando el script a mano.

### Fase 2 · Estructura de la sección

> En `analisis.html`, debajo de la tarjeta del encabezado y antes de `#ligas`, agrega una tarjeta
> "Datos TheSportsDB" con:
> - Pestañas **Fútbol** y **NFL** (botones `.chip`, accesibles con teclado y `aria-selected`).
> - En Fútbol: chips de liga para Liga MX (4350), Ligue 1 (4334), Primera División Argentina (4406)
>   y Premier League (4328), más un campo para agregar una liga por ID de TheSportsDB.
>   En NFL: la liga 4391, sin selector.
> - Campo "Clave de TheSportsDB (vacío = gratis)" de tipo password, guardado solo en el navegador,
>   y un botón "Actualizar datos" que borre solo la caché `sdb:`.
> - Un selector de temporada lleno con `search_all_seasons.php`, por defecto `strCurrentSeason`.
> - Una línea de estado que muestre la fila ("Cargando 3 de 7…") y el aviso de espera.
> - Un contenedor por bloque, en este orden: Liga, Posiciones, Partidos, Equipos y un panel lateral
>   o modal para Detalle de partido / Jugador.
> Carga `js/sportsdb.js` y un nuevo `js/sportsdb-ui.js` después de `analisis.js`. Recuerda pestaña,
> liga y temporada en `localStorage`. No cambies el comportamiento de API-Football.

### Fase 3 · Liga y tabla de posiciones

> En `js/sportsdb-ui.js`, al elegir una liga:
> 1. Encabezado de liga con `lookupleague`: logo, banner (si hay), país, año de fundación,
>    temporada actual, sitio web y descripción en español (`strDescriptionES`, si no hay
>    `strDescriptionEN`) recortada a 3 líneas con "Ver más".
> 2. Tabla de posiciones con `lookuptable`. Fútbol: Pos, Escudo+Equipo, PJ, G, E, P, GF, GC, DIF,
>    PTS, Forma (`strForm` como 5 círculos lima/gris/naranja) y la zona (`strDescription`: Liguilla,
>    Descenso, etc.) como color en el borde de la fila. NFL: agrupa por división/conferencia
>    (`strGroup`) y muestra G-P-E, % de victorias, PF, PC y DIF.
> 3. Si la tabla viene vacía o recortada, calcúlala con los partidos de `eventsseason` y avisa:
>    "Calculada con N partidos disponibles en el plan gratis".
> Columnas ordenables como en las tablas actuales. Tocar un equipo abre su ficha (fase 4).

### Fase 4 · Equipos y estadios

> Agrega el bloque "Equipos" con `search_all_teams.php?l=<strLeague>`. Por equipo, una tarjeta con
> escudo, nombre, nombre corto, ciudad (`strLocation`), año de fundación, colores
> (`strColour1..3` como muestras), estadio y capacidad, y enlaces a sitio web y redes. Al abrir la
> ficha, pide `lookupvenue` (foto, capacidad, ubicación, descripción del estadio) y
> `lookupequipment` (fotos del uniforme por temporada). Si en `data/equipos.js` hay altitud para ese
> equipo, muéstrala también. Si la lista llegó recortada a 10, dilo y sugiere la clave Premium.

### Fase 5 · Partidos y tendencias

> Agrega el bloque "Partidos" con tres vistas: **Resultados**, **Próximos** y **Temporada**.
> - Resultados y Temporada con `eventsseason` (y `eventspastleague` para lo más reciente): fecha,
>   jornada/semana (`intRound`), local, marcador, visitante, estadio y espectadores si vienen.
> - Próximos con `eventsnextleague` y `eventsnext` de cada equipo, con fecha en hora local del
>   navegador.
> - Tendencias por equipo calculadas con esos partidos: G-E-P de local y de visita, promedio de
>   goles (fútbol) o puntos (NFL) a favor y en contra, racha actual y el último enfrentamiento entre
>   dos equipos elegidos.
> Cada partido es clicable y abre el detalle (fase 6). Avisa cuando la lista esté recortada.

### Fase 6 · Detalle de partido

> Al tocar un partido, abre un panel (modal accesible: foco atrapado, Esc cierra) que pide en fila:
> `lookupevent`, `lookupeventstats`, `lookuplineup`, `lookuptimeline`, `lookuptv` y, si el partido
> ya se jugó, `eventshighlights` de esa fecha y liga. Muestra:
> - Marcador, estadio, árbitro, espectadores, clima si viene, póster o miniatura.
> - Estadísticas como barras enfrentadas local vs visitante (posesión, tiros, faltas… en fútbol;
>   yardas, primeros intentos, pérdidas… en NFL; usa lo que venga, sin inventar nombres).
> - Alineación por equipo (titulares y suplentes, posición, número).
> - Cronología (goles, tarjetas, cambios / anotaciones por cuarto) con minuto.
> - Canales de TV por país y enlace al video si hay.
> Cada pestaña del panel que venga vacía dice "La API no tiene este dato para este partido".

### Fase 7 · Plantillas y jugadores

> En la ficha de equipo agrega "Plantilla" con `lookup_all_players`: foto, nombre, número,
> posición, nacionalidad, edad (calculada con `dateBorn`), altura y peso. Agrupa por posición
> (fútbol: POR/DEF/MED/DEL; NFL: ofensiva, defensiva, equipos especiales). Al tocar un jugador,
> abre su ficha con `lookupplayer` y, al abrir cada pestaña, `lookupplayerstats`,
> `lookuphonours`, `lookupformerteams`, `lookupmilestones` y `lookupcontracts`.

### Fase 8 · Unir con las tablas de API-Football

> En `js/analisis.js`, si `window.SportsDB` existe y ya hay en caché equipos de TheSportsDB con
> `idAPIfootball`, empareja cada fila de las tablas actuales por ese ID y agrega una columna
> opcional "Forma" (`strForm`) y un enlace "Ficha" que abra la ficha de equipo de la fase 4.
> No hagas peticiones nuevas desde aquí: usa solo la caché. Si no hay coincidencia, deja la celda
> vacía.

### Fase 9 · Pruebas y documentación

> Prueba `http://localhost/deportes/analisis.html` (sin reiniciar XAMPP) en escritorio y a 375 px
> de ancho: pestañas Fútbol/NFL, cambio de liga y temporada, tabla, equipos, partidos, detalle de
> partido y jugador, clave vacía y clave inválida, `localStorage` bloqueado y el aviso de límite.
> Revisa la consola: sin errores. Cuenta cuántas peticiones hace una carga en frío por liga y deja
> que no pase de 20. Actualiza `README.md` (cómo obtener la clave, qué da el plan gratis y qué da
> Premium, IDs de ligas) y agrega a `PROMPTS.md` los prompts de esta sección para la herramienta de
> diseño.
