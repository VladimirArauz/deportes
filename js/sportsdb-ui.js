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
        { id: '4350', n: 'Liga MX' }, { id: '4334', n: 'Ligue 1' },
        { id: '4406', n: 'Primera División · Argentina' }, { id: '4328', n: 'Premier League' }
      ],
      maxRondas: 46, ronda: 'Jornada', pts: 'goles'
    },
    nfl: { ligas: [{ id: '4391', n: 'NFL' }], maxRondas: 18, ronda: 'Semana', pts: 'puntos' }
  };
  var PRETEMPORADA_NFL = 500;
  var HUECO_TORNEO = 30 * 86400e3;

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

  // Altitud y zona de data/equipos.js: coincidencia exacta o el alias más largo contenido en el nombre.
  var EXTRA = (window.EQUIPOS || []).map(function (e) { return { e: e, nombres: e.nombres.map(normalizar) }; });
  function datosPropios(nombre) {
    var n = normalizar(nombre), mejor = null, largo = 0;
    EXTRA.forEach(function (x) {
      x.nombres.forEach(function (al) {
        if (al === n) { mejor = x.e; largo = 1e9; }
        else if ((' ' + n + ' ').indexOf(' ' + al + ' ') >= 0 && al.length > largo) { mejor = x.e; largo = al.length; }
      });
    });
    return mejor;
  }

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
    ctx = { id: id, partidos: {}, rondas: {}, oficial: [], torneo: null, cargando: true, nfl: esNfl() };
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
      var n = Object.keys(ctx.partidos).length;
      estado('Listo · ' + ctx.info.strLeague + ' ' + ctx.temp + ': ' + n + ' partidos cargados.');
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

  function cargarRondas(mio) {
    var id = ctx.id, temp = ctx.temp;
    var pedirRonda = function (r) {
      return S.jornada(id, temp, r).then(function (lista) {
        if (mio !== turno) return lista;
        ctx.rondas[r] = lista.length;
        agregar(lista);
        pintarTodo();
        return lista;
      });
    };
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
          return orden.reduce(function (p, rr) {
            return p.then(function () { return mio === turno ? pedirRonda(rr).catch(function () { return []; }) : null; });
          }, Promise.resolve());
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
        vacias = l.length ? 0 : vacias + 1;
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
    return { id: id, eq: nombre, escudo: escudo, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, L: z(), V: z(), res: [] };
  }

  // Tabla y tendencias de todos los equipos con los partidos terminados.
  function calcular(ps) {
    var eqs = {};
    var reg = function (id, n, e) { return eqs[id] || (eqs[id] = nuevoRegistro(id, n, e)); };
    ps.forEach(function (p) {
      var h = reg(p.h, p.hN, p.hE), a = reg(p.a, p.aN, p.aE);
      if (!S.terminado(p) || p.hG == null || p.aG == null) return;
      [[h, p.hG, p.aG, 'L'], [a, p.aG, p.hG, 'V']].forEach(function (x) {
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

  // ---------- tablas ordenables ----------
  // cols: [{k, t, v(fila) -> valor para ordenar, h(fila) -> html, cls}]
  function tablaOrdenable(cont, cols, filas, orden, extraFila) {
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
        tablaOrdenable(cont, cols, filas, { k: k, asc: orden.k === k ? !orden.asc : k === 'eq', desempate: orden.desempate }, extraFila);
      });
    });
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

  $('sdbAgregar').addEventListener('click', function () {
    var id = String(parseInt($('sdbNueva').value, 10) || '');
    if (!id) return;
    if (ligasDe('futbol').some(function (l) { return l.id === id; })) { estado('Esa liga ya está en la lista.'); return; }
    estado('Buscando la liga ' + id + '…');
    S.liga(id).then(function (l) {
      if (!l) throw new Error('TheSportsDB no tiene la liga ' + id + '.');
      if (l.strSport !== 'Soccer') throw new Error(l.strLeague + ' no es de fútbol (' + l.strSport + ').');
      est.extras.push({ id: id, n: l.strLeague });
      guardar('sdb:extras', est.extras);
      $('sdbNueva').value = '';
      est.liga.futbol = id;
      cargar();
    }).catch(function (e) { estado('No se pudo agregar: ' + e.message); });
  });

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
