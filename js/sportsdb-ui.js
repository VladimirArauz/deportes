// Sección "Datos TheSportsDB" de analisis.html: Fútbol y NFL.
// Tabla, tendencias y próximos se calculan con jornadas completas (eventsround), que el plan
// gratis no recorta. Ver docs/API_THESPORTSDB.md.
(function () {
  'use strict';

  var S = window.SportsDB;
  if (!S || !document.getElementById('sdb')) return;

  var DEPORTES = {
    futbol: {
      ligas: [
        { id: '4350', n: 'Liga MX' }, { id: '4654', n: 'Liga de Expansión MX' },
        { id: '4480', n: 'Champions League' }, { id: '4501', n: 'Copa Libertadores' },
        { id: '4328', n: 'Premier League' }, { id: '4332', n: 'Serie A' },
        { id: '4406', n: 'Primera División · Argentina' }, { id: '4335', n: 'LaLiga' },
        { id: '4334', n: 'Ligue 1' }
      ],
      maxRondas: 46, ronda: 'Jornada', pts: 'goles'
    },
    nfl: { ligas: [{ id: '4391', n: 'NFL' }], maxRondas: 18, ronda: 'Semana', pts: 'puntos' }
  };
  var PRETEMPORADA_NFL = 500;
  var HUECO_TORNEO = 30 * 86400e3;
  var MAX_EXTRAS = 8;   // ligas agregadas que se conservan como chips
  // Centro y tamaño aproximados (lat, lon, alto, ancho en grados) de cada país, con el nombre que usa la
  // API, para ubicar un estadio como Norte/Sur/Este/Oeste/Centro. Si el país no está, se usa el centro de
  // los estadios de la propia liga. data/equipos.js tiene prioridad.
  var PAISES = {
    Mexico: [23.6, -102.5, 18.2, 31.7], England: [52.85, -1.95, 5.9, 7.5], Spain: [39.9, -3.7, 7.8, 12.6],
    Italy: [41.85, 12.55, 10.5, 11.9], France: [46.7, 2.4, 8.8, 13], Germany: [51.2, 10.45, 7.8, 9.1],
    Argentina: [-38.4, -63.6, 33.2, 20], Brazil: [-14.2, -51.9, 39, 39.1], Portugal: [39.6, -8.0, 5.2, 3.3],
    'The Netherlands': [52.15, 5.3, 2.8, 3.9], Belgium: [50.5, 4.45, 1.9, 3.9], Scotland: [56.8, -4.2, 4.2, 5.2],
    Colombia: [4.15, -72.95, 16.7, 12.1], Chile: [-36.7, -71.2, 38, 8], Uruguay: [-32.5, -56, 4.9, 4.7],
    Peru: [-9.2, -75, 18.4, 13.4], Ecuador: [-1.8, -78.4, 6.4, 5.8], Paraguay: [-23.4, -58.4, 7.6, 8.1],
    Bolivia: [-16.3, -64.7, 13.2, 11.5], 'United States': [37, -95.85, 24.9, 57.9], Turkey: [39, 35.2, 6, 19]
  };

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
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* lleno o bloqueado */ }
  }

  // ---------- utilidades ----------
  function chica(url) { return url ? url + '/tiny' : ''; }
  function img(url, cls, alt) {
    return url ? '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" loading="lazy"' + (cls ? ' class="' + cls + '"' : '') + '>' : '';
  }
  function enlace(url, txt) {
    if (!url) return '';
    var u = /^https?:\/\//.test(url) ? url : 'https://' + url;
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(txt) + '</a>';
  }
  function fecha(ts, conHora) {
    if (!ts) return '';
    var o = { day: 'numeric', month: 'short', year: 'numeric' };
    if (conHora) { o = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }; }
    return new Date(ts).toLocaleString('es-MX', o);
  }
  function edad(nac) {
    var d = Date.parse(nac);
    return d ? Math.floor((Date.now() - d) / (365.25 * 86400e3)) : null;
  }
  function miles(n) { return n == null || n === '' ? '—' : Number(n).toLocaleString('es-MX'); }
  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function dato(et, v) { return v == null || v === '' ? '' : '<span>' + esc(et) + ': <b>' + esc(v) + '</b></span>'; }
  function descripcion(txt) {
    if (!txt) return '';
    return '<p class="desc">' + esc(txt) + '</p><button class="linkbtn" data-desc>Ver más</button>';
  }
  function aviso(txt) { return '<div class="aviso">' + txt + '</div>'; }
  function vacio(txt) { return '<p class="nota">' + esc(txt || 'La API no tiene este dato.') + '</p>'; }
  function recorte(endpoint, n, que) {
    return S.estaRecortado(endpoint, n)
      ? '<p class="nota" style="margin-top:8px">La versión gratis de TheSportsDB solo da ' + n + ' ' + que + '; puede haber más.</p>'
      : '';
  }

  // Datos propios por equipo (data/equipos.js, data/lesionados.js): coincidencia exacta o el alias
  // más largo contenido en el nombre. Un alias con "=" al inicio solo vale exacto ('=america' no toma
  // "America de Cali").
  function porNombre(lista) {
    var xs = (lista || []).map(function (e) {
      return { e: e, nombres: e.nombres.map(function (al) { return { t: normalizar(al), exacto: al.charAt(0) === '=' }; }) };
    });
    return function (nombre) {
      var n = normalizar(nombre), mejor = null, largo = 0;
      xs.forEach(function (x) {
        x.nombres.forEach(function (o) {
          var al = o.t;
          if (al === n) { mejor = x.e; largo = 1e9; }
          else if (!o.exacto && (' ' + n + ' ').indexOf(' ' + al + ' ') >= 0 && al.length > largo) { mejor = x.e; largo = al.length; }
        });
      });
      return mejor;
    };
  }
  var datosPropios = porNombre(window.EQUIPOS);
  var LES = window.LESIONADOS || { equipos: [] };
  var lesionados = porNombre(LES.equipos);

  // ---------- estado ----------
  var est = {
    dep: leer('sdb:dep', 'futbol'),
    liga: leer('sdb:liga', { futbol: '4350', nfl: '4391' }),
    temp: leer('sdb:temp', {}),
    vista: 'jornada',
    extras: leer('sdb:extras', [])
  };
  if (!DEPORTES[est.dep]) est.dep = 'futbol';
  var ctx = null;     // datos de la liga cargada
  var turno = 0;      // descarta respuestas de una carga anterior

  function dep() { return DEPORTES[est.dep]; }
  function esNfl() { return est.dep === 'nfl'; }
  function ligasDe(d) { return DEPORTES[d].ligas.concat(d === 'futbol' ? est.extras : []); }
  function idLiga() {
    var id = est.liga[est.dep];
    return ligasDe(est.dep).some(function (l) { return l.id === id; }) ? id : ligasDe(est.dep)[0].id;
  }

  // ---------- estado de la fila ----------
  var textoBase = '';
  function estado(txt) { textoBase = txt; pintarEstado(); }
  function pintarEstado() {
    var c = S.cuenta, t = textoBase;
    if (c.pendientes > 0) t = 'Consultando TheSportsDB… ' + c.pendientes + ' en espera (una cada 5 s para no pasar el límite de la API).';
    $('sdbEstado').textContent = t;
  }
  window.addEventListener('sdb:fila', pintarEstado);
  window.addEventListener('sdb:espera', function (ev) {
    $('sdbEstado').textContent = 'La API pidió esperar un minuto. Seguimos solos en ~' + ev.detail.segundos + ' s.';
  });

  // ---------- pestañas y selectores ----------
  function pintarDeporte() {
    ['futbol', 'nfl'].forEach(function (d) {
      var b = document.querySelector('[data-dep="' + d + '"]');
      var on = d === est.dep;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
    });
    $('sdbNuevaCampo').hidden = esNfl();
    $('sdbLigasCampo').hidden = esNfl();
    $('sdbBuscarCampo').hidden = esNfl();
    var id = idLiga();
    $('sdbChips').innerHTML = ligasDe(est.dep).map(function (l) {
      var on = l.id === id;
      return '<button class="chip' + (on ? ' on' : '') + '" data-liga="' + esc(l.id) + '" aria-pressed="' + on + '">' + esc(l.n) + '</button>';
    }).join('');
  }

  function temporadas(actual) {
    var m = /^(\d{4})-(\d{4})$/.exec(actual || ''), out = [];
    for (var i = 0; i < 5; i++) {
      if (m) out.push((+m[1] - i) + '-' + (+m[2] - i));
      else if (/^\d{4}$/.test(actual || '')) out.push(String(+actual - i));
    }
    return out.length ? out : [actual];
  }

  function pintarVistas() {
    document.querySelectorAll('#sdbVistas [data-vista]').forEach(function (b) {
      var on = b.getAttribute('data-vista') === est.vista;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  // ---------- carga ----------
  function cargar() {
    var mio = ++turno;
    var id = idLiga();
    est.liga[est.dep] = id;
    guardar('sdb:liga', est.liga);
    pintarDeporte();
    pintarVistas();
    ctx = { id: id, partidos: {}, rondas: {}, oficial: [], torneo: null, cargando: true, nfl: esNfl(), geo: null, abiertos: {} };
    $('sdbLiga').innerHTML = '<div class="cargando">Cargando liga…</div>';
    $('sdbTabla').innerHTML = $('sdbPartidos').innerHTML = $('sdbEquipos').innerHTML = '';
    $('sdbTablaNota').textContent = '';
    $('sdbTorneoCampo').hidden = true;
    estado('Cargando…');

    S.liga(id).then(function (info) {
      if (mio !== turno) return;
      if (!info) throw new Error('TheSportsDB no tiene la liga ' + id + '.');
      ctx.info = info;
      pintarLiga(info);
      var temps = temporadas(info.strCurrentSeason);
      var temp = est.temp[id] && temps.indexOf(est.temp[id]) >= 0 ? est.temp[id] : temps[0];
      ctx.temp = temp;
      ctx.actual = temp === info.strCurrentSeason;
      $('sdbTemporada').innerHTML = temps.map(function (t) {
        return '<option' + (t === temp ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
      return cargarRondas(mio);
    }).then(function () {
      if (mio !== turno || !ctx.info) return;
      ctx.cargando = false;
      pintarTodo();
      var n = Object.keys(ctx.partidos).length, f = Object.keys(ctx.fallidas || {}).length;
      estado((f ? 'Incompleto · ' : 'Listo · ') + ctx.info.strLeague + ' ' + ctx.temp + ': ' + n + ' partidos cargados' +
        (f ? '; faltan ' + f + ' jornadas (ver aviso).' : '.'));
    }).catch(function (err) {
      if (mio !== turno) return;
      ctx.cargando = false;
      if (!ctx.info) $('sdbLiga').innerHTML = aviso('No se pudo cargar la liga: ' + esc(err.message));
      else pintarTodo();
      estado('Error: ' + err.message);
    });
  }

  function agregar(lista) {
    lista.forEach(function (p) {
      if (ctx.nfl && p.ronda === PRETEMPORADA_NFL) return;
      if (p.temp && p.temp !== ctx.temp) return;
      ctx.partidos[p.id] = p;
    });
  }

  // Todas las jornadas jugadas. Si una falla (corte de la API), se anota, se sigue con las demás y al
  // final se vuelve a pedir; si aún falta, se avisa (pintarFaltan) para no mostrar una tabla incompleta
  // como si estuviera completa.
  function cargarRondas(mio) {
    var id = ctx.id, temp = ctx.temp;
    ctx.fallidas = {};
    var pedirRonda = function (r) {
      return S.jornada(id, temp, r).then(function (lista) {
        if (mio !== turno) return lista;
        ctx.rondas[r] = lista.length;
        delete ctx.fallidas[r];
        agregar(lista);
        pintarTodo();
        return lista;
      }, function (e) {
        if (mio === turno) { ctx.fallidas[r] = 1; pintarTodo(); }
        return null;   // null = falló (distinto de [] = jornada vacía)
      });
    };
    var reintentar = function () {
      return Object.keys(ctx.fallidas).map(Number).sort(function (a, b) { return a - b; }).reduce(function (p, r) {
        return p.then(function () { return mio === turno ? pedirRonda(r) : null; });
      }, Promise.resolve());
    };
    return cargarOrden(pedirRonda, mio, id, temp).then(function () { return mio === turno ? reintentar() : null; });
  }

  function cargarOrden(pedirRonda, mio, id, temp) {
    var tabla = ctx.nfl ? Promise.resolve([]) : S.tabla(id, temp).catch(function () { return []; });
    tabla = tabla.then(function (t) { if (mio === turno) ctx.oficial = t; });

    if (ctx.actual) {
      // Jornada actual según el último y el próximo partido de la liga.
      return Promise.all([S.ultimosLiga(id).catch(function () { return []; }), S.proximosLiga(id).catch(function () { return []; }), tabla])
        .then(function (r) {
          if (mio !== turno) return;
          agregar(r[0].concat(r[1]));
          var rondas = r[0].concat(r[1]).filter(function (p) { return p.temp === temp && p.ronda && p.ronda < 100; })
            .map(function (p) { return p.ronda; });
          var ultima = rondas.length ? Math.max.apply(null, rondas) : 0;
          if (!ultima) return buscarHastaVacio(pedirRonda, mio);
          // Primero la actual y la siguiente (para "Por jornada" y "Próximos"), luego el resto.
          var orden = [ultima, ultima + 1];
          for (var i = 1; i < ultima; i++) orden.push(i);
          if (ctx.nfl) orden = orden.filter(function (x) { return x <= dep().maxRondas; });
          ctx.jornadaActual = ultima;
          ctx.esperadas = orden.length;
          // Si el último partido fue uno reprogramado de una jornada vieja, `ultima` se queda corta:
          // se sigue pidiendo mientras la jornada tenga partidos terminados (la siguiente ya está en caché).
          var seguir = function (rr) {
            if (mio !== turno || rr > dep().maxRondas) return null;
            return pedirRonda(rr).then(function (l) { return l && l.some(S.terminado) ? seguir(rr + 1) : null; });
          };
          return orden.reduce(function (p, rr) {
            return p.then(function () { return mio === turno ? pedirRonda(rr) : null; });
          }, Promise.resolve()).then(function () { return seguir(ultima + 1); });
        });
    }
    return tabla.then(function () { return buscarHastaVacio(pedirRonda, mio); });
  }

  // Temporadas pasadas: jornada por jornada hasta dos vacías seguidas.
  function buscarHastaVacio(pedirRonda, mio) {
    var vacias = 0, max = dep().maxRondas;
    var paso = function (r) {
      if (mio !== turno || r > max || vacias >= 2) return null;
      return pedirRonda(r).then(function (l) {
        // Una jornada que falló no cuenta como vacía: se sigue y se reintenta al final.
        vacias = l && !l.length ? vacias + 1 : 0;
        return paso(r + 1);
      });
    };
    return paso(1);
  }

  // ---------- cálculos ----------
  function lista() {
    return Object.keys(ctx.partidos).map(function (k) { return ctx.partidos[k]; })
      .sort(function (a, b) { return a.ts - b.ts; });
  }

  // Fútbol con dos torneos en la temporada (Apertura/Clausura): se separan por un hueco de fechas.
  function torneos(ps) {
    if (ctx.nfl || !ps.length) return [{ ps: ps }];
    var grupos = [[ps[0]]];
    for (var i = 1; i < ps.length; i++) {
      if (ps[i].ts - ps[i - 1].ts > HUECO_TORNEO) grupos.push([]);
      grupos[grupos.length - 1].push(ps[i]);
    }
    return grupos.map(function (g) {
      var mes = function (ts) { return new Date(ts).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }); };
      return { ps: g, n: mes(g[0].ts) + ' – ' + mes(g[g.length - 1].ts) };
    });
  }

  function delTorneo() {
    var ts = torneos(lista());
    var campo = $('sdbTorneoCampo');
    campo.hidden = ts.length < 2;
    if (ts.length < 2) { ctx.torneo = null; return ts[0].ps; }
    var i = ctx.torneo == null || ctx.torneo >= ts.length ? ts.length - 1 : ctx.torneo;
    ctx.torneo = i;
    $('sdbTorneo').innerHTML = ts.map(function (t, k) {
      return '<option value="' + k + '"' + (k === i ? ' selected' : '') + '>' + esc(t.n) + '</option>';
    }).join('');
    return ts[i].ps;
  }

  function nuevoRegistro(id, nombre, escudo) {
    var z = function () { return { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 }; };
    return { id: id, eq: nombre, escudo: escudo, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, L: z(), V: z(), N: z(), res: [] };
  }

  // Sede habitual de cada equipo: el estadio donde más veces jugó de local en la temporada cargada.
  function sedesHabituales() {
    var n = Object.keys(ctx.partidos).length;
    if (ctx.hab && ctx.hab.n === n) return ctx.hab.s;
    var cuenta = {}, s = {};
    lista().forEach(function (p) {
      if (!p.idSede) return;
      var c = cuenta[p.h] || (cuenta[p.h] = {});
      c[p.idSede] = (c[p.idSede] || 0) + 1;
    });
    Object.keys(cuenta).forEach(function (eq) {
      var c = cuenta[eq];
      s[eq] = Object.keys(c).sort(function (x, y) { return c[y] - c[x]; })[0];
    });
    ctx.hab = { n: n, s: s };
    return s;
  }
  // Neutral: el partido no se jugó en la sede habitual del local (final a partido único, estadio prestado…).
  function esNeutral(p, hab) { return !!(p.idSede && hab[p.h] && p.idSede !== hab[p.h]); }
  function jugado(p) { return S.terminado(p) && p.hG != null && p.aG != null; }

  // Tabla y tendencias de todos los equipos con los partidos terminados.
  function calcular(ps) {
    var eqs = {}, hab = sedesHabituales();
    var reg = function (id, n, e) { return eqs[id] || (eqs[id] = nuevoRegistro(id, n, e)); };
    ps.forEach(function (p) {
      var h = reg(p.h, p.hN, p.hE), a = reg(p.a, p.aN, p.aE);
      if (!jugado(p)) return;
      var n = esNeutral(p, hab);
      [[h, p.hG, p.aG, n ? 'N' : 'L'], [a, p.aG, p.hG, n ? 'N' : 'V']].forEach(function (x) {
        var r = x[0], gf = x[1], gc = x[2], lado = r[x[3]];
        var res = gf > gc ? 'G' : gf < gc ? 'P' : 'E';
        [r, lado].forEach(function (o) { o.pj++; o.gf += gf; o.gc += gc; o[res.toLowerCase()]++; });
        r.res.push({ r: res, ts: p.ts });
      });
    });
    return Object.keys(eqs).map(function (k) {
      var r = eqs[k];
      r.res.sort(function (x, y) { return x.ts - y.ts; });
      // Más reciente primero, igual que strForm de la tabla oficial.
      r.forma = r.res.slice(-5).reverse().map(function (x) { return x.r; });
      r.dif = r.gf - r.gc;
      r.pts = r.g * 3 + r.e;
      r.pct = r.pj ? (r.g + r.e / 2) / r.pj : 0;
      var ult = r.res.length ? r.res[r.res.length - 1].r : '', n = 0;
      for (var i = r.res.length - 1; i >= 0 && r.res[i].r === ult; i--) n++;
      r.racha = n ? n + ult : '';
      r.rachaN = ult === 'G' ? n : ult === 'P' ? -n : 0;
      r.gfp = r.pj ? r.gf / r.pj : 0;
      r.gcp = r.pj ? r.gc / r.pj : 0;
      return r;
    });
  }

  // Últimos 10 partidos terminados del equipo en toda la temporada cargada (sin importar el torneo
  // elegido, para que Apertura y Clausura juntos completen 10). El más reciente primero.
  function ultimos10(id) {
    var hab = sedesHabituales();
    return lista().filter(function (p) { return jugado(p) && (p.h === id || p.a === id); })
      .slice(-10).reverse().map(function (p) {
        var local = p.h === id, gf = local ? p.hG : p.aG, gc = local ? p.aG : p.hG;
        return { p: p, cond: esNeutral(p, hab) ? 'N' : local ? 'L' : 'V', r: gf > gc ? 'G' : gf < gc ? 'P' : 'E' };
      });
  }

  // ---------- tablas ordenables ----------
  // cols: [{k, t, v(fila) -> valor para ordenar, h(fila) -> html, cls}]. alPintar(cont) corre tras cada pintado.
  function tablaOrdenable(cont, cols, filas, orden, extraFila, alPintar) {
    filas.sort(function (x, y) {
      var c = cols.filter(function (cc) { return cc.k === orden.k; })[0];
      var a = c.v(x), b = c.v(y);
      var r = typeof a === 'string' ? a.localeCompare(b, 'es') : a - b;
      if (!r && orden.desempate) r = orden.desempate(x, y);
      return orden.asc ? r : -r;
    });
    var th = cols.map(function (c) {
      var on = orden.k === c.k;
      return '<th scope="col" data-k="' + c.k + '" class="' + (c.cls || '') + (on ? ' orden' : '') + '" aria-sort="' +
        (on ? (orden.asc ? 'ascending' : 'descending') : 'none') + '">' + c.t + (on ? (orden.asc ? ' ▲' : ' ▼') : '') + '</th>';
    }).join('');
    var cuerpo = filas.map(function (f, i) {
      return '<tr' + (extraFila ? extraFila(f) : '') + '>' + cols.map(function (c) {
        return '<td class="' + (c.cls || '') + '">' + c.h(f, i) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    cont.innerHTML = '<div class="tabla-scroll"><table style="min-width:' + (cols.length * 62 + 140) + 'px"><thead><tr>' + th +
      '</tr></thead><tbody>' + cuerpo + '</tbody></table></div>';
    cont.querySelectorAll('thead th').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.getAttribute('data-k');
        tablaOrdenable(cont, cols, filas, { k: k, asc: orden.k === k ? !orden.asc : k === 'eq', desempate: orden.desempate }, extraFila, alPintar);
      });
    });
    if (alPintar) alPintar(cont);
  }

  function celdaEquipo(f) {
    return img(chica(f.escudo), '', '') + '<button class="linkeq" data-equipo="' + esc(f.id) + '">' + esc(f.eq) + '</button>';
  }
  function celdaForma(letras) {
    var mapa = { G: 'W', E: 'D', P: 'L', W: 'W', D: 'D', L: 'L' };
    var nombre = { W: 'Ganó', D: 'Empató', L: 'Perdió' };
    return '<span class="forma" title="El más reciente a la izquierda">' + letras.map(function (x) {
      var k = mapa[x] || 'D';
      return '<i class="' + k + '" title="' + nombre[k] + '">' + (k === 'W' ? 'G' : k === 'D' ? 'E' : 'P') + '</i>';
    }).join('') + '</span>';
  }
  function gep(o) { return '<span class="g">' + o.g + '</span>-<span class="e">' + o.e + '</span>-<span class="p">' + o.p + '</span>'; }

  // ---------- pintar: liga ----------
  function pintarLiga(l) {
    var redes = [enlace(l.strWebsite, 'Sitio'), enlace(l.strTwitter, 'X/Twitter'), enlace(l.strFacebook, 'Facebook'),
      enlace(l.strYoutube, 'YouTube'), enlace(l.strInstagram, 'Instagram')].filter(Boolean).join(' · ');
    var tv = l.strTvRights ? '<span>TV: <b>' + esc(l.strTvRights.replace(/\r?\n/g, ' · ')) + '</b></span>' : '';
    $('sdbLiga').innerHTML =
      (l.strBanner ? img(l.strBanner, 'foto', 'Banner de ' + l.strLeague) : '') +
      '<div class="sdb-liga" style="margin-top:' + (l.strBanner ? '12px' : '0') + '">' +
      img(l.strBadge || l.strLogo, 'logo', '') +
      '<div class="info"><h3>' + esc(l.strLeague) + '</h3>' +
      '<div class="datos">' + dato('País', l.strCountry) + dato('Fundada', l.intFormedYear) +
      dato('Temporada actual', l.strCurrentSeason) + dato('División', l.intDivision) + '</div>' +
      (redes ? '<div class="datos">' + redes + '</div>' : '') +
      (tv ? '<div class="datos">' + tv + '</div>' : '') +
      descripcion(l.desc) + '</div>' +
      (l.strTrophy ? img(l.strTrophy + '/small', 'logo', 'Trofeo') : '') +
      '</div>';
  }

  // ---------- pintar: posiciones ----------
  function pintarTabla(filas) {
    var cont = $('sdbTabla');
    var jugados = filas.some(function (f) { return f.pj; });
    if (!filas.length || !jugados) {
      cont.innerHTML = ctx.cargando ? '<div class="cargando">Calculando con las jornadas…</div>' : vacio('Todavía no hay partidos terminados en esta temporada.');
      return;
    }
    var nota = $('sdbTablaNota');
    if (ctx.nfl) {
      pintarTablaNfl(cont, filas);
      nota.textContent = 'TheSportsDB no publica tabla de la NFL: se calcula con los resultados de temporada regular (sin pretemporada). ' +
        '% = (G + E/2) / J. Divisiones según data/nfl.js.';
      return;
    }
    var zona = {};
    ctx.oficial.forEach(function (o) { zona[o.id] = o; });
    var cols = [
      { k: 'pos', t: '#', v: function (f) { return f.pos; }, h: function (f) { return f.pos; } },
      { k: 'eq', t: 'Equipo', cls: 'eq', v: function (f) { return f.eq; }, h: celdaEquipo },
      { k: 'pj', t: 'PJ', v: function (f) { return f.pj; }, h: function (f) { return f.pj; } },
      { k: 'g', t: 'G', v: function (f) { return f.g; }, h: function (f) { return '<span class="g">' + f.g + '</span>'; } },
      { k: 'e', t: 'E', v: function (f) { return f.e; }, h: function (f) { return '<span class="e">' + f.e + '</span>'; } },
      { k: 'p', t: 'P', v: function (f) { return f.p; }, h: function (f) { return '<span class="p">' + f.p + '</span>'; } },
      { k: 'gf', t: 'GF', v: function (f) { return f.gf; }, h: function (f) { return f.gf; } },
      { k: 'gc', t: 'GC', v: function (f) { return f.gc; }, h: function (f) { return f.gc; } },
      { k: 'dif', t: 'DIF', v: function (f) { return f.dif; }, h: function (f) { return (f.dif > 0 ? '+' : '') + f.dif; } },
      { k: 'pts', t: 'PTS', v: function (f) { return f.pts; }, h: function (f) { return '<b>' + f.pts + '</b>'; } },
      { k: 'forma', t: 'Últimos 5', v: function (f) { return f.rachaN; }, h: function (f) { return celdaForma(f.forma); } }
    ];
    filas.sort(function (a, b) { return b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || a.eq.localeCompare(b.eq, 'es'); });
    filas.forEach(function (f, i) { f.pos = i + 1; });
    tablaOrdenable(cont, cols, filas, { k: 'pos', asc: true }, function (f) {
      var z = zona[f.id];
      return z && z.zona ? ' class="zona-a" title="' + esc(z.zona) + '"' : '';
    });
    // Comparación con la tabla oficial (el plan gratis da solo las primeras 5 filas).
    var difieren = ctx.oficial.filter(function (o) {
      var f = filas.filter(function (x) { return x.id === o.id; })[0];
      return !f || f.pts !== o.pts || f.pj !== o.pj;
    });
    var torneo = $('sdbTorneoCampo').hidden ? '' : ' (torneo ' + $('sdbTorneo').selectedOptions[0].textContent + ')';
    nota.textContent = 'Calculada con ' + filas.reduce(function (s, f) { return s + f.pj; }, 0) / 2 + ' partidos terminados' + torneo + '. ' +
      (ctx.oficial.length
        ? (difieren.length ? 'La tabla oficial (primeros ' + ctx.oficial.length + ') no coincide en: ' + difieren.map(function (o) { return o.eq; }).join(', ') + ' — puede incluir otro torneo o estar por actualizarse. '
          : 'Coincide con la tabla oficial de TheSportsDB (primeros ' + ctx.oficial.length + '). ') +
          'Borde verde = zona marcada por la API (pasa el cursor para ver cuál).'
        : '');
  }

  function pintarTablaNfl(cont, filas) {
    var divs = window.NFL_DIVISIONES || {};
    var porNombre = {};
    filas.forEach(function (f) { porNombre[f.eq] = f; });
    var usadas = {};
    var html = Object.keys(divs).map(function (d, i) {
      return '<div class="grupo-tit">' + esc(d) + '</div><div data-div="' + i + '"></div>';
    }).join('') + '<div class="grupo-tit" data-otros-t hidden>Otros</div><div data-div="otros"></div>';
    cont.innerHTML = html;
    var cols = [
      { k: 'eq', t: 'Equipo', cls: 'eq', v: function (f) { return f.eq; }, h: celdaEquipo },
      { k: 'pj', t: 'J', v: function (f) { return f.pj; }, h: function (f) { return f.pj; } },
      { k: 'g', t: 'G', v: function (f) { return f.g; }, h: function (f) { return '<span class="g">' + f.g + '</span>'; } },
      { k: 'p', t: 'P', v: function (f) { return f.p; }, h: function (f) { return '<span class="p">' + f.p + '</span>'; } },
      { k: 'e', t: 'E', v: function (f) { return f.e; }, h: function (f) { return '<span class="e">' + f.e + '</span>'; } },
      { k: 'pct', t: '%', v: function (f) { return f.pct; }, h: function (f) { return f.pct.toFixed(3).replace(/^0/, ''); } },
      { k: 'gf', t: 'PF', v: function (f) { return f.gf; }, h: function (f) { return f.gf; } },
      { k: 'gc', t: 'PC', v: function (f) { return f.gc; }, h: function (f) { return f.gc; } },
      { k: 'dif', t: 'DIF', v: function (f) { return f.dif; }, h: function (f) { return (f.dif > 0 ? '+' : '') + f.dif; } },
      { k: 'racha', t: 'Racha', v: function (f) { return f.rachaN; }, h: function (f) { return esc(f.racha); } },
      { k: 'forma', t: 'Últimos 5', v: function (f) { return f.rachaN; }, h: function (f) { return celdaForma(f.forma); } }
    ];
    var desempate = function (a, b) { return a.dif - b.dif; };
    Object.keys(divs).forEach(function (d, i) {
      var fs = divs[d].map(function (n) { usadas[n] = 1; return porNombre[n]; }).filter(Boolean);
      tablaOrdenable(cont.querySelector('[data-div="' + i + '"]'), cols, fs, { k: 'pct', asc: false, desempate: desempate });
    });
    var otros = filas.filter(function (f) { return !usadas[f.eq]; });
    if (otros.length) {
      cont.querySelector('[data-otros-t]').hidden = false;
      tablaOrdenable(cont.querySelector('[data-div="otros"]'), cols, otros, { k: 'pct', asc: false, desempate: desempate });
    }
  }

  // ---------- pintar: partidos ----------
  function filaPartido(p) {
    var jugado = p.hG != null && p.aG != null;
    var vivo = jugado && !S.terminado(p) && p.estado && p.estado !== 'NS';
    return '<button class="fila-partido" data-partido="' + esc(p.id) + '">' +
      '<small>' + esc(fecha(p.ts, true)) + '<br>' + esc(dep().ronda + ' ' + (p.ronda || '—')) + (vivo ? ' · <b class="g">' + esc(p.estado) + '</b>' : '') +
      (p.aplazado ? ' · Aplazado' : '') + '</small>' +
      '<span class="loc">' + esc(p.hN) + img(chica(p.hE)) + '</span>' +
      '<span class="marc">' + (jugado ? p.hG + ' – ' + p.aG : 'vs') + '</span>' +
      '<span>' + img(chica(p.aE)) + esc(p.aN) + '</span></button>';
  }

  function pintarPartidos(ps, filas) {
    var cont = $('sdbPartidos');
    var v = est.vista;
    if (!ps.length) { cont.innerHTML = ctx.cargando ? '<div class="cargando">Cargando jornadas…</div>' : vacio('No hay partidos para esta temporada.'); return; }
    if (v === 'jornada') return pintarJornada(cont, ps);
    if (v === 'proximos') {
      var ahora = Date.now() - 3 * 3600e3;
      var prox = ps.filter(function (p) { return !S.terminado(p) && p.ts >= ahora; }).slice(0, 30);
      cont.innerHTML = prox.length ? '<div class="partidos">' + prox.map(filaPartido).join('') + '</div>' +
        '<p class="nota" style="margin-top:8px">Hora de tu navegador. Toca un partido para ver TV y detalles.</p>'
        : vacio(ctx.actual ? 'No hay partidos próximos cargados para esta liga.' : 'Esta temporada ya terminó.');
      return;
    }
    if (v === 'tendencias') return pintarTendencias(cont, filas);
    if (v === 'localvisita') return pintarLocalVisita(cont, filas);
    if (v === 'h2h') return pintarH2H(cont, filas);
  }

  function pintarJornada(cont, ps) {
    var rondas = {};
    ps.forEach(function (p) { if (p.ronda) (rondas[p.ronda] = rondas[p.ronda] || []).push(p); });
    var nums = Object.keys(rondas).map(Number).sort(function (a, b) { return a - b; });
    if (!nums.length) { cont.innerHTML = vacio('Sin jornadas.'); return; }
    // Por defecto: la última jornada con algún partido terminado.
    var conJugados = nums.filter(function (n) { return rondas[n].some(S.terminado); });
    var sel = ctx.ronda != null && rondas[ctx.ronda] ? ctx.ronda : (conJugados.length ? conJugados[conJugados.length - 1] : nums[0]);
    ctx.ronda = sel;
    cont.innerHTML = '<div class="tendencia-sel"><label class="campo"><span>' + dep().ronda + '</span><select id="sdbRonda" class="inp">' +
      nums.map(function (n) { return '<option value="' + n + '"' + (n === sel ? ' selected' : '') + '>' + dep().ronda + ' ' + n + ' (' + rondas[n].length + ')</option>'; }).join('') +
      '</select></label></div><div class="partidos">' + rondas[sel].map(filaPartido).join('') + '</div>';
    $('sdbRonda').addEventListener('change', function () { ctx.ronda = Number(this.value); pintarJornada(cont, ps); });
  }

  function pintarTendencias(cont, filas) {
    filas = filas.filter(function (f) { return f.pj; });
    if (!filas.length) { cont.innerHTML = vacio('Todavía no hay partidos terminados.'); return; }
    var u = ctx.nfl ? 'pts' : 'goles';
    var cols = [
      { k: 'eq', t: 'Equipo', cls: 'eq', v: function (f) { return f.eq; }, h: celdaEquipo },
      { k: 'pj', t: 'PJ', v: function (f) { return f.pj; }, h: function (f) { return f.pj; } },
      { k: 'lg', t: 'Local G-E-P', v: function (f) { return f.L.g - f.L.p; }, h: function (f) { return gep(f.L); } },
      { k: 'vg', t: 'Visita G-E-P', v: function (f) { return f.V.g - f.V.p; }, h: function (f) { return gep(f.V); } },
      { k: 'gfp', t: 'A favor/p', v: function (f) { return f.gfp; }, h: function (f) { return f.gfp.toFixed(2); } },
      { k: 'gcp', t: 'En contra/p', v: function (f) { return f.gcp; }, h: function (f) { return f.gcp.toFixed(2); } },
      { k: 'lgf', t: 'Local a favor/p', v: function (f) { return f.L.pj ? f.L.gf / f.L.pj : 0; }, h: function (f) { return f.L.pj ? (f.L.gf / f.L.pj).toFixed(2) : '—'; } },
      { k: 'vgf', t: 'Visita a favor/p', v: function (f) { return f.V.pj ? f.V.gf / f.V.pj : 0; }, h: function (f) { return f.V.pj ? (f.V.gf / f.V.pj).toFixed(2) : '—'; } },
      { k: 'racha', t: 'Racha', v: function (f) { return f.rachaN; }, h: function (f) { return esc(f.racha); } },
      { k: 'forma', t: 'Últimos 5', v: function (f) { return f.rachaN; }, h: function (f) { return celdaForma(f.forma); } }
    ];
    cont.innerHTML = '<div></div><p class="nota" style="margin-top:8px">Promedios en ' + u + ' por partido. Racha: 3G = tres victorias seguidas. Toca una columna para ordenar.</p>';
    tablaOrdenable(cont.firstChild, cols, filas.slice(), { k: 'gfp', asc: false });
  }

  // ---------- Local / Visita: estadios, altitud y zona ----------
  // Se piden solo al abrir esta vista y con la liga ya cargada: un lookupvenue por equipo (caché 7 días;
  // si el equipo no tiene partidos de local, antes un lookupteam) y una sola consulta a Open-Meteo.
  function cargarGeo() {
    if (ctx.geo || ctx.cargando) return;
    var mio = turno, hab = sedesHabituales();
    var ids = (ctx.filas || []).map(function (f) { return f.id; });
    ctx.geo = {};
    ctx.geoListo = false;
    ids.reduce(function (pr, id) {
      return pr.then(function () {
        if (mio !== turno) return;
        var sede = hab[id] ? Promise.resolve(hab[id]) : S.equipo(id).then(function (t) { return t && t.idVenue; });
        return sede.then(function (idV) { return idV ? S.estadio(idV) : null; }).then(function (e) {
          if (mio !== turno) return;
          ctx.geo[id] = e ? { sede: e.strVenue, ciudad: e.strLocation, pais: e.strCountry, c: S.coordenadas(e.strMap) } : {};
          pintarTodo();
        }).catch(function () { if (mio === turno) ctx.geo[id] = {}; });
      });
    }, Promise.resolve()).then(function () {
      if (mio !== turno) return;
      var con = ids.filter(function (id) { return ctx.geo[id] && ctx.geo[id].c; });
      return S.altitudes(con.map(function (id) { return ctx.geo[id].c; })).then(function (alts) {
        con.forEach(function (id, k) { ctx.geo[id].alt = alts[k]; });
      });
    }).catch(function (e) { ctx.geoError = e.message; }).then(function () {
      if (mio !== turno) return;
      ctx.geoListo = true;
      pintarTodo();
    });
  }

  // Centro del país (tabla PAISES) o, si no está, de los estadios de la liga cuando todos son del mismo país.
  function centroDe(pais) {
    if (PAISES[pais]) return PAISES[pais];
    var cs = Object.keys(ctx.geo || {}).map(function (k) { return ctx.geo[k]; })
      .filter(function (g) { return g.c && g.pais === pais; }).map(function (g) { return g.c; });
    if (cs.length < 4) return null;
    var med = function (xs) { xs = xs.slice().sort(function (a, b) { return a - b; }); return xs[xs.length >> 1]; };
    var lat = cs.map(function (c) { return c[0]; }), lon = cs.map(function (c) { return c[1]; });
    return [med(lat), med(lon), Math.max(1, Math.max.apply(null, lat) - Math.min.apply(null, lat)),
      Math.max(1, Math.max.apply(null, lon) - Math.min.apply(null, lon))];
  }
  function zonaCalculada(g) {
    var c = g && g.c && centroDe(g.pais);
    if (!c) return '';
    var dn = (g.c[0] - c[0]) / c[2], de = (g.c[1] - c[1]) / c[3], u = 0.12;
    var ns = dn > u ? 'N' : dn < -u ? 'S' : '', eo = de > u ? 'E' : de < -u ? 'O' : '';
    return { N: 'Norte', S: 'Sur', E: 'Este', O: 'Oeste', NE: 'Noreste', NO: 'Noroeste', SE: 'Sureste', SO: 'Suroeste', '': 'Centro' }[ns + eo];
  }

  // Altitudes, zona y lesionados de un equipo. data/equipos.js manda sobre lo calculado.
  function geoEquipo(f) {
    var x = datosPropios(f.eq) || {}, g = (ctx.geo || {})[f.id] || {};
    var est = x.altEstadio != null ? x.altEstadio : g.alt;
    return {
      altEst: est, altEnt: x.altEntrenamiento != null ? x.altEntrenamiento : est,
      entAprox: x.altEntrenamiento == null && est != null,
      zona: x.zona || zonaCalculada(g), ciudad: g.ciudad || '', pais: g.pais || '', sede: g.sede || '',
      pendiente: !ctx.geoListo && x.altEstadio == null
    };
  }

  function celdaLes(nombres) {
    if (!nombres) return '<span class="nota">—</span>';
    if (!nombres.length) return '0';
    return '<b title="' + esc(nombres.join(', ')) + '">' + nombres.length + '</b>';
  }
  var COND = { L: 'Local', V: 'Visitante', N: 'Neutral' };
  function celdaUlt10(xs) {
    return '<span class="ult10" title="El más reciente a la izquierda">' + xs.map(function (x) {
      return '<i class="' + x.r + '" title="' + esc(x.p.hN + ' ' + x.p.hG + '–' + x.p.aG + ' ' + x.p.aN + ' · ' + COND[x.cond] + ' · ' + fecha(x.p.ts)) + '">' + x.cond + '</i>';
    }).join('') + '</span>';
  }
  function filaUltimo(x) {
    var p = x.p;
    return '<button class="fila-partido res-' + x.r + '" data-partido="' + esc(p.id) + '">' +
      '<small>' + esc(fecha(p.ts)) + '<br><b class="cond">' + COND[x.cond] + '</b>' + (p.sede ? ' · ' + esc(p.sede) : '') + '</small>' +
      '<span class="loc">' + esc(p.hN) + img(chica(p.hE)) + '</span>' +
      '<span class="marc">' + p.hG + ' – ' + p.aG + '</span>' +
      '<span>' + img(chica(p.aE)) + esc(p.aN) + '</span></button>';
  }

  function pintarLocalVisita(cont, filas) {
    filas = filas.filter(function (f) { return f.pj; });
    if (!filas.length) { cont.innerHTML = vacio('Todavía no hay partidos terminados.'); return; }
    cargarGeo();
    var previo = cont.querySelector('.tabla-scroll'), scroll = previo ? previo.scrollLeft : 0;
    filas.forEach(function (f) { f.geo = geoEquipo(f); f.ult = ultimos10(f.id); f.les = lesionados(f.eq); });
    var m = function (v, aprox) { return v == null ? '—' : (aprox ? '≈ ' : '') + miles(v) + ' m'; };
    var n = function (o, k, cls) { return '<span class="' + cls + '">' + o[k] + '</span>'; };
    var num = function (v) { return v == null ? -1 : v; };
    var cols = [
      { k: 'eq', t: 'Equipo', cls: 'eq', v: function (f) { return f.eq; }, h: function (f) {
        return '<button class="abrir" data-ult10="' + esc(f.id) + '" aria-expanded="' + !!ctx.abiertos[f.id] + '" aria-label="Últimos 10 de ' + esc(f.eq) + '">' + (ctx.abiertos[f.id] ? '▾' : '▸') + '</button>' + celdaEquipo(f);
      } },
      { k: 'pj', t: 'PJ', v: function (f) { return f.pj; }, h: function (f) { return f.pj; } },
      { k: 'vg', t: 'Vis G', cls: 'sep', v: function (f) { return f.V.g; }, h: function (f) { return n(f.V, 'g', 'g'); } },
      { k: 've', t: 'Vis E', v: function (f) { return f.V.e; }, h: function (f) { return n(f.V, 'e', 'e'); } },
      { k: 'vp', t: 'Vis P', v: function (f) { return f.V.p; }, h: function (f) { return n(f.V, 'p', 'r'); } },
      { k: 'lg', t: 'Loc G', cls: 'sep', v: function (f) { return f.L.g; }, h: function (f) { return n(f.L, 'g', 'g'); } },
      { k: 'le', t: 'Loc E', v: function (f) { return f.L.e; }, h: function (f) { return n(f.L, 'e', 'e'); } },
      { k: 'lp', t: 'Loc P', v: function (f) { return f.L.p; }, h: function (f) { return n(f.L, 'p', 'r'); } },
      { k: 'neu', t: 'Neutral G-E-P', cls: 'sep', v: function (f) { return f.N.pj; }, h: function (f) {
        return f.N.pj ? n(f.N, 'g', 'g') + '-' + n(f.N, 'e', 'e') + '-' + n(f.N, 'p', 'r') : '<span class="nota">0</span>';
      } },
      { k: 'ult', t: 'Últimos 10', v: function (f) { return f.ult.filter(function (x) { return x.r === 'G'; }).length; }, h: function (f) { return celdaUlt10(f.ult); } },
      { k: 'alte', t: 'Alt. estadio', cls: 'sep', v: function (f) { return num(f.geo.altEst); }, h: function (f) {
        return f.geo.altEst == null && f.geo.pendiente ? '…' : m(f.geo.altEst);
      } },
      { k: 'altn', t: 'Alt. entreno', v: function (f) { return num(f.geo.altEnt); }, h: function (f) {
        return f.geo.altEnt == null && f.geo.pendiente ? '…' : '<span title="' + (f.geo.entAprox ? 'Sin dato del centro de entrenamiento: se usa la del estadio' : 'data/equipos.js') + '">' + m(f.geo.altEnt, f.geo.entAprox) + '</span>';
      } },
      { k: 'zona', t: 'Zona · ciudad', v: function (f) { return f.geo.zona + f.geo.ciudad; }, h: function (f) {
        var g = f.geo, lugar = [g.ciudad, ctx.info.strCountry !== g.pais ? g.pais : ''].filter(Boolean).join(', ');
        if (!g.zona && !lugar) return g.pendiente ? '…' : '—';
        return '<span class="zona" title="' + esc(g.sede) + '"><b>' + esc(g.zona || '—') + '</b>' + (lugar ? ' · ' + esc(lugar) : '') + '</span>';
      } },
      { k: 'bajas', t: 'Bajas', cls: 'sep', v: function (f) { return f.les ? f.les.bajas.length : -1; }, h: function (f) { return celdaLes(f.les && f.les.bajas); } },
      { k: 'duda', t: 'En duda', v: function (f) { return f.les ? f.les.duda.length : -1; }, h: function (f) { return celdaLes(f.les && f.les.duda); } }
    ];
    var faltan = (ctx.filas || []).length - Object.keys(ctx.geo || {}).length;
    var progreso = ctx.geoListo ? (ctx.geoError ? ' No se pudieron calcular altitudes: ' + esc(ctx.geoError) : '')
      : ' Buscando estadios y altitudes… faltan ' + Math.max(0, faltan) + ' equipos (solo la primera vez).';
    cont.innerHTML = '<div></div><p class="nota" style="margin-top:8px">' +
      '<b class="g">Verde</b> ganó · <b class="e">naranja</b> empató · <b class="r">rojo</b> perdió. L = local, V = visitante, ' +
      'N = neutral (no se jugó en el estadio habitual del local; no cuenta en local ni en visita). Toca ▸ para ver los últimos 10 partidos ' +
      '(de toda la temporada ' + esc(ctx.temp) + '). Altitud del estadio con Open-Meteo según sus coordenadas en TheSportsDB; ' +
      'los valores de data/equipos.js tienen prioridad. Zona: posición del estadio dentro de su país.' +
      ' Lesionados: data/lesionados.js, capturado a mano' + (LES.actualizado ? ' (actualizado el ' + esc(LES.actualizado) + ')' : '') +
      '; "—" = sin datos de ese equipo.' + progreso + '</p>';
    var orden = ctx.lvOrden || { k: 'pj', asc: false };
    tablaOrdenable(cont.firstChild, cols, filas.slice(), orden, null, function (c) {
      var th = c.querySelector('th.orden');
      if (th) ctx.lvOrden = { k: th.getAttribute('data-k'), asc: th.getAttribute('aria-sort') === 'ascending' };
      c.querySelectorAll('[data-ult10]').forEach(function (b) {
        var id = b.getAttribute('data-ult10');
        if (ctx.abiertos[id]) b.closest('tr').insertAdjacentHTML('afterend', filaDetalle(filas, id, cols.length));
      });
      var sc = c.querySelector('.tabla-scroll');
      if (sc && scroll) sc.scrollLeft = scroll;
    });
    cont.firstChild.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ult10]');
      if (!b) return;
      var id = b.getAttribute('data-ult10'), tr = b.closest('tr');
      ctx.abiertos[id] = !ctx.abiertos[id];
      b.textContent = ctx.abiertos[id] ? '▾' : '▸';
      b.setAttribute('aria-expanded', ctx.abiertos[id]);
      if (ctx.abiertos[id]) tr.insertAdjacentHTML('afterend', filaDetalle(filas, id, cols.length));
      else if (tr.nextElementSibling && tr.nextElementSibling.classList.contains('detalle')) tr.nextElementSibling.remove();
    });
  }

  function filaDetalle(filas, id, ncols) {
    var f = filas.filter(function (x) { return x.id === id; })[0];
    if (!f) return '';
    return '<tr class="detalle"><td colspan="' + ncols + '"><div class="partidos">' + f.ult.map(filaUltimo).join('') + '</div>' +
      (f.ult.length < 10 ? '<p class="nota" style="margin-top:6px">Solo ' + f.ult.length + ' partidos terminados en la temporada ' + esc(ctx.temp) + '.</p>' : '') +
      '</td></tr>';
  }

  function pintarH2H(cont, filas) {
    var ops = filas.slice().sort(function (a, b) { return a.eq.localeCompare(b.eq, 'es'); })
      .map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.eq) + '</option>'; }).join('');
    var a = ctx.h2hA || '', b = ctx.h2hB || '';
    cont.innerHTML = '<div class="tendencia-sel">' +
      '<label class="campo"><span>Equipo A</span><select id="sdbH2HA" class="inp"><option value="">Elige…</option>' + ops + '</select></label>' +
      '<label class="campo"><span>Equipo B</span><select id="sdbH2HB" class="inp"><option value="">Elige…</option>' + ops + '</select></label></div>' +
      '<div id="sdbH2HRes"></div>';
    $('sdbH2HA').value = a; $('sdbH2HB').value = b;
    var ver = function () {
      ctx.h2hA = $('sdbH2HA').value; ctx.h2hB = $('sdbH2HB').value;
      var x = ctx.h2hA, y = ctx.h2hB, res = $('sdbH2HRes');
      if (!x || !y || x === y) { res.innerHTML = vacio('Elige dos equipos distintos.'); return; }
      var ps = lista().filter(function (p) { return (p.h === x && p.a === y) || (p.h === y && p.a === x); });
      var jug = ps.filter(S.terminado), r = { a: 0, e: 0, b: 0 };
      jug.forEach(function (p) {
        var ga = p.h === x ? p.hG : p.aG, gb = p.h === x ? p.aG : p.hG;
        if (ga > gb) r.a++; else if (ga < gb) r.b++; else r.e++;
      });
      var nA = $('sdbH2HA').selectedOptions[0].textContent, nB = $('sdbH2HB').selectedOptions[0].textContent;
      res.innerHTML = '<div class="h2h"><div class="h2h-marcador">' +
        '<div><div class="num g">' + r.a + '</div><div class="lbl">Victorias de ' + esc(nA) + '</div></div>' +
        '<div><div class="num e">' + r.e + '</div><div class="lbl">Empates</div></div>' +
        '<div><div class="num p">' + r.b + '</div><div class="lbl">Victorias de ' + esc(nB) + '</div></div></div>' +
        (ps.length ? '<div class="partidos" style="margin-top:14px">' + ps.map(filaPartido).join('') + '</div>'
          : '<p class="nota" style="margin-top:12px;text-align:center">No se enfrentan en la temporada cargada.</p>') +
        '<p class="nota" style="margin-top:10px">Solo partidos de la temporada ' + esc(ctx.temp) + '. Para un historial más largo cambia la temporada.</p></div>';
    };
    $('sdbH2HA').addEventListener('change', ver);
    $('sdbH2HB').addEventListener('change', ver);
    if (a && b) ver();
  }

  // ---------- pintar: equipos ----------
  function pintarEquipos(filas) {
    var cont = $('sdbEquipos');
    if (!filas.length) { cont.innerHTML = ctx.cargando ? '<div class="cargando">Cargando equipos…</div>' : vacio('Sin equipos.'); return; }
    cont.innerHTML = '<div class="equipos">' + filas.slice().sort(function (a, b) { return a.eq.localeCompare(b.eq, 'es'); }).map(function (f) {
      var x = datosPropios(f.eq);
      return '<button class="equipo" data-equipo="' + esc(f.id) + '">' + img(chica(f.escudo)) +
        '<span><b>' + esc(f.eq) + '</b><small>' + (f.pj ? (ctx.nfl ? f.g + '-' + f.p + (f.e ? '-' + f.e : '') : f.pts + ' pts · ' + f.pj + ' PJ') : 'Sin partidos jugados') +
        (x ? ' · ' + miles(x.altEstadio) + ' msnm' : '') + '</small></span></button>';
    }).join('') + '</div><p class="nota" style="margin-top:8px">Toca un equipo para ver su ficha, estadio, uniformes y plantilla.</p>';
  }

  // Progreso de la carga y jornadas que no llegaron: así nunca parece completa una tabla a medias.
  function pintarFaltan() {
    var f = Object.keys(ctx.fallidas || {}).map(Number).sort(function (a, b) { return a - b; });
    var hechas = Object.keys(ctx.rondas).length, html = '';
    if (ctx.cargando && ctx.esperadas) {
      html = '<p class="nota">Cargando jornadas: ' + Math.min(hechas, ctx.esperadas) + ' de ' + ctx.esperadas +
        '. La tabla se completa sola; mientras tanto no incluye todos los partidos.</p>';
    } else if (ctx.cargando) {
      html = '<p class="nota">Cargando jornadas: ' + hechas + ' recibidas…</p>';
    }
    if (f.length) {
      html += aviso('Faltan ' + (f.length === 1 ? 'la ' + dep().ronda.toLowerCase() + ' ' : 'las ' + dep().ronda.toLowerCase() + 's ') + f.join(', ') +
        ' porque TheSportsDB limitó las consultas. ' + (ctx.cargando ? 'Se vuelven a pedir al final.'
          : 'Las tablas no incluyen esos partidos. <button class="ghost" data-reintentar style="margin-left:8px">Reintentar</button>'));
    }
    $('sdbFaltan').innerHTML = html;
    $('sdbFaltan').hidden = !html;
  }

  var pendientePintar = false;
  function pintarTodo() {
    if (pendientePintar) return;
    pendientePintar = true;
    requestAnimationFrame(function () {
      pendientePintar = false;
      if (!ctx || !ctx.info) return;
      var ps = delTorneo();
      var filas = calcular(ps);
      ctx.filas = filas;
      pintarFaltan();
      pintarTabla(filas.slice());
      pintarPartidos(ps, filas);
      pintarEquipos(filas);
    });
  }

  // ---------- modal ----------
  var modal = { pila: [], antes: null };
  function abrirModal(titulo, html, alPintar) {
    var m = $('sdbModal');
    if (m.hidden) { modal.antes = document.activeElement; modal.pila = []; }
    modal.pila.push({ titulo: titulo, html: html, alPintar: alPintar });
    mostrarTope();
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    m.querySelector('.modal-caja').focus();
  }
  function mostrarTope() {
    var t = modal.pila[modal.pila.length - 1];
    $('sdbModalTitulo').textContent = t.titulo;
    $('sdbModalCuerpo').innerHTML = (modal.pila.length > 1 ? '<button class="linkbtn" data-volver style="margin-bottom:10px">← Volver a ' + esc(modal.pila[modal.pila.length - 2].titulo) + '</button>' : '') + t.html;
    if (t.alPintar) t.alPintar($('sdbModalCuerpo'));
  }
  function cerrarModal() {
    $('sdbModal').hidden = true;
    document.body.style.overflow = '';
    modal.pila = [];
    if (modal.antes && modal.antes.focus) modal.antes.focus();
  }

  // Pestañas perezosas dentro del modal: cada una pide sus datos solo al abrirse.
  function pestanas(cuerpo, defs) {
    var barra = cuerpo.querySelector('.pestanas'), panel = cuerpo.querySelector('.panel-pestana');
    var hechas = {};
    var abrir = function (i) {
      defs.ultima = i;  // al volver de una ficha anidada se reabre esta pestaña
      barra.querySelectorAll('[role=tab]').forEach(function (b, k) {
        b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1;
      });
      if (hechas[i]) { panel.innerHTML = hechas[i]; return; }
      panel.innerHTML = '<div class="cargando">Cargando…</div>';
      Promise.resolve(defs[i].fn()).then(function (html) {
        hechas[i] = html;
        if (barra.querySelector('[aria-selected=true]') === barra.children[i]) panel.innerHTML = html;
      }).catch(function (e) { panel.innerHTML = aviso('No se pudo cargar: ' + esc(e.message)); });
    };
    barra.innerHTML = defs.map(function (d, i) {
      return '<button class="chip" role="tab" aria-selected="false" data-tab="' + i + '">' + esc(d.t) + '</button>';
    }).join('');
    barra.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-tab]');
      if (b) abrir(Number(b.getAttribute('data-tab')));
    });
    barra.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var i = Number(barra.querySelector('[aria-selected=true]').getAttribute('data-tab'));
      i = (i + (ev.key === 'ArrowRight' ? 1 : -1) + defs.length) % defs.length;
      abrir(i); barra.children[i].focus();
    });
    abrir(defs.ultima || 0);
  }
  var BLOQUE_PESTANAS = '<div class="pestanas" role="tablist"></div><div class="panel-pestana"></div>';

  // ---------- detalle de partido ----------
  var STATS = {
    'Shots on Goal': 'Tiros a puerta', 'Shots off Goal': 'Tiros desviados', 'Total Shots': 'Tiros totales',
    'Blocked Shots': 'Tiros bloqueados', 'Shots insidebox': 'Tiros dentro del área', 'Shots outsidebox': 'Tiros fuera del área',
    'Fouls': 'Faltas', 'Corner Kicks': 'Tiros de esquina', 'Offsides': 'Fueras de lugar', 'Ball Possession': 'Posesión',
    'Yellow Cards': 'Tarjetas amarillas', 'Red Cards': 'Tarjetas rojas', 'Goalkeeper Saves': 'Atajadas',
    'Total passes': 'Pases totales', 'Passes accurate': 'Pases precisos', 'Passes %': '% de pases',
    'expected_goals': 'Goles esperados (xG)', 'goals_prevented': 'Goles evitados'
  };
  // [etiqueta, clase de color, mostrar el detalle de la API]
  function tipoEvento(x) {
    var d = x.det || '';
    if (x.tipo === 'Goal') {
      if (/missed/i.test(d)) return ['PENAL FALLADO', 'p'];
      if (/own/i.test(d)) return ['AUTOGOL', 'g'];
      if (/penalty/i.test(d)) return ['GOL DE PENAL', 'g'];
      return ['GOL', 'g'];
    }
    if (x.tipo === 'Card') return /red/i.test(d) ? ['ROJA', 'p'] : ['AMARILLA', 'e'];
    if (/subst/i.test(x.tipo)) return ['CAMBIO', 'e'];
    return [String(x.tipo || '').toUpperCase(), 'e', true];
  }
  var SIN_DATO = 'La API no tiene este dato para este partido.';

  // NFL: " Equipo Quarter 1:<br>0 6 <br>Quarter 2<br>6 7 <br>…" → [[Q1, local, visita], …]
  function cuartos(res) {
    var out = [], re = /(Quarter\s*(\d)|Overtime):?\s*<br>\s*(\d+)\s+(\d+)/gi, m;
    while ((m = re.exec(res || ''))) out.push([m[2] ? 'C' + m[2] : 'TE', +m[3], +m[4]]);
    return out;
  }

  function abrirPartido(id) {
    var p = ctx && ctx.partidos[id];
    if (!p) return;
    var jugado = p.hG != null && p.aG != null;
    var qs = cuartos(p.res);
    var cab = '<div class="h2h" style="margin-top:0"><div class="h2h-marcador">' +
      '<div>' + img(chica(p.hE)) + '<div class="lbl" style="margin-top:6px">' + esc(p.hN) + ' · local</div></div>' +
      '<div><div class="num">' + (jugado ? p.hG + ' – ' + p.aG : 'vs') + '</div><div class="lbl">' + esc(p.estado || '') + '</div></div>' +
      '<div>' + img(chica(p.aE)) + '<div class="lbl" style="margin-top:6px">' + esc(p.aN) + ' · visita</div></div></div>' +
      (qs.length ? '<div class="tabla-scroll" style="margin-top:12px"><table style="min-width:0"><thead><tr><th class="eq">Equipo</th>' +
        qs.map(function (q) { return '<th>' + q[0] + '</th>'; }).join('') + '<th>Total</th></tr></thead><tbody>' +
        '<tr><td class="eq">' + esc(p.hN) + '</td>' + qs.map(function (q) { return '<td>' + q[1] + '</td>'; }).join('') + '<td><b>' + p.hG + '</b></td></tr>' +
        '<tr><td class="eq">' + esc(p.aN) + '</td>' + qs.map(function (q) { return '<td>' + q[2] + '</td>'; }).join('') + '<td><b>' + p.aG + '</b></td></tr>' +
        '</tbody></table></div>' : '') +
      '<div class="datos" style="margin-top:12px;justify-content:center">' + dato('Fecha', fecha(p.ts, true)) +
      dato(dep().ronda, p.ronda) + dato('Estadio', p.sede) + dato('Ciudad', p.ciudad) + dato('País', p.pais) +
      dato('Asistencia', p.publico ? miles(p.publico) : '') + dato('Árbitro', p.arbitro) + '</div>' +
      (p.video ? '<p style="text-align:center;margin:10px 0 0">' + enlace(p.video, '▶ Ver resumen en video') + '</p>' : '') +
      '</div>' + (p.thumb ? img(p.thumb, 'foto', '') : '');

    var defs = [
      { t: 'Estadísticas', fn: function () { return S.estadisticas(id).then(htmlStats); } },
      { t: 'Alineaciones', fn: function () { return S.alineacion(id).then(function (l) { return htmlAlineacion(l, p); }); } },
      { t: 'Cronología', fn: function () { return S.cronologia(id).then(htmlCronologia); } },
      { t: 'TV', fn: function () { return S.tv(id).then(htmlTv); } }
    ];
    if (!p.video && jugado && p.fecha) {
      defs.push({ t: 'Video', fn: function () {
        return S.videos(p.fecha, p.liga).then(function (vs) {
          var v = vs.filter(function (x) { return x.id === id; })[0];
          return v ? '<p>' + enlace(v.video, '▶ Ver resumen') + '</p>' + img(v.thumb, 'foto') : vacio(SIN_DATO);
        });
      } });
    }
    abrirModal(p.hN + ' vs ' + p.aN, cab + BLOQUE_PESTANAS, function (c) { pestanas(c, defs); });
  }

  function htmlStats(l) {
    if (!l.length) return vacio(SIN_DATO);
    return l.map(function (s) {
      var h = parseFloat(s.h) || 0, a = parseFloat(s.a) || 0, tot = h + a || 1;
      return '<div class="barra"><div class="lbl">' + esc(STATS[s.stat] || s.stat) + '</div><span class="v">' + esc(s.h) + '</span>' +
        '<div class="pista" role="img" aria-label="' + esc(s.h + ' contra ' + s.a) + '"><span class="h" style="width:' + (h / tot * 100) + '%"></span><span class="a" style="width:' + (a / tot * 100) + '%"></span></div>' +
        '<span class="v">' + esc(s.a) + '</span></div>';
    }).join('') + recorte('lookupeventstats.php', l.length, 'estadísticas por partido');
  }

  function htmlAlineacion(l, p) {
    if (!l.length) return vacio(SIN_DATO);
    var col = function (local) {
      var js = l.filter(function (x) { return x.local === local; });
      var li = function (x) { return '<li><span>' + esc(x.num || '') + ' ' + esc(x.n) + '</span><span>' + esc(x.pos || '') + '</span></li>'; };
      var tit = js.filter(function (x) { return !x.sup; }), sup = js.filter(function (x) { return x.sup; });
      return '<div><div class="grupo-tit">' + esc(local ? p.hN : p.aN) + '</div>' +
        (tit.length ? '<ul class="lista-simple">' + tit.map(li).join('') + '</ul>' : '') +
        (sup.length ? '<p class="nota" style="margin:10px 0 6px">Suplentes</p><ul class="lista-simple">' + sup.map(li).join('') + '</ul>' : '') +
        (js.length ? '' : vacio('Sin datos.')) + '</div>';
    };
    return '<div class="dos-col">' + col(true) + col(false) + '</div>' + recorte('lookuplineup.php', l.length, 'jugadores de la alineación');
  }

  function htmlCronologia(l) {
    if (!l.length) return vacio(SIN_DATO);
    return '<ul class="lista-simple">' + l.sort(function (a, b) { return (a.min || 0) - (b.min || 0); }).map(function (x) {
      var t = tipoEvento(x), cambio = t[0] === 'CAMBIO';
      return '<li><span><b>' + esc(x.min != null ? x.min + "'" : '') + '</b> <span class="' + t[1] + '">' + esc(t[0]) + '</span> ' +
        esc(x.jug || '') + (x.asis ? (cambio ? ' ⇄ ' + esc(x.asis) : ' <small>(asist. ' + esc(x.asis) + ')</small>') : '') +
        '</span><span>' + esc(x.eq || '') + (t[2] && x.det ? ' · ' + esc(x.det) : '') + '</span></li>';
    }).join('') + '</ul>' + recorte('lookuptimeline.php', l.length, 'eventos de la cronología');
  }

  function htmlTv(l) {
    if (!l.length) return vacio(SIN_DATO);
    return '<ul class="lista-simple">' + l.map(function (x) {
      return '<li><span>' + esc(x.canal) + '</span><span>' + esc(x.pais) + '</span></li>';
    }).join('') + '</ul>' + recorte('lookuptv.php', l.length, 'canales de TV');
  }

  // ---------- ficha de equipo ----------
  function abrirEquipo(id) {
    var f = (ctx && ctx.filas || []).filter(function (x) { return x.id === id; })[0];
    abrirModal(f ? f.eq : 'Equipo', '<div class="cargando">Cargando equipo…</div>', function (c) {
      S.equipo(id).then(function (t) {
        if (!t) { c.innerHTML = aviso('TheSportsDB no tiene la ficha de este equipo.'); return; }
        var top = modal.pila[modal.pila.length - 1];
        top.titulo = t.strTeam;
        $('sdbModalTitulo').textContent = t.strTeam;
        var x = datosPropios(t.strTeam);
        var colores = [t.strColour1, t.strColour2, t.strColour3].filter(Boolean);
        var redes = [enlace(t.strWebsite, 'Sitio'), enlace(t.strTwitter, 'X/Twitter'), enlace(t.strFacebook, 'Facebook'),
          enlace(t.strInstagram, 'Instagram'), enlace(t.strYoutube, 'YouTube')].filter(Boolean).join(' · ');
        var html = (t.strBanner ? img(t.strBanner, 'foto', '') : '') +
          '<div class="sdb-liga" style="margin-top:12px">' + img(t.strBadge, 'logo', '') + '<div class="info">' +
          '<div class="datos">' + dato('Nombre corto', t.strTeamShort) + dato('También', t.strTeamAlternate) +
          dato('Fundado', t.intFormedYear) + dato('Ciudad', t.strLocation) + dato('Estadio', t.strStadium) +
          dato('Apodos', t.strKeywords) + (x ? dato('Altitud estadio', miles(x.altEstadio) + ' msnm') + dato('Zona', x.zona) : '') + '</div>' +
          (colores.length ? '<div class="datos"><span>Colores: <span class="colores">' + colores.map(function (k) {
            return '<i style="background:' + esc(k) + '" title="' + esc(k) + '"></i>';
          }).join('') + '</span></span></div>' : '') +
          (t.ligas.length ? '<div class="datos">' + dato('También juega', t.ligas.join(', ')) + '</div>' : '') +
          (redes ? '<div class="datos">' + redes + '</div>' : '') + descripcion(t.desc) + '</div></div>' +
          BLOQUE_PESTANAS;
        c.innerHTML = (modal.pila.length > 1 ? c.querySelector('[data-volver]').outerHTML : '') + html;
        top.html = html;
        var defs = [
          { t: 'Partidos', fn: function () { return htmlPartidosEquipo(id); } },
          { t: 'Plantilla', fn: function () { return S.plantilla(id).then(htmlPlantilla); } },
          { t: 'Estadio', fn: function () { return t.idVenue ? S.estadio(t.idVenue).then(htmlEstadio) : vacio('Sin estadio registrado.'); } },
          { t: 'Uniformes', fn: function () { return S.uniformes(id).then(htmlUniformes); } }
        ];
        pestanas(c, defs);
        top.alPintar = function (cc) { pestanas(cc, defs); };
      }).catch(function (e) { c.innerHTML = aviso('No se pudo cargar el equipo: ' + esc(e.message)); });
    });
  }

  function htmlPartidosEquipo(id) {
    var ps = lista().filter(function (p) { return p.h === id || p.a === id; });
    if (!ps.length) return vacio('No hay partidos cargados de este equipo en la temporada.');
    return '<div class="partidos">' + ps.map(filaPartido).join('') + '</div>';
  }

  function grupoPosicion(pos) {
    pos = String(pos || '');
    if (esNfl()) {
      if (/kick|punt|long snap/i.test(pos)) return 'Equipos especiales';
      if (/defens|linebacker|cornerback|safety|nose/i.test(pos)) return 'Defensiva';
      if (/quarter|running|receiver|tight|tackle|guard|center|fullback|offens/i.test(pos)) return 'Ofensiva';
      return 'Otros';
    }
    if (/goal/i.test(pos)) return 'Porteros';
    if (/back|defen/i.test(pos)) return 'Defensas';
    if (/midfield/i.test(pos)) return 'Medios';
    if (/forward|striker|wing/i.test(pos)) return 'Delanteros';
    if (/manager|coach/i.test(pos)) return 'Cuerpo técnico';
    return 'Otros';
  }

  var jugadoresVistos = {};
  function htmlPlantilla(l) {
    if (!l.length) return vacio('La API no tiene la plantilla de este equipo.');
    var grupos = {};
    l.forEach(function (p) { jugadoresVistos[p.idPlayer] = p; (grupos[grupoPosicion(p.strPosition)] = grupos[grupoPosicion(p.strPosition)] || []).push(p); });
    var orden = esNfl() ? ['Ofensiva', 'Defensiva', 'Equipos especiales', 'Otros'] : ['Porteros', 'Defensas', 'Medios', 'Delanteros', 'Cuerpo técnico', 'Otros'];
    return orden.filter(function (g) { return grupos[g]; }).map(function (g) {
      return '<div class="grupo-tit">' + g + '</div><div class="jugadores">' + grupos[g].map(function (p) {
        var e = edad(p.dateBorn);
        return '<button class="jugador" data-jugador="' + esc(p.idPlayer) + '">' + (p.strCutout || p.strThumb ? img(chica(p.strCutout || p.strThumb)) : '<img alt="">') +
          '<span><b>' + (p.strNumber ? esc(p.strNumber) + ' · ' : '') + esc(p.strPlayer) + '</b><small>' + esc(p.strPosition || '') +
          (e ? ' · ' + e + ' años' : '') + (p.strNationality ? ' · ' + esc(p.strNationality) : '') + '</small></span></button>';
      }).join('') + '</div>';
    }).join('') + recorte('lookup_all_players.php', l.length, 'jugadores por equipo (en orden alfabético)');
  }

  function htmlEstadio(v) {
    if (!v) return vacio('La API no tiene datos de este estadio.');
    var mapa = '';
    if (v.strMap) {
      var ll = v.strMap.split(',').map(function (s) { return parseFloat(s); });
      if (ll.length === 2 && !isNaN(ll[0]) && !isNaN(ll[1])) mapa = enlace('https://www.openstreetmap.org/?mlat=' + ll[0] + '&mlon=' + ll[1] + '#map=15/' + ll[0] + '/' + ll[1], 'Ver en el mapa');
    }
    return '<h3 style="font-size:22px">' + esc(v.strVenue) + '</h3>' +
      '<div class="datos" style="margin-top:8px">' + dato('Capacidad', v.intCapacity ? miles(v.intCapacity) : '') + dato('Inaugurado', v.intFormedYear) +
      dato('Ubicación', v.strLocation) + dato('País', v.strCountry) + dato('Costo', v.strCost) + dato('Arquitecto', v.strArchitect) +
      dato('Patrocinador', v.strVenueSponsor) + dato('Otros nombres', v.strVenueAlternate) + dato('Zona horaria', v.strTimezone) + '</div>' +
      '<div class="datos" style="margin-top:6px">' + [mapa, enlace(v.strWebsite, 'Sitio')].filter(Boolean).join(' · ') + '</div>' +
      (v.strThumb ? img(v.strThumb, 'foto', 'Foto del estadio') : '') +
      '<div class="galeria">' + [v.strFanart1, v.strFanart2].filter(Boolean).map(function (u) { return img(u + '/small'); }).join('') + '</div>' +
      (v.desc ? '<p class="desc abierta" style="margin-top:10px">' + esc(v.desc) + '</p>' : '');
  }

  function htmlUniformes(l) {
    if (!l.length) return vacio('La API no tiene uniformes de este equipo.');
    return '<div class="galeria">' + l.map(function (u) {
      return '<figure style="margin:0;text-align:center">' + img(u.img + '/small', '', 'Uniforme ' + (u.tipo || '')) +
        '<figcaption class="nota">' + esc((u.tipo || '') + ' · ' + (u.temp || '')) + '</figcaption></figure>';
    }).join('') + '</div>' + recorte('lookupequipment.php', l.length, 'uniformes');
  }

  // ---------- ficha de jugador ----------
  function abrirJugador(id) {
    var p = jugadoresVistos[id];
    if (!p) return;
    var e = edad(p.dateBorn);
    var html = '<div class="sdb-liga" style="margin-top:0">' + (p.strCutout || p.strThumb ? img(p.strCutout || p.strThumb, 'logo', '') : '') +
      '<div class="info"><div class="datos">' + dato('Equipo', p.strTeam) + dato('Número', p.strNumber) + dato('Posición', p.strPosition) +
      dato('Nacionalidad', p.strNationality) + dato('Nacimiento', p.dateBorn ? fecha(Date.parse(p.dateBorn)) + (e ? ' (' + e + ' años)' : '') : '') +
      dato('Lugar', p.strBirthLocation) + dato('Estatura', p.strHeight) + dato('Peso', p.strWeight) + dato('Universidad', p.strCollege) +
      dato('Pierna/brazo', p.strSide) + dato('Estado', p.strStatus) + '</div>' + descripcion(p.desc) + '</div></div>' + BLOQUE_PESTANAS;
    var gen = function (tipo, render) {
      return function () { return S.extraJugador(tipo, id).then(function (l) { return l.length ? render(l) : vacio('La API no tiene este dato para este jugador.'); }); };
    };
    var defs = [
      { t: 'Estadísticas', fn: gen('stats', function (l) {
        return '<div class="tabla-scroll"><table style="min-width:0"><thead><tr><th>Temporada</th><th class="eq">Estadística</th><th>Valor</th><th>Equipo</th></tr></thead><tbody>' +
          l.map(function (s) { return '<tr><td>' + esc(s.strSeason) + '</td><td class="eq">' + esc(s.strStatistic) + '</td><td><b>' + esc(s.strValue) + '</b></td><td>' + esc(s.strTeam || '') + '</td></tr>'; }).join('') +
          '</tbody></table></div>' + recorte('lookupplayerstats.php', l.length, 'estadísticas por jugador');
      }) },
      { t: 'Equipos anteriores', fn: gen('equipos', function (l) {
        return '<ul class="lista-simple">' + l.map(function (x) {
          return '<li><span>' + img(chica(x.strBadge)) + ' ' + esc(x.strFormerTeam) + '</span><span>' + esc((x.strJoined || '?') + ' – ' + (x.strDeparted || '?')) + (x.strMoveType ? ' · ' + esc(x.strMoveType) : '') + '</span></li>';
        }).join('') + '</ul>';
      }) },
      { t: 'Palmarés', fn: gen('honores', listaGenerica) },
      { t: 'Hitos', fn: gen('hitos', listaGenerica) },
      { t: 'Contratos', fn: gen('contratos', listaGenerica) }
    ];
    abrirModal(p.strPlayer, html, function (c) { pestanas(c, defs); });
  }

  function listaGenerica(l) {
    return '<ul class="lista-simple">' + l.map(function (x) {
      var ks = Object.keys(x).filter(function (k) { return !/Badge|Player$|^strSport/.test(k); });
      return '<li><span>' + ks.slice(0, 3).map(function (k) { return esc(x[k]); }).join(' · ') + '</span><span>' + ks.slice(3, 5).map(function (k) { return esc(x[k]); }).join(' · ') + '</span></li>';
    }).join('') + '</ul>';
  }

  // ---------- eventos ----------
  var tabs = document.querySelector('#sdb [role=tablist]');
  tabs.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-dep]');
    if (!b || b.getAttribute('data-dep') === est.dep) return;
    est.dep = b.getAttribute('data-dep');
    guardar('sdb:dep', est.dep);
    cargar();
  });
  tabs.addEventListener('keydown', function (ev) {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    est.dep = est.dep === 'futbol' ? 'nfl' : 'futbol';
    guardar('sdb:dep', est.dep);
    cargar();
    document.querySelector('[data-dep="' + est.dep + '"]').focus();
  });

  $('sdbChips').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-liga]');
    if (!b) return;
    est.liga[est.dep] = b.getAttribute('data-liga');
    cargar();
  });

  // Abre una liga de fútbol por ID; si no está en los chips la agrega (se conservan las últimas MAX_EXTRAS).
  function abrirLiga(id) {
    est.dep = 'futbol';
    guardar('sdb:dep', est.dep);
    if (ligasDe('futbol').some(function (l) { return l.id === id; })) { est.liga.futbol = id; cargar(); return Promise.resolve(); }
    estado('Buscando la liga ' + id + '…');
    return S.liga(id).then(function (l) {
      if (!l) throw new Error('TheSportsDB no tiene la liga ' + id + '.');
      if (l.strSport !== 'Soccer') throw new Error(l.strLeague + ' no es de fútbol (' + l.strSport + ').');
      est.extras.push({ id: id, n: l.strLeague });
      est.extras = est.extras.slice(-MAX_EXTRAS);
      guardar('sdb:extras', est.extras);
      est.liga.futbol = id;
      cargar();
    }).catch(function (e) { estado('No se pudo abrir la liga: ' + e.message); });
  }

  $('sdbAgregar').addEventListener('click', function () {
    var id = String(parseInt($('sdbNueva').value, 10) || '');
    if (!id) return;
    abrirLiga(id).then(function () { $('sdbNueva').value = ''; });
  });

  // Buscador "Todas las ligas": catálogo de data/ligas.js + lo que devuelva la API para el país
  // (la versión gratis da solo 5 por país, por eso el catálogo).
  var CATALOGO = window.LIGAS || [];
  $('sdbPais').innerHTML = '<option value="">Elige un país…</option>' + CATALOGO.map(function (c, i) {
    return '<option value="' + i + '">' + esc(c.pais) + '</option>';
  }).join('');
  $('sdbPais').addEventListener('change', function () {
    var sel = $('sdbLigaPais'), c = CATALOGO[this.value];
    sel.disabled = !c;
    if (!c) { sel.innerHTML = ''; return; }
    var pintar = function (ls) {
      sel.innerHTML = '<option value="">Elige una liga…</option>' + ls.map(function (l) {
        return '<option value="' + esc(l.id) + '">' + esc(l.n) + '</option>';
      }).join('');
    };
    pintar(c.ligas);
    if (!c.c) return;
    S.ligasPais(c.c).then(function (api) {
      if (CATALOGO[$('sdbPais').value] !== c) return;
      var ya = {};
      c.ligas.forEach(function (l) { ya[l.id] = 1; });
      pintar(c.ligas.concat(api.filter(function (l) { return !ya[l.id] && !/^_/.test(l.n); })));
    }).catch(function () { /* queda el catálogo */ });
  });
  $('sdbLigaPais').addEventListener('change', function () { if (this.value) abrirLiga(this.value); });

  $('sdbTemporada').addEventListener('change', function () {
    est.temp[idLiga()] = this.value;
    guardar('sdb:temp', est.temp);
    cargar();
  });
  $('sdbTorneo').addEventListener('change', function () { ctx.torneo = Number(this.value); ctx.ronda = null; pintarTodo(); });

  $('sdbVistas').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-vista]');
    if (!b) return;
    est.vista = b.getAttribute('data-vista');
    pintarVistas();
    pintarTodo();
  });

  $('sdbRefrescar').addEventListener('click', function () { S.borrarCache(); cargar(); });

  // Clics delegados: equipos, partidos, jugadores, "Ver más".
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var d = t.closest('[data-desc]');
    if (d) { var p = d.previousElementSibling; var ab = p.classList.toggle('abierta'); d.textContent = ab ? 'Ver menos' : 'Ver más'; return; }
    if (!t.closest('#sdb, #sdbModal')) return;
    // Reintentar: las jornadas que ya llegaron salen de la caché; solo se piden las que faltan.
    if (t.closest('[data-reintentar]')) { cargar(); return; }
    var e = t.closest('[data-equipo]'); if (e) { abrirEquipo(e.getAttribute('data-equipo')); return; }
    var pa = t.closest('[data-partido]'); if (pa) { abrirPartido(pa.getAttribute('data-partido')); return; }
    var j = t.closest('[data-jugador]'); if (j) { abrirJugador(j.getAttribute('data-jugador')); return; }
    if (t.closest('[data-volver]')) { modal.pila.pop(); mostrarTope(); return; }
    if (t.closest('[data-cerrar]')) cerrarModal();
  });

  // Teclado del modal: Esc cierra y Tab no sale de la caja.
  $('sdbModal').addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { cerrarModal(); return; }
    if (ev.key !== 'Tab') return;
    var f = Array.prototype.filter.call($('sdbModal').querySelectorAll('button, a[href], select, input, [tabindex="0"]'), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var pri = f[0], ult = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === pri) { ev.preventDefault(); ult.focus(); }
    else if (!ev.shiftKey && document.activeElement === ult) { ev.preventDefault(); pri.focus(); }
  });

  cargar();
})();
