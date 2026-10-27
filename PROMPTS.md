# Prompts para la sección "Análisis"

Los prompts 1–5 (API-Football) son históricos: esa parte se quitó de la página. Prompts listos para pegar, en orden, en la herramienta de diseño donde se creó
"Inicio · Jornada". Cada uno parte del resultado del anterior.

1. **Sección nueva**
   > Agrega al menú lateral de La Jugada una sección "Análisis". Debe tener un selector de ligas (Liga de Expansión MX, Ligue 1 de Francia, Liga Profesional de Argentina y un botón para agregar otras ligas) y generar una tabla por cada liga elegida, con el mismo estilo oscuro y verde lima del inicio.

2. **Últimos 15 partidos, goles y resultados**
   > En cada tabla, por equipo, muestra de sus últimos 15 partidos: cuántos jugó de local, cuántos de visitante y cuántos en cancha neutral (ninguno de los dos fue local); el promedio de goles por partido (a favor, en contra y total); cuántos ganó, empató y perdió siendo local, y cuántos ganó, empató y perdió siendo visitante. Que las columnas se puedan ordenar al tocarlas.

3. **Altitud, zona y lesionados**
   > Agrega columnas con la altitud sobre el nivel del mar del estadio y del centro de entrenamiento de cada equipo, la zona del país donde está (Norte, Sur, Este u Oeste) y la cantidad de lesionados actuales. En celular, la tabla debe desplazarse de lado sin mover la página.

4. **Partido de la semana**
   > Agrega un panel "Partido de la semana" con los partidos de los próximos 7 días. Al elegir uno (o al escoger dos equipos a mano), muestra el historial directo: cuántas veces ganó cada equipo y cuántas empataron, separado por local y visitante, con la lista de los últimos enfrentamientos.

5. **Datos en vivo**
   > Conecta los datos a API-Football (v3). El usuario escribe su clave en la página y se guarda solo en su navegador, nunca en el código. Guarda las respuestas 12 horas para no pasar del límite gratis de 100 consultas al día, y muestra un aviso claro si la clave falla o el plan no incluye la temporada.

## Datos TheSportsDB (Fútbol y NFL)

6. **Sección con pestañas**
   > Dentro de "Análisis", agrega una tarjeta "Datos TheSportsDB" con pestañas Fútbol y NFL. En Fútbol, chips para Liga MX, Ligue 1, Primera División de Argentina y Premier League, y un campo para agregar otra liga por ID. Arriba, selector de temporada (y de torneo cuando la temporada tenga Apertura y Clausura) y un botón "Actualizar datos". Debajo, el encabezado de la liga con logo, país, año de fundación, redes, derechos de TV y la descripción recortada a 3 líneas con "Ver más".

7. **Posiciones y partidos**
   > Muestra la tabla de posiciones (#, equipo, PJ, G, E, P, GF, GC, DIF, PTS y los últimos 5 como círculos lima/gris/naranja, el más reciente a la izquierda). En NFL agrúpala por las 8 divisiones con J, G, P, E, %, PF, PC, DIF y racha. Debajo, un bloque "Partidos" con cuatro vistas: Por jornada (con selector), Próximos, Tendencias (G-E-P de local y de visita, promedios a favor y en contra, racha) y Cara a cara entre dos equipos.

8. **Fichas**
   > Al tocar un partido, abre un panel con el marcador (por cuarto en NFL), fecha, estadio, asistencia, enlace al video y pestañas Estadísticas (barras enfrentadas), Alineaciones, Cronología y TV. Al tocar un equipo, abre su ficha con banner, colores, estadio y pestañas Partidos, Plantilla (agrupada por posición), Estadio (foto, capacidad, mapa) y Uniformes. Al tocar un jugador, muestra su ficha con estadísticas, equipos anteriores, palmarés, hitos y contratos, y un botón para volver al equipo. Si un dato no existe, la pestaña lo dice.
