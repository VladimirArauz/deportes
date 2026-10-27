// Cliente de TheSportsDB (v1): fila de peticiones, caché en localStorage y funciones por dato.
// Expone window.SportsDB. La interfaz está en js/sportsdb-ui.js.
(function () {
  'use strict';

  var BASE = 'https://www.thesportsdb.com/api/v1/json/';
  var CLAVE = '123';          // clave pública de la versión gratis (no requiere cuenta)
  // La documentación dice 30/min, pero Cloudflare corta antes (docs/API_THESPORTSDB.md).
  // Tras un corte se espera y se reintenta, y por 10 minutos se va más despacio.
  var ESPACIO_MS = 5000;
  var ESPACIO_LENTO_MS = 10000;
  var LENTO_DURANTE_MS = 600000;
  var ESPERAS_MS = [70000, 120000];
  var PREFIJO = 'sdb:cache:';

  // Tope de resultados por endpoint en la versión gratis. Si una lista llega al tope, viene recortada.
  var LIMITES = {
    'lookuptable.php': 5, 'search_all_teams.php': 10, 'lookup_all_players.php': 10,
    'eventsseason.php': 15, 'eventspastleague.php': 1, 'eventsnextleague.php': 1,
    'eventslast.php': 1, 'eventsnext.php': 1, 'eventsday.php': 3,
    'search_all_seasons.php': 5, 'lookupequipment.php': 2, 'eventshighlights.php': 2,
    'lookuphonours.php': 5, 'lookupformerteams.php': 5, 'lookupmilestones.php': 5,
    'lookupcontracts.php': 1, 'lookupplayerstats.php': 10, 'playerresults.php': 5,
    'lookupeventstats.php': 5, 'lookuplineup.php': 5, 'lookuptimeline.php': 5,
    'lookuptv.php': 2, 'eventresults.php': 5
  };

  // ---------- almacenamiento (puede no estar disponible) ----------
  function leer(k, def) {
    try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function guardar(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* lleno o bloqueado: seguimos sin caché */ }
  }
  function borrarCache() {
    try {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIJO) === 0) localStorage.removeItem(k); });
    } catch (e) { /* nada */ }
  }

  function prefijo() { return PREFIJO + 'g:'; }

  function avisar(nombre, detalle) {
    try { window.dispatchEvent(new CustomEvent(nombre, { detail: detalle })); } catch (e) { /* nada */ }
  }

  // ---------- fila de peticiones ----------
  var cola = Promise.resolve();
  var ultima = 0;
  var lentoHasta = 0;
  var enVuelo = {};
  var cuenta = { pendientes: 0, hechas: 0 };

  function dormir(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  function bajar(ruta) {
    return fetch(BASE + CLAVE + '/' + ruta).then(function (r) {
      return r.text().then(function (txt) {
        if (r.status === 429 || /error code: 1015/.test(txt)) { var e = new Error('limite'); e.limite = true; throw e; }
        if (!r.ok) throw new Error('TheSportsDB respondió ' + r.status + '.');
        try { return JSON.parse(txt); } catch (x) { throw new Error('TheSportsDB devolvió una respuesta inválida.'); }
      });
    }, function () {
      // Cuando Cloudflare corta por límite, la respuesta no trae CORS y fetch falla sin estado.
      var e = new Error('limite'); e.limite = true; e.red = true; throw e;
    });
  }

  function turno(ruta) {
    cuenta.pendientes++;
    avisar('sdb:fila', cuenta);
    var intentar = function (n) {
      ultima = Date.now();
      return bajar(ruta).catch(function (e) {
        if (!e.limite) throw e;
        lentoHasta = Date.now() + LENTO_DURANTE_MS;
        if (n >= ESPERAS_MS.length) {
          throw new Error(e.red ? 'No hay conexión con TheSportsDB o la API sigue limitando las consultas. Intenta en unos minutos.'
            : 'TheSportsDB sigue limitando las consultas. Intenta en unos minutos.');
        }
        avisar('sdb:espera', { segundos: Math.round(ESPERAS_MS[n] / 1000) });
        return dormir(ESPERAS_MS[n]).then(function () { return intentar(n + 1); });
      });
    };
    var p = cola.then(function () {
      var espacio = Date.now() < lentoHasta ? ESPACIO_LENTO_MS : ESPACIO_MS;
      var falta = ultima + espacio - Date.now();
      return falta > 0 ? dormir(falta) : null;
    }).then(function () { return intentar(0); });
    var fin = function () { cuenta.pendientes--; cuenta.hechas++; avisar('sdb:fila', cuenta); };
    cola = p.then(fin, fin);
    return p;
  }

  // pedir(ruta, horas, compactar): JSON de la API (o lo que devuelva `compactar`), con caché de `horas`.
  function pedir(ruta, horas, compactar) {
    var k = prefijo() + ruta;
    var c = leer(k, null);
    if (c && Date.now() - c.t < horas * 3600e3) return Promise.resolve(c.d);
    if (enVuelo[ruta]) return enVuelo[ruta];
    var p = turno(ruta).then(function (j) {
      var d = compactar ? compactar(j) : j;
      if (horas > 0) guardar(k, { t: Date.now(), d: d });
      return d;
    });
    enVuelo[ruta] = p;
    var limpiar = function () { delete enVuelo[ruta]; };
    p.then(limpiar, limpiar);
    return p;
  }

  function estaRecortado(endpoint, n) {
    var l = LIMITES[endpoint];
    return !!l && n >= l;
  }

  function lista(j, k) { return (j && Array.isArray(j[k])) ? j[k] : []; }
  function q(v) { return encodeURIComponent(v); }
  function num(v) { return v == null || v === '' ? null : Number(v); }

  // Copia solo los campos con valor, para que la caché ocupe poco.
  function tomar(o, campos) {
    var r = {};
    campos.forEach(function (c) { if (o[c] != null && o[c] !== '') r[c] = o[c]; });
    return r;
  }
  function descripcion(o) { return o.strDescriptionES || o.strDescriptionEN || ''; }

  var H = { semana: 24 * 7, dia: 24, resultados: 6, proximos: 1 };

  // ---------- liga ----------
  function liga(id) {
    return pedir('lookupleague.php?id=' + q(id), H.semana, function (j) {
      var l = lista(j, 'leagues')[0];
      if (!l) return null;
      var r = tomar(l, ['idLeague', 'strLeague', 'strLeagueAlternate', 'strSport', 'strCountry', 'strCurrentSeason',
        'intFormedYear', 'dateFirstEvent', 'strWebsite', 'strFacebook', 'strTwitter', 'strYoutube', 'strInstagram',
        'strBadge', 'strLogo', 'strBanner', 'strTrophy', 'strPoster', 'strFanart1', 'strTvRights', 'intDivision', 'idAPIfootballv3']);
      r.desc = descripcion(l);
      return r;
    });
  }

  // Ligas de fútbol de un país. La versión gratis da solo las primeras 5 en orden alfabético,
  // por eso el catálogo principal está en data/ligas.js.
  function ligasPais(pais) {
    return pedir('search_all_leagues.php?c=' + q(pais) + '&s=Soccer', H.semana, function (j) {
      return lista(j, 'countries').map(function (l) { return { id: l.idLeague, n: l.strLeague, pais: l.strCountry }; });
    });
  }

  function tabla(id, temporada) {
    return pedir('lookuptable.php?l=' + q(id) + '&s=' + q(temporada), H.resultados, function (j) {
      return lista(j, 'table').map(function (t) {
        return {
          rank: num(t.intRank), id: t.idTeam, eq: t.strTeam, escudo: t.strBadge, grupo: t.strGroup || '',
          forma: t.strForm || '', zona: t.strDescription || '', pj: num(t.intPlayed), g: num(t.intWin),
          e: num(t.intDraw), p: num(t.intLoss), gf: num(t.intGoalsFor), gc: num(t.intGoalsAgainst),
          dif: num(t.intGoalDifference), pts: num(t.intPoints), act: t.dateUpdated
        };
      });
    });
  }

  // ---------- equipos ----------
  var CAMPOS_EQUIPO = ['idTeam', 'idAPIfootball', 'idESPN', 'idVenue', 'strTeam', 'strTeamAlternate', 'strTeamShort',
    'intFormedYear', 'strStadium', 'strLocation', 'strCountry', 'strWebsite', 'strFacebook', 'strTwitter',
    'strInstagram', 'strYoutube', 'strColour1', 'strColour2', 'strColour3', 'strBadge', 'strLogo', 'strBanner',
    'strEquipment', 'strFanart1', 'strKeywords', 'strLeague', 'intStadiumCapacity'];
  function compactarEquipo(t) {
    var r = tomar(t, CAMPOS_EQUIPO);
    r.desc = descripcion(t);
    r.ligas = [];
    for (var i = 2; i <= 7; i++) if (t['strLeague' + i]) r.ligas.push(t['strLeague' + i]);
    return r;
  }

  function equipos(nombreLiga) {
    return pedir('search_all_teams.php?l=' + q(nombreLiga), H.semana, function (j) {
      return lista(j, 'teams').map(compactarEquipo);
    });
  }
  function equipo(id) {
    return pedir('lookupteam.php?id=' + q(id), H.semana, function (j) {
      var t = lista(j, 'teams')[0];
      return t ? compactarEquipo(t) : null;
    });
  }

  // ---------- partidos ----------
  function compactarPartido(e) {
    return {
      id: e.idEvent, liga: e.idLeague, nLiga: e.strLeague, temp: e.strSeason, ronda: num(e.intRound),
      h: e.idHomeTeam, a: e.idAwayTeam, hN: e.strHomeTeam, aN: e.strAwayTeam,
      hE: e.strHomeTeamBadge, aE: e.strAwayTeamBadge, hG: num(e.intHomeScore), aG: num(e.intAwayScore),
      ts: e.strTimestamp ? Date.parse(e.strTimestamp + (/Z|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? '' : 'Z')) : Date.parse(e.dateEvent),
      fecha: e.dateEvent, sede: e.strVenue, idSede: e.idVenue, pais: e.strCountry, ciudad: e.strCity,
      publico: num(e.intSpectators), estado: e.strStatus || '', aplazado: e.strPostponed === 'yes',
      thumb: e.strThumb, poster: e.strPoster, video: e.strVideo, arbitro: e.strOfficial, grupo: e.strGroup,
      res: e.strResult || undefined
    };
  }
  function partidosDe(k) { return function (j) { return lista(j, k).map(compactarPartido); }; }

  function temporada(idLiga, temp, horas) {
    return pedir('eventsseason.php?id=' + q(idLiga) + '&s=' + q(temp), horas || H.resultados, partidosDe('events'));
  }
  function ultimosLiga(id) { return pedir('eventspastleague.php?id=' + q(id), H.resultados, partidosDe('events')); }
  function proximosLiga(id) { return pedir('eventsnextleague.php?id=' + q(id), H.proximos, partidosDe('events')); }
  function ultimosEquipo(id) { return pedir('eventslast.php?id=' + q(id), H.resultados, partidosDe('results')); }
  function proximosEquipo(id) { return pedir('eventsnext.php?id=' + q(id), H.proximos, partidosDe('events')); }
  function dia(fecha, idLiga) { return pedir('eventsday.php?d=' + q(fecha) + '&l=' + q(idLiga), H.resultados, partidosDe('events')); }

  // Jornada completa (no recortada en el plan gratis). Si ya terminó toda, se guarda una semana.
  var TERMINADO = /^(FT|AET|PEN|AOT|AP|Match Finished|After Over Time)$/i;
  function terminado(p) { return TERMINADO.test(p.estado) || (p.hG != null && p.aG != null && p.ts < Date.now() - 6 * 3600e3); }
  function jornada(idLiga, temp, ronda) {
    var ruta = 'eventsround.php?id=' + q(idLiga) + '&r=' + q(ronda) + '&s=' + q(temp);
    var k = prefijo() + ruta;
    var c = leer(k, null);
    if (c && c.cerrada) return Promise.resolve(c.d);
    return pedir(ruta, H.proximos, partidosDe('events')).then(function (lista) {
      if (lista.length && lista.every(terminado)) guardar(k, { t: Date.now(), d: lista, cerrada: true });
      return lista;
    });
  }

  // ---------- detalle de partido ----------
  function partido(id) {
    return pedir('lookupevent.php?id=' + q(id), H.proximos, function (j) {
      var e = lista(j, 'events')[0];
      if (!e) return null;
      var p = compactarPartido(e);
      p.resultado = e.strResult || '';
      p.banner = e.strBanner;
      p.desc = descripcion(e);
      return p;
    });
  }
  function estadisticas(id) {
    return pedir('lookupeventstats.php?id=' + q(id), H.dia, function (j) {
      return lista(j, 'eventstats').map(function (s) { return { stat: s.strStat, h: s.intHome, a: s.intAway }; });
    });
  }
  function alineacion(id) {
    return pedir('lookuplineup.php?id=' + q(id), H.dia, function (j) {
      return lista(j, 'lineup').map(function (x) {
        return { id: x.idPlayer, n: x.strPlayer, pos: x.strPosition, num: x.intSquadNumber, local: x.strHome === 'Yes', sup: x.strSubstitute === 'Yes', eq: x.strTeam, foto: x.strCutout || x.strThumb };
      });
    });
  }
  function cronologia(id) {
    return pedir('lookuptimeline.php?id=' + q(id), H.dia, function (j) {
      return lista(j, 'timeline').map(function (x) {
        return { tipo: x.strTimeline, det: x.strTimelineDetail, min: num(x.intTime), local: x.strHome === 'Yes', jug: x.strPlayer, asis: x.strAssist, eq: x.strTeam, com: x.strComment === 'NULL' ? '' : x.strComment };
      });
    });
  }
  function tv(id) {
    return pedir('lookuptv.php?id=' + q(id), H.dia, function (j) {
      return lista(j, 'tvevent').map(function (x) { return { canal: x.strChannel, pais: x.strCountry, logo: x.strLogo }; });
    });
  }
  function videos(fecha, idLiga) {
    return pedir('eventshighlights.php?d=' + q(fecha) + '&l=' + q(idLiga), H.dia, function (j) {
      return lista(j, 'tvhighlights').map(function (x) { return { id: x.idEvent, ev: x.strEvent, video: x.strVideo, thumb: x.strThumb }; });
    });
  }

  // ---------- estadio, uniformes, jugadores ----------
  function estadio(id) {
    return pedir('lookupvenue.php?id=' + q(id), H.semana, function (j) {
      var v = lista(j, 'venues')[0];
      if (!v) return null;
      var r = tomar(v, ['idVenue', 'strVenue', 'strVenueAlternate', 'strVenueSponsor', 'intCapacity', 'strCost',
        'strArchitect', 'strLocation', 'strCountry', 'strTimezone', 'strMap', 'intFormedYear', 'strThumb',
        'strFanart1', 'strFanart2', 'strLogo', 'strWebsite']);
      r.desc = descripcion(v);
      return r;
    });
  }
  // strMap viene como "19°19′32.5″N 98°13′49.5″W" o como "19.32, -98.23". Devuelve [lat, lon] o null.
  function coordenadas(s) {
    s = String(s || '');
    var re = /(\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]\s*)?([NSEWO])/gi, m, lat = null, lon = null;
    while ((m = re.exec(s))) {
      var v = +m[1] + (+m[2] || 0) / 60 + (+m[3] || 0) / 3600, h = m[4].toUpperCase();
      if (h === 'S' || h === 'W' || h === 'O') v = -v;
      if (h === 'N' || h === 'S') lat = v; else lon = v;
    }
    if (lat == null || lon == null) {
      m = /(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/.exec(s.replace(/°/g, ''));
      if (!m) return null;
      lat = +m[1]; lon = +m[2];
    }
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
  }

  // Altitud (m s. n. m.) de varios puntos con Open-Meteo: gratis, sin clave y fuera de la fila de
  // TheSportsDB. Cada punto se guarda sin vencimiento (la altitud no cambia).
  var ALT = PREFIJO + 'g:alt:';
  function altitudes(coords) {
    var clave = function (c) { return ALT + c[0].toFixed(4) + ',' + c[1].toFixed(4); };
    var faltan = coords.filter(function (c) { return leer(clave(c), null) == null; });
    var listo = function () { return coords.map(function (c) { return leer(clave(c), null); }); };
    if (!faltan.length) return Promise.resolve(listo());
    var lotes = [];
    for (var i = 0; i < faltan.length; i += 100) lotes.push(faltan.slice(i, i + 100));
    return Promise.all(lotes.map(function (l) {
      var url = 'https://api.open-meteo.com/v1/elevation?latitude=' + l.map(function (c) { return c[0].toFixed(4); }).join(',') +
        '&longitude=' + l.map(function (c) { return c[1].toFixed(4); }).join(',');
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('Open-Meteo respondió ' + r.status + '.');
        return r.json();
      }).then(function (j) {
        (j.elevation || []).forEach(function (e, k) { if (e != null) guardar(clave(l[k]), Math.round(e)); });
      });
    })).then(listo);
  }

  function uniformes(id) {
    return pedir('lookupequipment.php?id=' + q(id), H.semana, function (j) {
      return lista(j, 'equipment').map(function (x) { return { temp: x.strSeason, tipo: x.strType, img: x.strEquipment }; });
    });
  }
  var CAMPOS_JUGADOR = ['idPlayer', 'idTeam', 'strPlayer', 'strTeam', 'strPosition', 'strNumber', 'dateBorn',
    'strNationality', 'strBirthLocation', 'strHeight', 'strWeight', 'strThumb', 'strCutout', 'strStatus',
    'strSide', 'strSigning', 'strWage', 'strCollege', 'strAgent', 'strKit'];
  function compactarJugador(p) { var r = tomar(p, CAMPOS_JUGADOR); r.desc = descripcion(p); return r; }
  function plantilla(idEquipo) {
    return pedir('lookup_all_players.php?id=' + q(idEquipo), H.semana, function (j) {
      return lista(j, 'player').map(compactarJugador);
    });
  }
  function jugador(id) {
    return pedir('lookupplayer.php?id=' + q(id), H.semana, function (j) {
      var p = lista(j, 'players')[0];
      return p ? compactarJugador(p) : null;
    });
  }
  // Datos extra del jugador: devuelven listas de objetos con los campos que traiga la API.
  var EXTRAS_JUGADOR = {
    stats: ['lookupplayerstats.php', 'playerstats'], equipos: ['lookupformerteams.php', 'formerteams'],
    honores: ['lookuphonours.php', 'honours'], hitos: ['lookupmilestones.php', 'milestones'],
    contratos: ['lookupcontracts.php', 'contracts'], resultados: ['playerresults.php', 'results']
  };
  function extraJugador(tipo, id) {
    var e = EXTRAS_JUGADOR[tipo];
    return pedir(e[0] + '?id=' + q(id), H.semana, function (j) {
      return lista(j, e[1]).map(function (x) {
        var r = {};
        Object.keys(x).forEach(function (k) {
          var v = x[k];
          if (v == null || v === '' || /^id|Locked$|^strSport$|Cutout$|Thumb$/.test(k)) return;
          r[k] = v;
        });
        return r;
      });
    });
  }

  window.SportsDB = {
    pedir: pedir, borrarCache: borrarCache,
    estaRecortado: estaRecortado, cuenta: cuenta, lista: lista, q: q, num: num, tomar: tomar, H: H,
    liga: liga, ligasPais: ligasPais, coordenadas: coordenadas, altitudes: altitudes, tabla: tabla, equipos: equipos, equipo: equipo, temporada: temporada,
    ultimosLiga: ultimosLiga, proximosLiga: proximosLiga, ultimosEquipo: ultimosEquipo,
    proximosEquipo: proximosEquipo, dia: dia, jornada: jornada, terminado: terminado,
    partido: partido, estadisticas: estadisticas, alineacion: alineacion, cronologia: cronologia,
    tv: tv, videos: videos, estadio: estadio, uniformes: uniformes, plantilla: plantilla,
    jugador: jugador, extraJugador: extraJugador, compactarPartido: compactarPartido
  };
})();
