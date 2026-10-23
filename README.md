# La Jugada — quinielas y análisis deportivo

- `Main.dc.html` — inicio (quinielas). Es el diseño exportado; `support.js` y `vendor/` son su runtime.
- `analisis.html` — **Análisis por liga**: una tabla por liga con los últimos 15 partidos de cada equipo
  (local / visitante / neutral), goles por partido, G-E-P de local y de visita, altitud del estadio y del
  centro de entrenamiento, zona del país y lesionados. Incluye el historial directo del partido de la semana.
  - `js/analisis.js` — lógica y conexión a la API.
  - `data/equipos.js` — altitudes y zonas (valores aproximados; edítalo para agregar o corregir equipos).
- `PROMPTS.md` — prompts para pedir esta sección en la herramienta de diseño.

## Clave de API-Football

1. Crea una cuenta gratis en https://dashboard.api-football.com/register y copia tu clave.
2. Abre `analisis.html`, pega la clave y presiona **Generar tablas**.

La clave se guarda solo en tu navegador, no en el repositorio. El plan gratis da 100 consultas al día;
cada liga usa unas 4–6 y quedan guardadas 12 horas ("Actualizar datos" las vuelve a pedir).
Si la API dice que tu plan no incluye la temporada, escribe una temporada permitida en el campo "Temporada".

IDs útiles: Liga de Expansión MX 263 · Liga MX 262 · Ligue 1 61 · Liga Profesional Argentina 128.

## Ver la página

Sirve la carpeta (por ejemplo `python -m http.server`) y abre `http://localhost:8000/analisis.html`;
algunos navegadores bloquean los scripts al abrir el archivo directo.
