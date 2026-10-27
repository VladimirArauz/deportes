// Catálogo del buscador "Todas las ligas" (analisis.html). La versión gratis de TheSportsDB solo
// lista 5 ligas por país, así que aquí van las principales con su ID verificado (2026-10-26).
// `c` = nombre del país en la API: al elegirlo, se suman las ligas que devuelva search_all_leagues.
// Para agregar una: verifica el ID con lookupleague.php?id= y copia una línea.
window.LIGAS = [
  { pais: 'México', c: 'Mexico', ligas: [
    { id: '4350', n: 'Liga MX' }, { id: '4654', n: 'Liga de Expansión MX' }] },
  { pais: 'Internacional · América', ligas: [
    { id: '4501', n: 'Copa Libertadores' }, { id: '4724', n: 'Copa Sudamericana' },
    { id: '4721', n: 'Concacaf Champions Cup' }, { id: '5281', n: 'Leagues Cup' }] },
  { pais: 'Internacional · Europa', ligas: [
    { id: '4480', n: 'UEFA Champions League' }, { id: '4481', n: 'UEFA Europa League' },
    { id: '5071', n: 'UEFA Conference League' }, { id: '4502', n: 'Eurocopa' }] },
  { pais: 'Internacional · Selecciones', ligas: [{ id: '4429', n: 'Copa Mundial de la FIFA' }] },
  { pais: 'Inglaterra', c: 'England', ligas: [
    { id: '4328', n: 'Premier League' }, { id: '4329', n: 'Championship' }, { id: '4396', n: 'League One' },
    { id: '4397', n: 'League Two' }, { id: '4482', n: 'FA Cup' }, { id: '4570', n: 'EFL Cup' }] },
  { pais: 'España', c: 'Spain', ligas: [
    { id: '4335', n: 'LaLiga' }, { id: '4400', n: 'LaLiga 2' }, { id: '4483', n: 'Copa del Rey' }] },
  { pais: 'Italia', c: 'Italy', ligas: [
    { id: '4332', n: 'Serie A' }, { id: '4394', n: 'Serie B' }, { id: '4506', n: 'Coppa Italia' }] },
  { pais: 'Francia', c: 'France', ligas: [
    { id: '4334', n: 'Ligue 1' }, { id: '4401', n: 'Ligue 2' }, { id: '4484', n: 'Coupe de France' }] },
  { pais: 'Alemania', c: 'Germany', ligas: [
    { id: '4331', n: 'Bundesliga' }, { id: '4399', n: '2. Bundesliga' }, { id: '4485', n: 'DFB-Pokal' }] },
  { pais: 'Argentina', c: 'Argentina', ligas: [{ id: '4406', n: 'Primera División' }] },
  { pais: 'Brasil', c: 'Brazil', ligas: [{ id: '4351', n: 'Brasileirão Serie A' }, { id: '4404', n: 'Brasileirão Serie B' }] },
  { pais: 'Colombia', c: 'Colombia', ligas: [{ id: '4497', n: 'Liga DIMAYOR' }] },
  { pais: 'Chile', c: 'Chile', ligas: [{ id: '4627', n: 'Primera División' }] },
  { pais: 'Perú', c: 'Peru', ligas: [{ id: '4688', n: 'Liga 1' }] },
  { pais: 'Uruguay', c: 'Uruguay', ligas: [{ id: '4432', n: 'Primera División' }] },
  { pais: 'Estados Unidos', c: 'United States', ligas: [{ id: '4346', n: 'MLS' }] },
  { pais: 'Países Bajos', c: 'The Netherlands', ligas: [{ id: '4337', n: 'Eredivisie' }] },
  { pais: 'Portugal', c: 'Portugal', ligas: [{ id: '4344', n: 'Primeira Liga' }] },
  { pais: 'Bélgica', c: 'Belgium', ligas: [{ id: '4338', n: 'Pro League' }] },
  { pais: 'Escocia', c: 'Scotland', ligas: [{ id: '4330', n: 'Premiership' }] },
  { pais: 'Turquía', c: 'Turkey', ligas: [{ id: '4339', n: 'Süper Lig' }] },
  { pais: 'Grecia', c: 'Greece', ligas: [{ id: '4336', n: 'Super League 1' }] },
  { pais: 'Rusia', c: 'Russia', ligas: [{ id: '4355', n: 'Premier League rusa' }] },
  { pais: 'Austria', c: 'Austria', ligas: [{ id: '4621', n: 'Bundesliga austriaca' }] },
  { pais: 'Suiza', c: 'Switzerland', ligas: [{ id: '4675', n: 'Super League suiza' }] },
  { pais: 'Dinamarca', c: 'Denmark', ligas: [{ id: '4340', n: 'Superliga' }] },
  { pais: 'Suecia', c: 'Sweden', ligas: [{ id: '4347', n: 'Allsvenskan' }] },
  { pais: 'Noruega', c: 'Norway', ligas: [{ id: '4358', n: 'Eliteserien' }] },
  { pais: 'Arabia Saudita', c: 'Saudi Arabia', ligas: [{ id: '4668', n: 'Saudi Pro League' }] },
  { pais: 'Japón', c: 'Japan', ligas: [{ id: '4633', n: 'J1 League' }] },
  { pais: 'Corea del Sur', c: 'South Korea', ligas: [{ id: '4689', n: 'K League 1' }] },
  { pais: 'China', c: 'China', ligas: [{ id: '4359', n: 'Super League china' }] },
  { pais: 'Australia', c: 'Australia', ligas: [{ id: '4356', n: 'A-League' }] }
];
