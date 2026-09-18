/* ADVfactory — responsywność ekranów operatora / właściciela / przewodnika.
   Ekrany są projektowane pod 1440 px. Skrypt składa siatki układu przy węższym
   oknie, ale ROZPOZNAJE TABELE (nagłówek + wiersze o tych samych ścieżkach)
   i zamiast je niszczyć, daje im przewijanie poziome. */
(function () {
  var grids = null;
  var root = null, rootPad = null;

  function parseTracks(v) {
    var m = v.match(/^repeat\(\s*(\d+)\s*,\s*(.+?)\s*\)$/i);
    if (m) return { n: parseInt(m[1], 10), equal: true };
    var parts = v.trim().split(/\s+(?![^(]*\))/);
    return { n: parts.length, equal: parts.every(function (p) { return p === parts[0]; }) };
  }

  function colsFor(n, w) {
    if (w >= 1280) return n;
    if (w >= 640) return Math.min(n, 2);
    return 1;
  }

  function collect() {
    grids = [];
    var counts = {};
    var all = document.querySelectorAll('[style*="grid-template-columns"]');
    for (var i = 0; i < all.length; i++) {
      var raw = all[i].getAttribute("style") || "";
      var m = raw.match(/grid-template-columns\s*:\s*([^;]+)/i);
      if (!m) continue;
      var val = m[1].trim();
      var t = parseTracks(val);
      if (t.n < 2) continue;
      counts[val] = (counts[val] || 0) + 1;
      grids.push({ el: all[i], orig: val, n: t.n, equal: t.equal });
    }
    // Tabela = mieszane ścieżki powtórzone ≥2 razy ORAZ obecny wiersz nagłówka
    // (jasne tło + wersaliki). Bez tego heurystyka łapie zwykłe wiersze kart.
    var headerish = {};
    grids.forEach(function (g) {
      var st = (g.el.getAttribute("style") || "").toLowerCase().replace(/\s+/g, "");
      if (st.indexOf("text-transform:uppercase") >= 0 && st.indexOf("var(--sunken)") >= 0) headerish[g.orig] = true;
    });
    grids.forEach(function (g) { g.table = !g.equal && counts[g.orig] >= 2 && !!headerish[g.orig]; });

    var spans = document.querySelectorAll('[style*="grid-column"]');
    for (var j = 0; j < spans.length; j++) {
      var sm = (spans[j].getAttribute("style") || "").match(/grid-column\s*:\s*span\s+(\d+)/i);
      if (sm) spans[j].__span = parseInt(sm[1], 10);
    }
  }

  function apply() {
    if (!root) {
      root = document.querySelector("[data-screen-label]");
      if (root) rootPad = root.style.padding;
    }
    if (root && rootPad) root.style.padding = window.innerWidth < 700 ? "14px 12px" : rootPad;
    if (!grids) collect();
    if (!grids.length) return;
    var w = window.innerWidth;
    grids.forEach(function (g) {
      if (g.table && w >= 700) {
        g.el.style.gridTemplateColumns = g.orig;
        g.el.style.minWidth = w >= 1280 ? "" : "860px";
        var p = g.el.parentElement;
        if (p) p.style.overflowX = w >= 1280 ? "" : "auto";
        return;
      }
      if (g.table) { g.el.style.minWidth = ""; var pp = g.el.parentElement; if (pp) pp.style.overflowX = ""; }
      var c = colsFor(g.n, w);
      if (c === g.n) {
        g.el.style.gridTemplateColumns = g.orig;
      } else if (g.equal) {
        g.el.style.gridTemplateColumns = c === 1 ? "minmax(0,1fr)" : "repeat(" + c + ",minmax(0,1fr))";
      } else {
        g.el.style.gridTemplateColumns = "minmax(0,1fr)";
      }
      for (var k = 0; k < g.el.children.length; k++) {
        var ch = g.el.children[k];
        if (ch.__span) ch.style.gridColumn = ch.__span > c ? "1 / -1" : "span " + ch.__span;
      }
    });
  }

  function boot() {
    apply();
    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(function () { grids = null; apply(); }, 120); });
    var tries = 0;
    var iv = setInterval(function () { grids = null; apply(); if (++tries > 25) clearInterval(iv); }, 200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
