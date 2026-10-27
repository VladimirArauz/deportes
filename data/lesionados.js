// Lesionados por equipo. TheSportsDB gratis no da este dato: se captura a mano.
// `nombres` son variantes del nombre (sin acentos) para empatar con la API, igual que data/equipos.js.
// `bajas`: no jugarán. `duda`: posiblemente jueguen. La tabla "Local / Visita" muestra cuántos hay
// y, al pasar el cursor, los nombres. Un equipo que no está aquí sale como "—" (sin datos).
// Actualiza `actualizado` cada vez que cambies la lista.
window.LESIONADOS = {
  actualizado: '',
  equipos: [
    // Ejemplo (copia la línea, quita las barras y ajusta):
    // { nombres: ['club america'], bajas: ['Jugador A (rodilla)'], duda: ['Jugador B (molestia muscular)'] },
  ]
};
