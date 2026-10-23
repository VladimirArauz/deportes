// Análisis por liga: datos en vivo de API-Football (v3) + altitudes/zonas de data/equipos.js.
(function () {
  'use strict';

  var API = 'https://v3.football.api-sports.io';
  var HORAS_CACHE = 12;
  var TERMINADOS = { FT: 1, AET: 1, PEN: 1 };
  var PENDIENTES = { NS: 1, TBD: 1 };
  var LIGAS_BASE = [
    { id: 263, nombre: 'Liga de Expansión MX' },
    { id: 61, nombre: 'Ligue 1 · Francia' },
    { id: 128, nombre: 'Liga Profesional · Argentina' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('cache:') === 0) localStorage.removeItem(k); });
    } catch (e) { /* nada */ }
  }

  // ---------- cliente de la API ----------
  var restantes = null;

  function pedir(ruta) {
    var clave = leer('api:clave', '');
    if (!clave) return Promise.reject(new Error('Falta la clave de API-Football.'));
    return fetch(API + ruta, { headers: { 'x-apisports-key': clave } }).then(function (r) {
      var rest = r.headers.get('x-ratelimit-requests-remaining');
      if (rest != null) restantes = rest;
      if (!r.ok) throw new Error('La API respondió ' + r.status + '.');
      return r.json();
    }).then(function (j) {
      var errs = j.errors;
      var msgs = Array.isArray(errs) ? errs : Object.keys(errs || {}).map(function (k) { return errs[k]; });
      if (msgs.length) throw new Error(msgs.join(' '));
      return j.response || [];
    });
  }

  // Guarda la versión reducida del resultado para no llenar el almacenamiento.
  function conCache(clave, horas, fn) {
    var c = leer('cache:' + clave, null);
    if (c && Date.now() - c.t < horas * 3600e3) return Promise.resolve(c.d);
    return fn().then(function (d) { guardar('cache:' + clave, { t: Date.now(), d: d }); return d; });
  }

  function compactarPartido(f) {
    return {
      id: f.fixture.id, ts: f.fixture.timestamp, st: f.fixture.status.short,
      vId: f.fixture.venue && f.fixture.venue.id, vN: f.fixture.venue && f.fixture.venue.name,
      h: f.teams.home.id, hN: f.teams.home.name, a: f.teams.away.id, aN: f.teams.away.name,
      hG: f.goals.home, aG: f.goals.away
    };
  }

  function infoLiga(id) {
    return conCache('liga:' + id, 24 * 7, function () {
      return pedir('/leagues?id=' + id).then(function (r) {
        if (!r.length) throw new Error('No existe la liga ' + id + '.');
        var l = r[0];
        var actual = l.seasons.filter(function (s) { return s.current; })[0] || l.seasons[l.seasons.length - 1];
        var lesiones = {};
        l.seasons.forEach(function (s) { lesiones[s.year] = !!(s.coverage && s.coverage.injuries); });
        return { id: id, nombre: l.league.name, pais: l.country.name, logo: l.league.logo, actual: actual.year, lesiones: lesiones };
      });
    });
  }

  function equipos(liga, temp) {
    return conCache('equipos:' + liga + ':' + temp, HORAS_CACHE * 4, function () {
      return pedir('/teams?league=' + liga + '&season=' + temp).then(function (r) {
        return r.map(function (t) {
          return { id: t.team.id, nombre: t.team.name, logo: t.team.logo, vId: t.venue && t.venue.id, vN: t.venue && t.venue.name };
        });
      });
    });
  }

  function partidos(liga, temp) {
    return conCache('partidos:' + liga + ':' + temp, HORAS_CACHE, function () {
      return pedir('/fixtures?league=' + liga + '&season=' + temp).then(function (r) { return r.map(compactarPartido); });
    });
  }

  function lesiones(liga, temp) {
    return conCache('lesiones:' + liga + ':' + temp, HORAS_CACHE, function () {
      return pedir('/injuries?league=' + liga + '&season=' + temp).then(function (r) {
        return r.map(function (x) {
          return { t: x.team.id, f: x.fixture.id, ts: x.fixture.timestamp, j: x.player.id, motivo: x.player.reason || '' };
        });
      });
    });
  }

  function historial(a, b) {
    var par = Math.min(a, b) + '-' + Math.max(a, b);
    return conCache('h2h:' + par, 24, function () {
      return pedir('/fixtures/headtohead?h2h=' + par).then(function (r) { return r.map(compactarPartido); });
    });
  }

  // ---------- datos propios (altitud / zona) ----------
  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  var EXTRA = (window.EQUIPOS || []).map(function (e) {
    return { e: e, nombres: e.nombres.map(normalizar) };
  });
  // Primero coincidencia exacta; si no, el alias más largo contenido como palabras completas.
  function datosPropios(nombre) {
    var n = normalizar(nombre), mejor = null, largo = 0;
    for (var i = 0; i < EXTRA.length; i++) {
      for (var j = 0; j < EXTRA[i].nombres.length; j++) {
        var al = EXTRA[i].nombres[j];
        if (al === n) return EXTRA[i].e;
        if ((' ' + n + ' ').indexOf(' ' + al + ' ') >= 0 && al.length > largo) { mejor = EXTRA[i].e; largo = al.length; }
      }
    }
    return mejor;
  }

  // ---------- cálculos ----------
  function resultado(gf, gc) { return gf > gc ? 'G' : gf < gc ? 'P' : 'E'; }

  // Neutral: el estadio del partido no es el de ninguno de los dos equipos.
  function condicion(f, eqId, sedes) {
    var sh = sedes[f.h], sa = sedes[f.a];
    if ((sh || sa) && (f.vId || f.vN)) {
      var mismo = function (s) { return s && ((f.vId && s.id === f.vId) || (f.vN && s.nombre === f.vN)); };
      if (!mismo(sh) && !mismo(sa)) return 'N';
    }
    return f.h === eqId ? 'L' : 'V';
  }

  function estadisticas(eq, lista, sedes) {
    var ult = lista.filter(function (f) { return TERMINADOS[f.st] && (f.h === eq.id || f.a === eq.id); })
      .sort(function (x, y) { return y.ts - x.ts; }).slice(0, 15);
    var s = { pj: ult.length, L: 0, V: 0, N: 0, gf: 0, gc: 0, LG: 0, LE: 0, LP: 0, VG: 0, VE: 0, VP: 0, NG: 0, NE: 0, NP: 0 };
    ult.forEach(function (f) {
      var local = f.h === eq.id;
      var gf = local ? f.hG : f.aG, gc = local ? f.aG : f.hG;
      var c = condicion(f, eq.id, sedes);
      s[c]++;
      s.gf += gf; s.gc += gc;
      s[c + resultado(gf, gc)]++;
    });
    var d = s.pj || 1;
    s.gfp = s.gf / d; s.gcp = s.gc / d; s.totp = (s.gf + s.gc) / d;
    return s;
  }

  // Lesionados del parte más reciente de cada equipo (sin contar suspendidos por tarjetas).
  function contarLesionados(lista) {
    var porEquipo = {};
    lista.forEach(function (x) {
      if (/card|suspen/i.test(x.motivo)) return;
      var e = porEquipo[x.t] || (porEquipo[x.t] = { ts: -1, f: null, j: {} });
      if (x.ts > e.ts) { e.ts = x.ts; e.f = x.f; e.j = {}; }
      if (x.f === e.f) e.j[x.j] = 1;
    });
    var out = {};
    Object.keys(porEquipo).forEach(function (t) { out[t] = Object.keys(porEquipo[t].j).length; });
    return out;
  }

  // ---------- estado de la página ----------
  var extras = leer('ligas:extra', []);
  var seleccion = leer('ligas:sel', LIGAS_BASE.map(function (l) { return l.id; }));
  var todosLosEquipos = {};   // id -> {id, nombre, liga}
  var proximos = [];

  function catalogo() { return LIGAS_BASE.concat(extras); }

  function pintarChips() {
    $('chips').innerHTML = catalogo().map(function (l) {
      var on = seleccion.indexOf(l.id) >= 0;
      return '<button class="chip' + (on ? ' on' : '') + '" data-liga="' + l.id + '" aria-pressed="' + on + '">' + esc(l.nombre) + '</button>';
    }).join('');
  }

  function estado(txt) {
    $('estado').textContent = txt + (restantes != null ? ' · Consultas restantes hoy: ' + restantes : '');
  }

  function celdaGEP(g, e, p) {
    return '<span class="g">' + g + '</span>-<span class="e">' + e + '</span>-<span class="p">' + p + '</span>';
  }

  var COLUMNAS = [
    ['eq', 'Equipo'], ['pj', 'PJ'], ['L', 'Local'], ['V', 'Visita'], ['N', 'Neutral'],
    ['gfp', 'GF/p'], ['gcp', 'GC/p'], ['totp', 'Total/p'],
    ['LG', 'G'], ['LE', 'E'], ['LP', 'P'], ['VG', 'G'], ['VE', 'E'], ['VP', 'P'],
    ['altE', 'Estadio'], ['altT', 'Entrena.'], ['zona', 'Zona'], ['les', 'Lesion.']
  ];

  function valor(fila, k) {
    if (k === 'eq') return fila.eq.nombre;
    if (k === 'altE') return fila.extra ? fila.extra.altEstadio : -1;
    if (k === 'altT') return fila.extra ? fila.extra.altEntrenamiento : -1;
    if (k === 'zona') return fila.extra ? fila.extra.zona : '';
    if (k === 'les') return fila.les == null ? -1 : fila.les;
    return fila.s[k];
  }

  function pintarTabla(cont, filas, orden) {
    filas.sort(function (x, y) {
      var a = valor(x, orden.k), b = valor(y, orden.k);
      var r = typeof a === 'string' ? a.localeCompare(b, 'es') : a - b;
      return orden.asc ? r : -r;
    });
    var m = function (v) { return v == null || v < 0 ? '—' : v.toLocaleString('es-MX'); };
    var th = COLUMNAS.map(function (c, i) {
      var sep = [1, 5, 8, 11, 14, 16].indexOf(i) >= 0 ? ' sep' : '';
      return '<th data-k="' + c[0] + '" class="' + (i === 0 ? 'eq' : '') + sep + (orden.k === c[0] ? ' orden' : '') + '">' +
        c[1] + (orden.k === c[0] ? (orden.asc ? ' ▲' : ' ▼') : '') + '</th>';
    }).join('');
    var cuerpo = filas.map(function (f) {
      var s = f.s, x = f.extra;
      return '<tr>' +
        '<td class="eq"><img src="' + esc(f.eq.logo) + '" alt="" loading="lazy">' + esc(f.eq.nombre) + '</td>' +
        '<td class="sep">' + s.pj + '</td><td>' + s.L + '</td><td>' + s.V + '</td><td>' + s.N + '</td>' +
        '<td class="sep">' + s.gfp.toFixed(2) + '</td><td>' + s.gcp.toFixed(2) + '</td><td><b>' + s.totp.toFixed(2) + '</b></td>' +
        '<td class="sep g">' + s.LG + '</td><td class="e">' + s.LE + '</td><td class="p">' + s.LP + '</td>' +
        '<td class="sep g">' + s.VG + '</td><td class="e">' + s.VE + '</td><td class="p">' + s.VP + '</td>' +
        '<td class="sep">' + m(x && x.altEstadio) + '</td><td>' + m(x && x.altEntrenamiento) + '</td>' +
        '<td class="sep">' + (x ? '<span class="zona">' + esc(x.zona) + '</span>' : '—') + '</td>' +
        '<td>' + (f.les == null ? '—' : '<span class="les ' + (f.les ? 'si' : 'no') + '">' + f.les + '</span>') + '</td>' +
        '</tr>';
    }).join('');
    cont.querySelector('.tabla-scroll').innerHTML =
      '<table><thead><tr class="grupo"><th class="eq"></th><th colspan="4" class="sep">Últimos 15 partidos</th>' +
      '<th colspan="3" class="sep">Goles por partido</th><th colspan="3" class="sep">Siendo local</th>' +
      '<th colspan="3" class="sep">Siendo visitante</th><th colspan="2" class="sep">Altitud (msnm)</th><th colspan="2" class="sep"></th></tr>' +
      '<tr>' + th + '</tr></thead><tbody>' + cuerpo + '</tbody></table>';
    cont.querySelectorAll('thead tr:last-child th').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.getAttribute('data-k');
        pintarTabla(cont, filas, { k: k, asc: orden.k === k ? !orden.asc : k === 'eq' });
      });
    });
  }

  function temporadaElegida(info) {
    var t = parseInt($('temporada').value, 10);
    return t > 1900 ? t : info.actual;
  }

  function cargarLiga(id, cont) {
    var info, temp;
    return infoLiga(id).then(function (i) {
      info = i; temp = temporadaElegida(i);
      cont.querySelector('h2').textContent = info.nombre + ' · ' + info.pais;
      cont.querySelector('.temp').textContent = 'Temporada ' + temp;
      return Promise.all([equipos(id, temp), partidos(id, temp)]);
    }).then(function (r) {
      var eqs = r[0], lista = r[1];
      // Si algún equipo no llega a 15 partidos jugados, se completa con la temporada anterior.
      var falta = eqs.some(function (e) {
        return lista.filter(function (f) { return TERMINADOS[f.st] && (f.h === e.id || f.a === e.id); }).length < 15;
      });
      var previa = falta
        ? Promise.all([partidos(id, temp - 1), equipos(id, temp - 1)]).catch(function () { return [[], []]; })
        : Promise.resolve([[], []]);
      var les = info.lesiones[temp] ? lesiones(id, temp).catch(function () { return null; }) : Promise.resolve(null);
      return Promise.all([eqs, lista, previa, les]);
    }).then(function (r) {
      var eqs = r[0], lista = r[1].concat(r[2][0]), les = r[3] ? contarLesionados(r[3]) : null;
      var sedes = {};
      r[2][1].concat(eqs).forEach(function (e) { if (e.vId || e.vN) sedes[e.id] = { id: e.vId, nombre: e.vN }; });
      var filas = eqs.map(function (e) {
        todosLosEquipos[e.id] = { id: e.id, nombre: e.nombre, liga: info.nombre };
        return { eq: e, s: estadisticas(e, lista, sedes), extra: datosPropios(e.nombre), les: les ? (les[e.id] || 0) : null };
      });
      var ahora = Date.now() / 1000;
      r[1].forEach(function (f) {
        if (PENDIENTES[f.st] && f.ts >= ahora - 3 * 3600 && f.ts <= ahora + 7 * 86400) proximos.push(Object.assign({ liga: info.nombre }, f));
      });
      var sinDatos = filas.filter(function (f) { return !f.extra; }).map(function (f) { return f.eq.nombre; });
      cont.querySelector('.nota-liga').textContent =
        (les ? 'Lesionados: último parte publicado por la API. ' : 'Esta liga no tiene datos de lesionados en la API para esta temporada. ') +
        (sinDatos.length ? 'Sin altitud/zona en data/equipos.js: ' + sinDatos.join(', ') + '.' : '');
      pintarTabla(cont, filas, { k: 'totp', asc: false });
    }).catch(function (err) {
      cont.querySelector('.tabla-scroll').innerHTML = '<div class="aviso" style="margin:12px">No se pudo cargar esta liga: ' + esc(err.message) +
        (/season|plan/i.test(err.message) ? '<br>Tu plan de API-Football no incluye esta temporada. Escribe una temporada permitida en "Temporada" o cambia de plan.' : '') + '</div>';
    });
  }

  function cargarTodo() {
    var cont = $('ligas');
    cont.innerHTML = '';
    proximos = [];
    todosLosEquipos = {};
    if (!leer('api:clave', '')) {
      cont.innerHTML = '<div class="aviso">Para generar las tablas necesitas una clave gratis de API-Football: créala en <a href="https://dashboard.api-football.com/register" target="_blank" rel="noopener">dashboard.api-football.com</a>, pégala arriba y presiona "Generar tablas".</div>';
      pintarSemana();
      return;
    }
    if (!seleccion.length) { cont.innerHTML = '<div class="aviso">Elige al menos una liga.</div>'; pintarSemana(); return; }
    estado('Cargando…');
    var cadena = Promise.resolve();
    seleccion.forEach(function (id) {
      var card = document.createElement('section');
      card.className = 'card';
      card.innerHTML = '<div class="liga-head"><h2>Liga ' + id + '</h2><span class="temp nota"></span></div>' +
        '<div class="tabla-scroll"><div class="cargando">Cargando datos…</div></div><p class="nota nota-liga" style="margin-top:10px"></p>';
      cont.appendChild(card);
      // Una liga a la vez para no gastar consultas en paralelo si la clave falla.
      cadena = cadena.then(function () { return cargarLiga(id, card); });
    });
    cadena.then(function () { estado('Listo.'); pintarSemana(); });
  }

  // ---------- partido de la semana ----------
  function fecha(ts) {
    return new Date(ts * 1000).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function pintarSemana() {
    proximos.sort(function (a, b) { return a.ts - b.ts; });
    $('semana').innerHTML = proximos.length ? proximos.map(function (f, i) {
      return '<button class="partido" data-i="' + i + '"><small>' + esc(f.liga) + ' · ' + esc(fecha(f.ts)) + '</small><b>' + esc(f.hN) + ' vs ' + esc(f.aN) + '</b></button>';
    }).join('') : '<p class="nota">No hay partidos programados en los próximos 7 días para las ligas elegidas.</p>';
    var ops = Object.keys(todosLosEquipos).map(function (k) { return todosLosEquipos[k]; })
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); })
      .map(function (e) { return '<option value="' + e.id + '">' + esc(e.nombre) + ' (' + esc(e.liga) + ')</option>'; }).join('');
    $('eqA').innerHTML = $('eqB').innerHTML = '<option value="">Elige…</option>' + ops;
  }

  function verHistorial(a, nA, b, nB) {
    var caja = $('h2h');
    caja.innerHTML = '<div class="h2h cargando">Buscando enfrentamientos…</div>';
    historial(a, b).then(function (lista) {
      var jugados = lista.filter(function (f) { return TERMINADOS[f.st]; }).sort(function (x, y) { return y.ts - x.ts; });
      var r = { a: 0, e: 0, b: 0, aL: [0, 0, 0], aV: [0, 0, 0] };
      jugados.forEach(function (f) {
        var aLocal = f.h === a;
        var res = resultado(aLocal ? f.hG : f.aG, aLocal ? f.aG : f.hG);
        if (res === 'G') r.a++; else if (res === 'P') r.b++; else r.e++;
        (aLocal ? r.aL : r.aV)['GEP'.indexOf(res)]++;
      });
      if (!jugados.length) { caja.innerHTML = '<div class="h2h">No hay enfrentamientos previos registrados entre ' + esc(nA) + ' y ' + esc(nB) + '.</div>'; return; }
      caja.innerHTML = '<div class="h2h">' +
        '<div class="h2h-marcador">' +
        '<div><div class="num g">' + r.a + '</div><div class="lbl">Victorias de ' + esc(nA) + '</div></div>' +
        '<div><div class="num e">' + r.e + '</div><div class="lbl">Empates</div></div>' +
        '<div><div class="num p">' + r.b + '</div><div class="lbl">Victorias de ' + esc(nB) + '</div></div>' +
        '</div>' +
        '<p class="nota" style="margin-top:12px;text-align:center">' + jugados.length + ' partidos · ' + esc(nA) + ' de local: ' + celdaGEP(r.aL[0], r.aL[1], r.aL[2]) +
        ' · de visitante: ' + celdaGEP(r.aV[0], r.aV[1], r.aV[2]) + ' (G-E-P)</p>' +
        '<ul>' + jugados.slice(0, 8).map(function (f) {
          return '<li><span>' + esc(new Date(f.ts * 1000).toLocaleDateString('es-MX')) + '</span><span>' + esc(f.hN) + ' <b>' + f.hG + ' – ' + f.aG + '</b> ' + esc(f.aN) + '</span></li>';
        }).join('') + '</ul></div>';
      estado('Listo.');
    }).catch(function (err) {
      caja.innerHTML = '<div class="aviso" style="margin-top:14px">No se pudo obtener el historial: ' + esc(err.message) + '</div>';
    });
  }

  // ---------- eventos ----------
  $('clave').value = leer('api:clave', '');
  pintarChips();

  $('chips').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-liga]');
    if (!b) return;
    var id = parseInt(b.getAttribute('data-liga'), 10);
    var i = seleccion.indexOf(id);
    if (i >= 0) seleccion.splice(i, 1); else seleccion.push(id);
    guardar('ligas:sel', seleccion);
    pintarChips();
  });

  $('agregarLiga').addEventListener('click', function () {
    var id = parseInt($('nuevaLiga').value, 10);
    if (!(id > 0)) return;
    if (catalogo().some(function (l) { return l.id === id; })) { estado('Esa liga ya está en la lista.'); return; }
    infoLiga(id).then(function (info) {
      extras.push({ id: id, nombre: info.nombre + ' · ' + info.pais });
      seleccion.push(id);
      guardar('ligas:extra', extras); guardar('ligas:sel', seleccion);
      $('nuevaLiga').value = '';
      pintarChips();
      estado('Liga agregada: ' + info.nombre + '. Presiona "Generar tablas".');
    }).catch(function (err) { estado('No se pudo agregar: ' + err.message); });
  });

  $('guardar').addEventListener('click', function () {
    guardar('api:clave', $('clave').value.trim());
    cargarTodo();
  });

  $('refrescar').addEventListener('click', function () { borrarCache(); cargarTodo(); });

  $('semana').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-i]');
    if (!b) return;
    document.querySelectorAll('.partido.on').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    var f = proximos[parseInt(b.getAttribute('data-i'), 10)];
    verHistorial(f.h, f.hN, f.a, f.aN);
  });

  $('verH2H').addEventListener('click', function () {
    var a = parseInt($('eqA').value, 10), b = parseInt($('eqB').value, 10);
    if (!a || !b || a === b) { $('h2h').innerHTML = '<div class="aviso" style="margin-top:14px">Elige dos equipos distintos.</div>'; return; }
    verHistorial(a, todosLosEquipos[a].nombre, b, todosLosEquipos[b].nombre);
  });

  cargarTodo();
})();
