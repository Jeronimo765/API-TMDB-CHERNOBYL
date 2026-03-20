/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * script.js — Chernobyl TMDB Explorer
 * Endpoints:
 *  1. GET /tv/{id}          → Detalles de la serie
 *  2. GET /tv/{id}/credits  → Reparto y equipo técnico
 *  3. GET /tv/{id}/season/1 → Episodios de la temporada 1
 *  4. GET /tv/{id}/images   → Galería de imágenes y posters
 *  5. GET /tv/{id}/videos   → Tráilers y featurettes
 *  6. GET /tv/{id}/reviews  → Reseñas de usuarios
 * BONUS: GET /person/{id}   → Detalle de persona al hacer click
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

var API_KEY = '2ef18249c07ca88944180206dd4b8e9d';
var SERIES_ID = 87108;
var BASE_URL = 'https://api.themoviedb.org/3';
var IMG_BASE = 'https://image.tmdb.org/t/p/';
var LANG = 'es-ES';
var cache = {};
var loaded = {};

/* ─── fetchTMDB ─────────────────────────────────────────────
   Función central que hace todas las peticiones a la API.
   Incluye caché local y manejo de errores HTTP.
───────────────────────────────────────────────────────────── */
async function fetchTMDB(endpoint, extra) {
  extra = extra || {};
  var url = new URL(BASE_URL + endpoint);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', LANG);
  Object.keys(extra).forEach(function (k) { url.searchParams.set(k, extra[k]); });

  var key = url.toString();
  if (cache[key]) return cache[key];

  var res = await fetch(key);

  if (!res.ok) {
    if (res.status === 401) throw new Error('API Key invalida (401)');
    if (res.status === 404) throw new Error('No encontrado (404)');
    if (res.status === 429) throw new Error('Limite de peticiones (429). Espera un momento.');
    throw new Error('Error ' + res.status + ': ' + res.statusText);
  }

  var data = await res.json();
  cache[key] = data;
  return data;
}

/* ─── Navegación ────────────────────────────────────────────
   Controla qué sección se muestra y carga sus datos
   la primera vez que el usuario la visita.
───────────────────────────────────────────────────────────── */
function showSection(name) {
  document.querySelectorAll('.section').forEach(function (s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });

  var sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  var btn = document.querySelector('[data-section="' + name + '"]');
  if (btn) btn.classList.add('active');

  if (!loaded[name]) {
    loaded[name] = true;
    if (name === 'episodes') loadEpisodes();
    else if (name === 'cast') loadCredits();
    else if (name === 'gallery') loadImages();
    else if (name === 'videos') loadVideos();
    else if (name === 'reviews') loadReviews();
  }
}

/* ─── ENDPOINT 1: /tv/{id} ──────────────────────────────────
   Carga los detalles principales de la serie.
   Rellena el hero, score ring, dashboard y sinopsis.
───────────────────────────────────────────────────────────── */
async function loadSeriesDetails() {
  var d = await fetchTMDB('/tv/' + SERIES_ID);

  // Imagen de fondo (backdrop)
  if (d.backdrop_path)
    document.getElementById('hero-card').style.backgroundImage =
      'url(' + IMG_BASE + 'w1280' + d.backdrop_path + ')';

  // Título
  document.getElementById('hero-title').textContent = d.name || 'Chernobyl';

  // Metadatos del hero
  var year = d.first_air_date ? d.first_air_date.slice(0, 4) : '—';
  var mins = d.episode_run_time && d.episode_run_time[0] ? d.episode_run_time[0] + ' min' : '—';
  var lang = (d.original_language || '—').toUpperCase();
  document.getElementById('hero-meta').innerHTML =
    '<div class="hero-meta-item"><span class="dot">·</span>' + year + '</div>' +
    '<div class="hero-meta-item"><span class="dot">·</span>' + mins + ' por ep.</div>' +
    '<div class="hero-meta-item"><span class="dot">·</span>' + lang + '</div>' +
    '<div class="hero-meta-item"><span class="dot">·</span>' + (d.status || '—') + '</div>';

  // Anillo de puntuación animado
  var score = parseFloat((d.vote_average || 0).toFixed(1));
  document.getElementById('score-number').textContent = score;
  document.getElementById('vote-count').textContent =
    (d.vote_count || 0).toLocaleString('es-ES') + ' votos';
  setTimeout(function () {
    document.getElementById('score-circle').style.strokeDashoffset =
      339.3 - (score / 10) * 339.3;
  }, 500);

  // Mini stats dashboard
  document.getElementById('stat-eps').textContent = d.number_of_episodes || '—';
  document.getElementById('stat-year').textContent = year;
  document.getElementById('stat-pop').textContent = d.popularity ? Math.round(d.popularity) : '—';

  // Sinopsis
  document.getElementById('overview-text').textContent = d.overview || 'Sin descripcion.';

  // Géneros
  var gt = document.getElementById('genre-tags');
  gt.innerHTML = '';
  (d.genres || []).forEach(function (g) {
    var s = document.createElement('span');
    s.className = 'genre-tag';
    s.textContent = g.name;
    gt.appendChild(s);
  });

  // Stats bar inferior
  document.getElementById('s-seasons').textContent = d.number_of_seasons || '—';
  document.getElementById('s-eps2').textContent = d.number_of_episodes || '—';
  document.getElementById('s-lang').textContent = lang;
  document.getElementById('s-air').textContent = d.first_air_date || '—';
  document.getElementById('s-status').textContent = d.status || '—';
  document.getElementById('s-net').textContent =
    d.networks && d.networks[0] ? d.networks[0].name : '—';
}

/* ─── ENDPOINT 2: /tv/{id}/credits ─────────────────────────
   Carga actores y equipo técnico.
   Al hacer click en cualquier persona abre el modal bonus.
───────────────────────────────────────────────────────────── */
async function loadCredits() {
  var d = await fetchTMDB('/tv/' + SERIES_ID + '/credits');
  var cast = d.cast || [];
  var crew = d.crew || [];
  var ph = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%231a1a1a' width='80' height='80' rx='40'/%3E%3Ctext x='40' y='50' text-anchor='middle' fill='%235a5752' font-size='26'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";

  var castEl = document.getElementById('cast-list');
  castEl.innerHTML = '';
  cast.slice(0, 20).forEach(function (p) {
    var div = document.createElement('div');
    div.className = 'cast-item';
    var src = p.profile_path ? IMG_BASE + 'w185' + p.profile_path : ph;
    div.innerHTML =
      '<img class="cast-avatar" src="' + src + '" alt="' + p.name +
      '" loading="lazy" onerror="this.src=\'' + ph + '\'" />' +
      '<div class="cast-name">' + p.name + '</div>' +
      '<div class="cast-role">' + (p.character || '—') + '</div>';
    div.onclick = function () { openPersonModal(p.id); };
    castEl.appendChild(div);
  });

  var crewEl = document.getElementById('crew-list');
  crewEl.innerHTML = '';
  var roles = ['Director', 'Writer', 'Executive Producer', 'Creator', 'Screenplay'];
  crew.filter(function (p) { return roles.indexOf(p.job) !== -1; })
    .slice(0, 10).forEach(function (p) {
      var div = document.createElement('div');
      div.className = 'cast-item';
      var src = p.profile_path ? IMG_BASE + 'w185' + p.profile_path : ph;
      div.innerHTML =
        '<img class="cast-avatar" src="' + src + '" alt="' + p.name +
        '" loading="lazy" onerror="this.src=\'' + ph + '\'" />' +
        '<div class="cast-name">' + p.name + '</div>' +
        '<div class="cast-role">' + p.job + '</div>';
      div.onclick = function () { openPersonModal(p.id); };
      crewEl.appendChild(div);
    });

  document.getElementById('c-cast').textContent = cast.length;
  document.getElementById('c-crew').textContent = crew.length;
}

/* ─── ENDPOINT 3: /tv/{id}/season/1 ────────────────────────
   Carga episodios con thumbnail, título, descripción y rating.
   También construye el gráfico de barras de valoraciones.
───────────────────────────────────────────────────────────── */
async function loadEpisodes() {
  var d = await fetchTMDB('/tv/' + SERIES_ID + '/season/1');
  var eps = d.episodes || [];
  var list = document.getElementById('episodes-list');
  var chart = document.getElementById('ep-chart');
  list.innerHTML = chart.innerHTML = '';

  if (!eps.length) {
    list.innerHTML = '<div class="empty-state">Sin episodios.</div>';
    return;
  }

  var maxR = Math.max.apply(null, eps.map(function (e) { return e.vote_average || 0; }).concat([1]));

  eps.forEach(function (ep) {
    var num = String(ep.episode_number).padStart(2, '0');
    var rat = ep.vote_average ? ep.vote_average.toFixed(1) : '—';
    var thumb = ep.still_path ? IMG_BASE + 'w300' + ep.still_path : '';

    var item = document.createElement('div');
    item.className = 'episode-item';
    item.innerHTML =
      (thumb ? '<img class="ep-thumb" src="' + thumb + '" loading="lazy" onerror="this.style.display=\'none\'" />'
        : '<div class="ep-thumb"></div>') +
      '<div class="ep-info">' +
      '<div class="ep-num">EP' + num + (ep.air_date ? ' · ' + ep.air_date : '') + (ep.runtime ? ' · ' + ep.runtime + 'min' : '') + '</div>' +
      '<div class="ep-title">' + (ep.name || 'Sin titulo') + '</div>' +
      '<div class="ep-overview">' + (ep.overview || 'Sin descripcion.') + '</div>' +
      '</div>' +
      '<div class="ep-rating">★ ' + rat + '</div>';
    list.appendChild(item);

    // Barra del gráfico
    var pct = ((ep.vote_average || 0) / maxR) * 100;
    var row = document.createElement('div');
    row.className = 'chart-row';
    row.innerHTML =
      '<div class="chart-label">EP' + num + '</div>' +
      '<div class="chart-bar-track"><div class="chart-bar-fill" data-pct="' + pct + '"></div></div>' +
      '<div class="chart-val">' + rat + '</div>';
    chart.appendChild(row);
  });

  setTimeout(function () {
    document.querySelectorAll('.chart-bar-fill').forEach(function (b) {
      b.style.width = b.dataset.pct + '%';
    });
  }, 300);
}

/* ─── ENDPOINT 4: /tv/{id}/images ──────────────────────────
   Carga backdrops en grid y posters en scroll horizontal.
   Click en cualquier imagen abre el lightbox.
───────────────────────────────────────────────────────────── */
async function loadImages() {
  var d = await fetchTMDB('/tv/' + SERIES_ID + '/images',
    { include_image_language: 'en,null,es' });

  var bdEl = document.getElementById('backdrops-grid');
  bdEl.innerHTML = '';
  (d.backdrops || []).slice(0, 18).forEach(function (img) {
    var el = document.createElement('img');
    el.className = 'gallery-img';
    el.src = IMG_BASE + 'w780' + img.file_path;
    el.alt = 'Backdrop'; el.loading = 'lazy';
    el.onerror = function () { this.style.display = 'none'; };
    el.onclick = function () { openLightbox(IMG_BASE + 'original' + img.file_path); };
    bdEl.appendChild(el);
  });
  if (!bdEl.children.length)
    bdEl.innerHTML = '<div class="empty-state">Sin imagenes.</div>';

  var posEl = document.getElementById('posters-scroll');
  posEl.innerHTML = '';
  (d.posters || []).slice(0, 16).forEach(function (img) {
    var el = document.createElement('img');
    el.className = 'poster-img';
    el.src = IMG_BASE + 'w342' + img.file_path;
    el.alt = 'Poster'; el.loading = 'lazy';
    el.onerror = function () { this.style.display = 'none'; };
    el.onclick = function () { openLightbox(IMG_BASE + 'original' + img.file_path); };
    posEl.appendChild(el);
  });
  if (!posEl.children.length)
    posEl.innerHTML = '<div class="empty-state">Sin posters.</div>';
}

/* ─── ENDPOINT 5: /tv/{id}/videos ──────────────────────────
   Carga tráilers de YouTube.
   Click en cada tarjeta abre el video en YouTube.
───────────────────────────────────────────────────────────── */
async function loadVideos() {
  var d = await fetchTMDB('/tv/' + SERIES_ID + '/videos');
  var videos = (d.results || []).filter(function (v) { return v.site === 'YouTube'; });
  var listEl = document.getElementById('video-list');
  listEl.innerHTML = '';

  if (!videos.length) {
    listEl.innerHTML = '<div class="empty-state">Sin videos.</div>';
    return;
  }

  videos.forEach(function (v) {
    var card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML =
      '<div class="video-thumb">' +
      '<img src="https://img.youtube.com/vi/' + v.key + '/hqdefault.jpg"' +
      ' alt="' + v.name + '" onerror="this.style.opacity=0.2" />' +
      '<div class="play-btn"><svg width="48" height="48" viewBox="0 0 48 48" fill="none">' +
      '<circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.5)"/>' +
      '<polygon points="19,16 35,24 19,32" fill="#b8ff3a"/></svg></div>' +
      '</div>' +
      '<div class="video-title">' + v.name + '</div>' +
      '<div class="video-type">' + v.type + '</div>';
    card.onclick = function () {
      window.open('https://www.youtube.com/watch?v=' + v.key, '_blank');
    };
    listEl.appendChild(card);
  });
}

/* ─── ENDPOINT 6: /tv/{id}/reviews ─────────────────────────
   Carga reseñas de usuarios con autor, puntuación y texto.
   También genera el gráfico de distribución de scores.
───────────────────────────────────────────────────────────── */
async function loadReviews() {
  var d = await fetchTMDB('/tv/' + SERIES_ID + '/reviews');
  var reviews = d.results || [];
  var listEl = document.getElementById('reviews-list');
  listEl.innerHTML = '';

  document.getElementById('rev-total').textContent = d.total_results || reviews.length;

  if (!reviews.length) {
    listEl.innerHTML = '<div class="empty-state">Sin reseñas.</div>';
    return;
  }

  reviews.forEach(function (r) {
    var rat = r.author_details && r.author_details.rating
      ? '★ ' + r.author_details.rating + '/10' : 'Sin puntaje';
    var text = (r.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML =
      '<div class="review-header">' +
      '<span class="review-author">' + r.author + '</span>' +
      '<span class="review-rating">' + rat + '</span>' +
      '</div>' +
      '<div class="review-text">' + text + '</div>';
    listEl.appendChild(item);
  });

  // Gráfico de distribución de puntuaciones
  var distEl = document.getElementById('rev-dist');
  distEl.innerHTML = '<div class="card-label" style="margin-bottom:8px;">Distribucion</div>';
  var b = { '★ 10': 0, '★ 8-9': 0, '★ 6-7': 0, '★ 1-5': 0, 'Sin score': 0 };
  reviews.forEach(function (r) {
    var sc = r.author_details && r.author_details.rating ? r.author_details.rating : null;
    if (!sc) b['Sin score']++;
    else if (sc === 10) b['★ 10']++;
    else if (sc >= 8) b['★ 8-9']++;
    else if (sc >= 6) b['★ 6-7']++;
    else b['★ 1-5']++;
  });
  var maxV = Math.max.apply(null, Object.keys(b).map(function (k) { return b[k]; }).concat([1]));
  Object.keys(b).forEach(function (label) {
    var row = document.createElement('div');
    row.className = 'chart-row';
    row.innerHTML =
      '<div class="chart-label">' + label + '</div>' +
      '<div class="chart-bar-track"><div class="chart-bar-fill" data-pct="' +
      ((b[label] / maxV) * 100) + '"></div></div>' +
      '<div class="chart-val">' + b[label] + '</div>';
    distEl.appendChild(row);
  });
  setTimeout(function () {
    distEl.querySelectorAll('.chart-bar-fill').forEach(function (x) {
      x.style.width = x.dataset.pct + '%';
    });
  }, 200);
}

/* ─── BONUS: /person/{id} ───────────────────────────────────
   Se activa al hacer click en cualquier actor del reparto.
   Muestra foto, nombre, departamento y biografía en un modal.
───────────────────────────────────────────────────────────── */
async function openPersonModal(personId) {
  if (!personId) return;
  document.getElementById('person-modal').classList.add('open');
  document.getElementById('pm-name').textContent = 'Cargando...';
  document.getElementById('pm-bio').textContent = '';

  try {
    var d = await fetchTMDB('/person/' + personId);
    var ph = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%231a1a1a' width='100' height='100' rx='50'/%3E%3C/svg%3E";
    document.getElementById('pm-img').src = d.profile_path ? IMG_BASE + 'w185' + d.profile_path : ph;
    document.getElementById('pm-name').textContent = d.name || '—';
    document.getElementById('pm-known').textContent = d.known_for_department || 'Actuacion';
    document.getElementById('pm-bio').textContent = d.biography || 'Sin biografia disponible.';
  } catch (e) {
    document.getElementById('pm-name').textContent = 'Error al cargar';
    console.error('[Modal]', e.message);
  }
}

function closePersonModal() {
  document.getElementById('person-modal').classList.remove('open');
}

/* ─── Lightbox ──────────────────────────────────────────────── */
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

/* ─── Eventos ───────────────────────────────────────────────── */
document.getElementById('lightbox-close').onclick = closeLightbox;
document.getElementById('lightbox').onclick = function (e) {
  if (e.target === this) closeLightbox();
};
document.getElementById('modal-close-btn').onclick = closePersonModal;
document.getElementById('person-modal').onclick = function (e) {
  if (e.target === this) closePersonModal();
};
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { closeLightbox(); closePersonModal(); }
});
document.getElementById('nav-menu').onclick = function (e) {
  var btn = e.target.closest('.nav-btn');
  if (btn && btn.dataset.section) showSection(btn.dataset.section);
};

/* ─── INIT ──────────────────────────────────────────────────────
   Punto de entrada. Carga los datos del Endpoint 1 y
   revela la interfaz cuando termina.
───────────────────────────────────────────────────────────── */
loadSeriesDetails()
  .then(function () {
    loaded['overview'] = true;
    document.getElementById('loader').classList.add('hidden');
    setTimeout(function () {
      document.getElementById('app').classList.add('visible');
    }, 200);
  })
  .catch(function (err) {
    document.getElementById('loader').innerHTML =
      '<div style="text-align:center;padding:40px;font-family:sans-serif;">' +
      '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
      '<div style="color:#f0ede8;font-size:18px;font-weight:600;margin-bottom:10px;">Error al conectar con TMDB</div>' +
      '<div style="color:#ff5a2c;font-size:14px;margin-bottom:12px;">' + err.message + '</div>' +
      '<div style="color:#5a5752;font-size:12px;line-height:1.8;">' +
      '1. Sin conexion a internet<br>' +
      '2. Red bloquea themoviedb.org<br>' +
      '3. API Key incorrecta' +
      '</div>' +
      '</div>';
  });

// ─── PWA: Service Worker ─────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js')
      .then(function (reg) {
        console.log('SW registrado', reg.scope);
      })
      .catch(function (err) {
        console.log('Error SW', err);
      });
  });
}