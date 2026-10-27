# TheSportsDB en La Jugada: cómo funciona y qué se puede pedir

Referencia para quien vaya a pedir o hacer cambios en la sección **Análisis** (`analisis.html`).
Lee esto antes de prometer un dato nuevo: muchas cosas que parecen posibles no las da la API gratis.

Verificado con llamadas reales el **2026-10-26**. Documentación oficial: https://www.thesportsdb.com/documentation

---

## 1. Resumen en 30 segundos

- La página usa **solo TheSportsDB**, **versión gratis**, **sin cuenta**: la clave pública `123` va fija en el código.
  No hay campo de clave en la página y no se debe agregar (decisión del dueño del proyecto).
- Deportes: **Fútbol** (Liga MX, Ligue 1, Primera División Argentina, Premier League y cualquier otra liga
  de fútbol que se agregue por ID) y **NFL**.
- Todo corre en el navegador (sin PHP ni base de datos). La API permite CORS.
- **Truco clave:** casi todas las listas de la versión gratis vienen recortadas, pero **`eventsround.php`
  (una jornada completa) no**. Por eso la tabla, las tendencias, los próximos y la lista de equipos se
  **calculan** juntando jornadas, en vez de pedirlos hechos.
- **Límite real:** la API corta tras unas 13–25 consultas seguidas (más bajo que lo que dice su
  documentación). El código hace una consulta cada 5 s y guarda todo en el navegador.

---

## 2. Qué muestra la página hoy

| Bloque | De dónde sale | Completo con la versión gratis |
|---|---|---|
| Encabezado de liga (logo, banner, país, fundación, temporada, redes, TV, descripción, trofeo) | `lookupleague` | Sí |
| Tabla de posiciones (fútbol) | **Calculada** con todas las jornadas. La oficial (`lookuptable`, 5 filas) solo se usa para comprobar y para la zona (Liguilla, descenso…) | Sí |
| Tabla NFL por división | **Calculada** con las jornadas + `data/nfl.js` (la API no tiene tabla de NFL) | Sí (temporada regular, sin pretemporada ni playoffs) |
| Partidos "Por jornada" | `eventsround` | Sí |
| Próximos | Jornada actual y la siguiente | Sí (solo las 2 jornadas cargadas) |
| Tendencias (local/visita, promedios, racha, últimos 5) | Calculadas | Sí |
| Cara a cara | Calculado con la temporada cargada | Solo dentro de esa temporada |
| Detalle de partido: marcador, fecha, estadio, video | Datos de la jornada | Sí |
| Detalle: marcador por cuarto (NFL) | Campo `strResult` | Sí |
| Detalle: estadísticas, alineaciones, cronología | `lookupeventstats`, `lookuplineup`, `lookuptimeline` | **No: 5 filas cada uno. Solo fútbol; en NFL vienen vacíos** |
| Detalle: TV | `lookuptv` | **No: 2 canales. Más común en NFL que en fútbol** |
| Ficha de equipo (banner, colores, fundación, ciudad, estadio, redes, descripción) | `lookupteam` | Sí |
| Estadio (capacidad, costo, arquitecto, mapa, fotos, descripción) | `lookupvenue` | Sí |
| Uniformes | `lookupequipment` | **No: 2 (y suelen ser de temporadas viejas)** |
| Plantilla | `lookup_all_players` | **No: 10 jugadores en orden alfabético** |
| Ficha de jugador (posición, número, nacionalidad, edad, estatura, peso, foto) | Datos de la plantilla | Sí |
| Jugador: estadísticas / equipos anteriores | `lookupplayerstats` / `lookupformerteams` | **No: 10 / 5. Suelen existir para NFL, casi nunca para fútbol** |
| Jugador: palmarés, hitos, contratos | `lookuphonours`, `lookupmilestones`, `lookupcontracts` | Casi siempre vacíos |
| Vista **Local / Visita** (G/E/P de local, visita y neutral, últimos 10 con color) | Calculada con las jornadas. Neutral = el partido no fue en la sede habitual del local (el `idVenue` más repetido en sus partidos de local) | Sí |
| Altitud del estadio | Coordenadas del estadio (`lookupvenue` → `strMap`) + **Open-Meteo** (`api.open-meteo.com/v1/elevation`, gratis, sin clave). `data/equipos.js` tiene prioridad | Sí, si el estadio tiene `strMap` |
| Altitud de entrenamiento | Solo `data/equipos.js`; si no está, se usa la del estadio (marcada "≈") | Solo equipos del archivo |
| Zona dentro del país | `data/equipos.js` o calculada: coordenadas del estadio contra el centro del país (`PAISES` en `sportsdb-ui.js`) | Sí, si hay coordenadas |
| Lesionados (bajas y en duda) | `data/lesionados.js`, **a mano** | Solo equipos capturados |
| Catálogo "Todas las ligas" | `data/ligas.js` (IDs verificados) + `search_all_leagues` del país | El catálogo sí; la API da solo 5 por país |

Cuando una lista llega al tope de la versión gratis, la página lo avisa debajo ("La versión gratis de
TheSportsDB solo da N…").

---

## 3. Alcances: qué se puede pedir y qué no

### Se puede (con lo que ya hay)
- Agregar cualquier liga de **fútbol** por ID (campo "Agregar liga"), o dejarla fija en la lista.
- Nuevas columnas o cálculos sobre los partidos: goles por tiempo no, pero sí promedios, rachas, % de victorias
  de local, partidos con más de 2.5 goles, ambos anotan, rendimiento en las últimas N jornadas, diferencia
  entre local y visita, cara a cara, etc. **Todo lo que salga de marcador + fecha + local/visita + jornada.**
- Ver temporadas pasadas (selector de temporada: la actual y 4 anteriores).
- Separar Apertura/Clausura (ya lo hace por fechas).
- Mostrar más campos que la API ya manda y hoy no se pintan (sección 6).
- Otro deporte de equipo con jornadas (NBA 4387, MLB 4424, NHL 4380) se podría agregar como pestaña
  nueva, con el mismo esquema que la NFL. No está hecho.

### No se puede con la versión gratis
- Plantillas completas, alineaciones completas, todas las estadísticas de un partido, todos los canales de TV.
- **Lesionados, suspendidos, cuotas de apuestas, goleadores de la liga, tabla de goleo, árbitros por
  partido** (casi nunca vienen).
- Estadísticas de partido, alineaciones o cronología de la **NFL** (la API no las tiene).
- Marcadores **en vivo** al segundo (la versión gratis no tiene livescore; los partidos se actualizan cuando
  la caché vence, cada 1 h para la jornada en curso).
- Tabla oficial completa (solo 5 filas; por eso se calcula).
- Historial cara a cara de muchos años de una sola vez: habría que cargar varias temporadas
  (≈ 15–40 consultas cada una).
- Altitud de estadios: la API no la da; se calcula con Open-Meteo a partir de `strMap`, o viene de `data/equipos.js`.
- **Listar todas las ligas**: `all_leagues.php` da 50 (10 de fútbol) y `search_all_leagues.php?c=` solo
  las 5 primeras del país en orden alfabético (en Inglaterra ni sale la Premier). Por eso existe `data/ligas.js`.

### Lo que cambiaría con la versión de pago (no usada, solo para referencia)
Con clave Premium (≈ USD 9/mes), las mismas llamadas devuelven listas completas, hay livescore y un límite
más alto. **El dueño del proyecto pidió no tener campo de clave**, así que esto no está habilitado.
Si algún día se quiere, basta cambiar `CLAVE` en `js/sportsdb.js` y los topes de `LIMITES`.

---

## 4. Cómo funciona por dentro

### Archivos
| Archivo | Qué hace |
|---|---|
| `analisis.html` | Estructura y estilos de la sección (tarjeta `#sdb`, modal `#sdbModal`) |
| `js/sportsdb.js` | Cliente de la API → `window.SportsDB`: fila de peticiones, caché, una función por dato |
| `js/sportsdb-ui.js` | Pantallas y cálculos: carga de jornadas, tabla, tendencias, fichas, modal |
| `data/nfl.js` | `window.NFL_DIVISIONES`: 8 divisiones con los 32 equipos (nombres exactos de la API) |
| `data/equipos.js` | `window.EQUIPOS`: altitud de estadio y entrenamiento, y zona (datos propios; mandan sobre lo calculado) |
| `data/lesionados.js` | `window.LESIONADOS`: bajas y dudas por equipo, capturadas a mano |
| `data/ligas.js` | `window.LIGAS`: catálogo de ligas de fútbol por país para el buscador "Todas las ligas" |

### Flujo al abrir una liga (`cargar()` en `sportsdb-ui.js`)
1. `lookupleague` → encabezado + `strCurrentSeason` → arma el selector de temporada (actual y 4 anteriores).
2. Si es la **temporada actual**: `eventspastleague` + `eventsnextleague` dicen en qué jornada va (N).
   Pide la jornada N y N+1 primero (para "Por jornada" y "Próximos") y luego 1…N-1.
3. Si es una **temporada pasada**: pide jornada 1, 2, 3… hasta 2 vacías seguidas (tope 46 en fútbol, 18 en NFL).
4. Fútbol: `lookuptable` (5 filas) para comprobar la tabla calculada y marcar zonas.
5. Cada jornada que llega se suma y la página se vuelve a pintar (se ve avanzar).
6. Fichas de equipo, jugador y detalle de partido piden sus datos **solo al abrirse** (cada pestaña por separado).

Costo de la primera carga: **1 consulta por jornada jugada + 4**. Liga MX a mitad de torneo ≈ 19
(≈ 1.5–5 min, según el límite). Premier al final de temporada ≈ 42. Con caché, segundos.

### Reglas que conviene no romper
- **NFL:** se ignora la pretemporada (`intRound` 500). Las rondas de playoffs (>100) no se cargan.
- **Fútbol con dos torneos por temporada** (Liga MX, Argentina): se separan cuando hay un hueco de más de
  30 días entre partidos (`HUECO_TORNEO`), y aparece el selector "Torneo".
- **Partido terminado:** `strStatus` FT/AET/PEN/AOT, o tiene marcador y empezó hace más de 6 h.
- **Forma (últimos 5):** el más reciente a la **izquierda**, igual que `strForm` de la API.
- **Horas:** `strTimestamp` viene en UTC; se muestra en la hora del navegador.
- **Puntos:** fútbol 3/1/0. NFL ordena por % = (G + E/2) / J y desempata por diferencia de puntos.

### Límite de consultas (`js/sportsdb.js`)
- Todas las consultas pasan por **una sola fila**: una a la vez, mínimo `ESPACIO_MS` = 5 s entre consultas.
- Si la API corta (HTTP 429 con el texto `error code: 1015`; en el navegador se ve como error de CORS o de
  red), espera 70 s y reintenta; si vuelve a cortar, espera 120 s más; si sigue, muestra el error.
- Después de un corte, durante 10 min va a 10 s entre consultas.
- La línea de estado muestra cuántas consultas faltan y el aviso de espera (eventos `sdb:fila` y `sdb:espera`).
- Si dos partes piden lo mismo a la vez, se hace una sola consulta.
- **Al probar desde la terminal también hay que respetar el límite**: cada `curl` cuenta y afecta a la
  página, porque sale de la misma IP.

### Caché (`localStorage`, prefijo `sdb:cache:g:`)
| Dato | Dura |
|---|---|
| Liga, equipos, estadios, uniformes, plantilla, jugador | 7 días |
| Estadísticas, alineación, cronología, TV, video de un partido | 1 día |
| Tabla oficial, últimos partidos | 6 h |
| Jornada **terminada completa** | Sin vencimiento (no cambia) |
| Jornada en curso o futura, próximos partidos | 1 h |

"Actualizar datos" borra solo esta caché. Si `localStorage` no está disponible, la página funciona sin caché.
Preferencias guardadas: `sdb:dep` (deporte), `sdb:liga`, `sdb:temp`, `sdb:extras` (ligas agregadas).

---

## 5. Endpoints (v1, clave `123`): resultado real de cada uno

Base: `https://www.thesportsdb.com/api/v1/json/123/`. "Filas" = tope con la versión gratis.

| Endpoint | Filas | Notas |
|---|---|---|
| `lookupleague.php?id=` | 1 | `strCurrentSeason` (`2026` NFL, `2026-2027` fútbol europeo/MX), logo, badge, banner, trofeo, póster, fanart, redes, `strTvRights`, descripción ES/EN |
| `search_all_leagues.php?c=&s=Soccer` | **5** | Las 5 primeras del país en orden alfabético. Nombres de país en inglés (`Mexico`, `England`, `United States`; `Europe` para UEFA, `Worldwide` para Libertadores y torneos FIFA) |
| `search_all_seasons.php?id=` | 5 | Devuelve las **5 más antiguas**: no sirve para las recientes |
| `lookuptable.php?l=&s=` | **5** | Sin `s` = temporada actual. `strForm`, `strDescription` (zona), `strGroup`. **NFL: vacío** |
| `search_all_teams.php?l=` | **10** | Alfabético. Pide el nombre interno de la liga (`Mexican Primera League`, no `Mexican Liga MX`). No se usa |
| `lookupteam.php?id=` | 1 | `idAPIfootball`, `idESPN`, `idVenue`, colores (solo NFL), escudo, logo, banner, fanart, redes, descripción |
| `lookupequipment.php?id=` | 2 | Imágenes de uniforme por temporada |
| `lookupvenue.php?id=` | 1 | `intCapacity`, `strCost`, `strArchitect`, `strMap` (lat, lon), `strTimezone`, fotos, descripción |
| `lookup_all_players.php?id=` | **10** | Alfabético. `strNumber` solo en NFL |
| `lookupplayer.php?id=` | 1 | Igual que la plantilla + descripción (no se usa: la plantilla ya trae todo) |
| `lookupplayerstats.php?id=` | 10 | NFL sí; fútbol casi nunca |
| `lookupformerteams.php?id=` | 5 | NFL sí; fútbol casi nunca |
| `lookuphonours` / `lookupmilestones` / `lookupcontracts` / `playerresults` | 1–5 | Casi siempre vacíos |
| **`eventsround.php?id=&r=&s=`** | **Completo** | **Jornada entera. Base de todo.** No viene en la tabla de la documentación oficial, pero funciona |
| `eventsseason.php?id=&s=` | 15 | Los **primeros** 15 de la temporada (NFL: pretemporada). No se usa |
| `eventspastleague.php` / `eventsnextleague.php?id=` | 1 | Para saber la jornada actual |
| `eventslast.php` / `eventsnext.php?id=` (equipo) | 1 | Solo de local. No se usan |
| `eventsday.php?d=&l=` | 3 | No se usa |
| `lookupevent.php?id=` | 1 | Igual que la jornada (no se usa: la jornada ya trae `strResult`, video, póster) |
| `lookupeventstats.php?id=` | 5 | Fútbol: `strStat`, `intHome`, `intAway` (xG, pases, tiros…). NFL: vacío |
| `lookuplineup.php?id=` | 5 | Fútbol. NFL: vacío |
| `lookuptimeline.php?id=` | 5 | Fútbol: goles, tarjetas, cambios, minuto. NFL: vacío |
| `lookuptv.php?id=` | 2 | Canal y país |
| `eventshighlights.php?d=&l=` | 2 | Video de YouTube (solo se usa si el partido no trae `strVideo`) |
| v2 (`/api/v2/json/…`, livescore, listas completas) | — | **Solo de pago.** No se usa |

Campos de partido que llegan en la jornada: `idEvent`, `intRound`, `strTimestamp` (UTC), `dateEvent`,
`idHomeTeam`/`idAwayTeam`, nombres y escudos, `intHomeScore`/`intAwayScore`, `strStatus` (`NS`, `FT`,
`1H`, `Q3`…), `strPostponed`, `strVenue`, `strCity`, `strCountry`, `strThumb`, `strPoster`, `strVideo`,
`intSpectators` (rara vez), `strOfficial` (rara vez) y, en NFL, `strResult` con el marcador por cuarto:
`" Equipo Quarter 1:<br>0 6 <br>Quarter 2<br>6 7 <br>…<br>Overtime<br> "` (primer número = local).

### IDs útiles
Fútbol: Liga MX 4350 · Ligue 1 4334 · Primera División Argentina 4406 ·
Premier League 4328 · LaLiga 4335 · Serie A 4332 · Bundesliga 4331 · Championship 4329.
NFL 4391. Otros: NBA 4387 · MLB 4424 · NHL 4380.
Para buscar otro ID: `https://www.thesportsdb.com/api/v1/json/123/search_all_leagues.php?c=Mexico&s=Soccer`.

---

## 6. Cambios comunes: dónde tocar

| Quiero… | Dónde |
|---|---|
| Fijar otra liga de fútbol en los chips | `DEPORTES.futbol.ligas` en `js/sportsdb-ui.js` |
| Nueva columna en la tabla o en Tendencias | `calcular()` (dato por equipo) y `cols` en `pintarTabla()` / `pintarTendencias()` |
| Nueva vista de partidos | Botón en `#sdbVistas` (`analisis.html`) y una rama en `pintarPartidos()` |
| Mostrar un campo de la API que hoy no sale | Agregarlo a `tomar(...)` / `compactarPartido` / `CAMPOS_EQUIPO` / `CAMPOS_JUGADOR` en `js/sportsdb.js` y pintarlo en la ficha. **Luego "Actualizar datos"**, porque la caché guarda solo los campos de antes |
| Traducir otra estadística de partido | Objeto `STATS` en `js/sportsdb-ui.js` |
| Cambiar cuánto dura la caché | `H` en `js/sportsdb.js` |
| Cambiar el ritmo de consultas | `ESPACIO_MS`, `ESPERAS_MS`, `ESPACIO_LENTO_MS` en `js/sportsdb.js` (bajar de 5 s provoca cortes) |
| Agregar altitud/zona de un equipo | `data/equipos.js` |
| Capturar lesionados | `data/lesionados.js` (y cambiar `actualizado`) |
| Agregar una liga al buscador | `data/ligas.js` (verifica el ID con `lookupleague.php?id=`) |
| Cambiar la regla de "neutral" | `esNeutral()` / `sedesHabituales()` en `js/sportsdb-ui.js` |
| Corregir el centro de un país para la zona | `PAISES` en `js/sportsdb-ui.js` |
| Otro deporte (NBA…) | Nueva entrada en `DEPORTES`, botón de pestaña en `analisis.html`, y revisar `esNfl()` (pretemporada, divisiones, grupos de posición) |

---

## 7. Cómo probar sin pasarse del límite

- Página: `http://localhost/deportes/analisis.html` (XAMPP; la carpeta está enlazada en
  `/opt/lampp/htdocs/deportes`). **No reiniciar XAMPP**: en esta máquina lo usan otros proyectos.
- Ver una respuesta: una sola llamada con `curl`, por ejemplo
  `curl -s 'https://www.thesportsdb.com/api/v1/json/123/eventsround.php?id=4350&r=1&s=2026-2027'`.
  Dejar 5 s o más entre llamadas. Si responde `error code: 1015`, esperar 2 minutos.
- En el navegador, la caché hace que las pruebas repetidas casi no consuman consultas. "Actualizar datos"
  vuelve a gastar ~19 o más.
