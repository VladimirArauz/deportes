# La Jugada — quinielas y análisis deportivo

- `Main.dc.html` — inicio (quinielas). Es el diseño exportado; `support.js` y `vendor/` son su runtime.
- `analisis.html` — **Análisis por liga**, con pestañas **Fútbol | NFL** y datos de TheSportsDB:
  liga, tabla de posiciones, partidos por jornada, próximos, tendencias de local y visita, cara a cara,
  fichas de equipo (estadio, uniformes, plantilla), ficha de jugador y detalle de partido (estadísticas,
  alineaciones, cronología, TV y marcador por cuarto en la NFL).
  - `js/sportsdb.js` — cliente de la API: fila de consultas, caché y una función por dato.
  - `js/sportsdb-ui.js` — pantallas y cálculos.
  - `data/nfl.js` — divisiones de la NFL (la API no publica tabla de la NFL).
  - `data/equipos.js` — altitudes y zonas de los equipos (valores aproximados; mandan sobre lo calculado).
  - `data/lesionados.js` — lesionados (bajas y en duda) por equipo, capturados a mano: la API gratis no los da.
  - `data/ligas.js` — catálogo de ligas de fútbol por país para el buscador "Todas las ligas".
  - Vista **Local / Visita**: G/E/P de local, visita y neutral, últimos 10 partidos en verde/naranja/rojo,
    altitud del estadio (Open-Meteo), zona del país y lesionados.
- **`docs/API_THESPORTSDB.md` — cómo funciona la API, qué da y qué no, y dónde hacer cambios. Léelo antes
  de pedir un dato nuevo.**
- `PROMPTS.md` — prompts para la herramienta de diseño.
- `PLAN_THESPORTSDB.md` — plan y prompts por fase con los que se hizo la integración.

## Datos

No necesita cuenta ni clave: usa la versión gratis de TheSportsDB. La tabla, las tendencias y los próximos
salen completos porque se calculan con las jornadas completas. Algunas listas vienen recortadas (plantilla
de 10 jugadores, 5 estadísticas por partido…) y la página lo avisa. Detalle en `docs/API_THESPORTSDB.md`.

La primera vez que abres una liga tarda (una consulta cada 5 s, una por jornada jugada; Liga MX ≈ 1.5 min).
Después todo queda guardado en el navegador y carga en segundos. "Actualizar datos" lo vuelve a pedir.

## Ver la página

Con XAMPP: `http://localhost/deportes/analisis.html` (la carpeta está enlazada en `/opt/lampp/htdocs/deportes`).
También sirve `python -m http.server` en esta carpeta y abrir `http://localhost:8000/analisis.html`;
algunos navegadores bloquean los scripts si abres el archivo directo.
