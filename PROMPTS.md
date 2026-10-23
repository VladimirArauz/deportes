# Prompts para la sección "Análisis"

Prompts listos para pegar, en orden, en la herramienta de diseño donde se creó
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
