// ============================================================
// RIMAL SEAFOOD — SITE SCRIPT
// ============================================================
// Loaded with defer after menu-data.js, config.js and supabase-js, so it runs
// once the page is parsed. Each block below is a self-contained module.
// ============================================================

// The site starts right after the first frame is painted. Chrome fetches
// loading="lazy" images that are added before then, even on hidden pages, so
// starting earlier would download every Menu, Fish Market and Manager photo on
// the Home page. A tab opened in the background starts straight away.
function rimalStart(){

// Copies a card by re-parsing its HTML instead of cloneNode(). Chrome fetches
// a cloneNode() copy of a lazy image right away, even on a hidden page; a copy
// built in a <template> stays inert until it is placed on the page.
// Spreadsheet-safe CSV cell: text starting with = + - @ would run as a formula
// when the file is opened in Excel or Google Sheets, so it gets a leading apostrophe.
window.rimalCsvSafe = function(cell){
  var s = String(cell == null ? '' : cell);
  return (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) ? "'" + s : s;
};

window.rimalCopyNode = function(node){
  var t = document.createElement('template');
  t.innerHTML = node.outerHTML;
  return t.content.firstElementChild;
};

(function(){
  var cfg = window.RIMAL_CONFIG || {};
  window.rimalDb = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
      cfg.SUPABASE_URL.indexOf('PASTE_YOUR') === -1 &&
      window.supabase && window.supabase.createClient) {
    window.rimalDb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  } else {
    console.warn('Rimal Seafood: Supabase is not configured yet (see config.js). Online ordering will not reach the kitchen until it is set up.');
  }
})();
(function(){
  // Hash routing: each nav link shows one ".page". Back/Forward and typed
  // URLs work, and every page change starts at the top. An alias opens a page
  // at one of its sections (the Gallery used to be its own page).
  var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
  var navToggle = document.getElementById('navToggle');
  var siteNav = document.getElementById('siteNav');
  var main = document.getElementById('main');
  var current = null;      // route in the URL, e.g. 'gallery'
  var currentPage = null;  // page shown, e.g. 'about'
  var ALIASES = { gallery: { page: 'about', section: 'aboutGallery' } };
  if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }

  function pageExists(id){ return !!id && !!document.getElementById('page-' + id); }
  function routeExists(id){ return !!ALIASES[id] || pageExists(id); }

  function setNavOpen(open){
    siteNav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }

  function goToPage(route){
    var alias = ALIASES[route];
    var id = alias ? alias.page : route;
    if (!pageExists(id)) return false;
    current = route;
    currentPage = id;
    document.documentElement.setAttribute('data-page', id);
    pages.forEach(function(p){ p.classList.toggle('active', p.id === 'page-' + id); });
    siteNav.querySelectorAll('a[href^="#"]').forEach(function(a){
      var on = a.getAttribute('href').slice(1) === id;
      a.classList.toggle('active', on);
      if (on) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    var target = alias && document.getElementById(alias.section);
    if (target) { target.scrollIntoView({ behavior: 'instant', block: 'start' }); }
    else { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
    setNavOpen(false);
    if (id === 'market' && window.rimalApplyInventory) { window.rimalApplyInventory(); }
    document.dispatchEvent(new CustomEvent('rimal:page', { detail: { id: id } }));
    return true;
  }
  window.rimalGoToPage = function(id){
    if (!routeExists(id)) return false;
    if (location.hash !== '#' + id) { history.pushState(null, '', '#' + id); }
    return goToPage(id);
  };
  window.rimalCurrentPage = function(){ return currentPage; };

  // One delegated listener, so links added later (cart, dialogs) route too.
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var id = a.getAttribute('href').slice(1);
    if (!routeExists(id)) return;
    e.preventDefault();
    window.rimalGoToPage(id);
    if (main && a.closest('header, footer')) { main.focus({ preventScroll: true }); }
  });

  function syncFromUrl(){
    var id = (location.hash || '#home').slice(1);
    if (id === current) return;
    if (!goToPage(id) && !current) { goToPage('home'); }
  }
  window.addEventListener('popstate', syncFromUrl);
  window.addEventListener('hashchange', syncFromUrl);

  navToggle.addEventListener('click', function(){ setNavOpen(!siteNav.classList.contains('open')); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && siteNav.classList.contains('open')) { setNavOpen(false); navToggle.focus(); }
  });
  document.addEventListener('click', function(e){
    if (siteNav.classList.contains('open') && !siteNav.contains(e.target) && !navToggle.contains(e.target)) { setNavOpen(false); }
  });

  syncFromUrl();
})();

(function(){
  // The Google Map is heavy and Chrome loads hidden iframes even with
  // loading="lazy", so it is only attached the first time Visit is opened.
  var frame = document.querySelector('iframe[data-src]');
  if (!frame) return;
  function load(){
    if (window.rimalCurrentPage() !== 'visit' || frame.getAttribute('src')) return;
    frame.setAttribute('src', frame.getAttribute('data-src'));
  }
  document.addEventListener('rimal:page', load);
  load();
})();

(function(){
  // Fish Market "To Go" cards, rendered from RIMAL_MARKET (menu-data.js) before
  // the grill tab copies them and before the Manager tools scan them.
  var data = window.RIMAL_MARKET || [];
  var grids = document.querySelectorAll('#market-togo .market-grid');
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  data.forEach(function(group, gi){
    var grid = grids[gi];
    if (!grid) return;
    grid.innerHTML = group.items.map(function(it){
      var id = 'mq-' + it.name.replace(/\W+/g, '-');
      var step = it.step || (it.unit === 'lb' ? 0.5 : 1);
      return '<div class="market-card" data-name="' + esc(it.name) + '" data-price="' + it.price + '" data-unit="' + esc(it.unit) + '">' +
        (it.photo ? '<img src="' + esc(window.rimalPhotoUrl(it.photo, 480)) + '" alt="' + esc(it.name) + '" width="480" height="360" loading="lazy" decoding="async">' : '') +
        '<div class="market-card-body"><h4>' + esc(it.name) + '</h4>' +
        '<div class="menu-price">' + window.rimalMoney(it.price) + (it.unit ? '/' + esc(it.unit) : '') + '</div>' +
        '<div class="qty-row"><label class="visually-hidden" for="' + id + '">' + (it.unit === 'lb' ? 'Pounds of ' : it.unit === 'dz' ? 'Dozens of ' : 'Quantity of ') + esc(it.name) + '</label>' +
        '<input id="' + id + '" type="number" class="qty-input" value="' + (it.qty || 1) + '" min="' + step + '" step="' + step + '" inputmode="decimal">' +
        (it.unit ? '<span class="qty-unit">' + esc(it.unit) + '</span>' : '') +
        '<button class="btn btn-solid btn-cart" type="button" data-add>Add</button></div></div></div>';
    }).join('');
  });
})();

(function(){
  var GRILL_FEE = 4.99;
  var source = document.getElementById('market-togo');
  var dest = document.getElementById('market-grill');

  // Builds the "To Grill & Stay" tab as a copy of "To Go" with the grill fee
  // added. Called once at load and again whenever manager-added market items
  // are loaded, so the two tabs always list the same fish.
  function buildGrillTab(){
    if (!source || !dest) return;
    Array.prototype.slice.call(dest.querySelectorAll('[data-grill-clone]')).forEach(function(el){ el.remove(); });
    Array.prototype.forEach.call(source.children, function(child){
      var clone = window.rimalCopyNode(child);
      clone.setAttribute('data-grill-clone', '1');
      if (clone.querySelectorAll) {
        clone.querySelectorAll('[id]').forEach(function(n){ n.id = 'grill-' + n.id; });
        clone.querySelectorAll('label[for]').forEach(function(n){ n.htmlFor = 'grill-' + n.htmlFor; });
      }
      if (clone.classList && clone.classList.contains('market-grid')) {
        Array.prototype.forEach.call(clone.querySelectorAll('.market-card[data-name]'), function(card){
          var origPrice = parseFloat(card.getAttribute('data-price'));
          var unit = card.getAttribute('data-unit') || '';
          var newPrice = origPrice + GRILL_FEE;
          card.setAttribute('data-price', newPrice.toFixed(2));
          var priceEl = card.querySelector('.menu-price');
          if (priceEl) {
            priceEl.innerHTML = window.rimalMoney(newPrice) + (unit ? '/' + unit.replace(/[&<>"']/g, '') : '') +
              '<span class="grill-note">incl. $' + GRILL_FEE.toFixed(2) + ' grill &amp; dine-in fee</span>';
          }
          Array.prototype.forEach.call(card.querySelectorAll('.size-select option'), function(opt){
            var p = parseFloat(opt.getAttribute('data-price')) + GRILL_FEE;
            opt.setAttribute('data-price', p.toFixed(2));
            opt.textContent = opt.value + ' — $' + p.toFixed(2);
          });
          var qtyRow = card.querySelector('.qty-row');
          if (qtyRow) {
            var sel = document.createElement('select');
            sel.className = 'side-select-fixed';
            sel.setAttribute('aria-label', 'How should we cook the ' + card.getAttribute('data-name') + '?');
            ['Grilled','Fried','Sautéed','Middle Eastern Style'].forEach(function(style){
              var opt = document.createElement('option');
              opt.textContent = style;
              sel.appendChild(opt);
            });
            qtyRow.parentNode.insertBefore(sel, qtyRow);
          }
        });
      }
      dest.appendChild(clone);
    });
  }
  window.rimalBuildGrillTab = buildGrillTab;
  buildGrillTab();

  var marketTabs = document.querySelectorAll('.market-tab-btn');
  marketTabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      var groupId = tab.getAttribute('data-market-group');
      marketTabs.forEach(function(t){ t.classList.toggle('active', t === tab); });
      document.querySelectorAll('.market-tab-group').forEach(function(g){
        g.classList.toggle('active', g.id === 'market-' + groupId);
      });
    });
  });
})();

(function(){
  var input = document.getElementById('marketSearchInput');
  var status = document.getElementById('marketSearchStatus');
  var tabsRow = document.getElementById('marketTabsRow');
  if (!input) return;

  input.addEventListener('input', function(){
    var term = input.value.trim().toLowerCase();
    var grids = document.querySelectorAll('#page-market .market-grid');

    if (!term) {
      tabsRow.hidden = false;
      status.hidden = true;
      document.querySelectorAll('#page-market .market-card').forEach(function(c){ c.classList.remove('search-hide'); });
      grids.forEach(function(grid){
        grid.classList.remove('search-hide');
        var heading = grid.previousElementSibling;
        if (heading && /^H[1-6]$/.test(heading.tagName)) { heading.classList.remove('search-hide'); }
      });
      return;
    }

    tabsRow.hidden = true;
    var visibleCount = 0;
    grids.forEach(function(grid){
      var gridHasMatch = false;
      grid.querySelectorAll('.market-card').forEach(function(card){
        var match = card.textContent.toLowerCase().indexOf(term) !== -1;
        card.classList.toggle('search-hide', !match);
        if (match) { visibleCount++; gridHasMatch = true; }
      });
      grid.classList.toggle('search-hide', !gridHasMatch);
      var heading = grid.previousElementSibling;
      if (heading && /^H[1-6]$/.test(heading.tagName)) { heading.classList.toggle('search-hide', !gridHasMatch); }
    });

    status.hidden = false;
    status.textContent = visibleCount === 0
      ? 'No fish market items match "' + input.value.trim() + '".'
      : visibleCount + ' item' + (visibleCount === 1 ? '' : 's') + ' found for "' + input.value.trim() + '".';
  });
})();

(function(){
  // Menu page: renders RIMAL_MENU (menu-data.js) into cards, plus live search
  // and category chips that jump to each section and follow the scroll. Cards keep the classes and data-* attributes the
  // cart and the Manager's menu tools rely on (.menu-item[data-name][data-price],
  // h4, .menu-item-info p, img, .menu-price, #group-<id> .menu-grid).
  var MENU = window.RIMAL_MENU || [];
  var catalog = document.getElementById('menuCatalog');
  if (!catalog) return;
  var chipsEl = document.getElementById('menuChips');
  var input = document.getElementById('menuSearchInput');
  var clearBtn = document.getElementById('menuSearchClear');
  var statusEl = document.getElementById('menuStatus');
  var emptyEl = document.getElementById('menuEmpty');
  var emptyTerm = document.getElementById('menuEmptyTerm');
  var emptyClear = document.getElementById('menuEmptyClear');
  var money = window.rimalMoney;
  var current = '';       // section the chips highlight
  var spyLocked = false;  // true while a chip click scrolls the page

  var itemsById = {};
  MENU.forEach(function(cat){ cat.items.forEach(function(it){ it.category = cat.id; itemsById[it.id] = it; }); });

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function needsOptions(item){ return !!(item && ((item.choices && item.choices.length) || item.sides)); }

  // One card markup for built-in items and Manager-added items.
  //   item: { id | customId, name, price, desc, photo | imageUrl, sizes:[{label, price}] }
  function cardHtml(item){
    var img = item.imageUrl || (item.photo ? window.rimalPhotoUrl(item.photo, 320) : '');
    var sizes = (item.sizes || []).filter(function(o){ return o && o.label && isFinite(Number(o.price)); });
    var base = sizes.length ? Number(sizes[0].price) : Number(item.price);
    var idAttr = item.customId ? 'data-custom-item="' + esc(item.customId) + '"' : 'data-item-id="' + esc(item.id) + '"';
    var builtinAttr = item.customId ? '' : ' data-builtin';
    var sizeHtml = sizes.length
      ? '<select class="size-select" tabindex="-1" aria-hidden="true">' + sizes.map(function(o, i){
          return '<option value="' + esc(o.label) + '" data-price="' + Number(o.price) + '"' + builtinAttr + (i === 0 ? ' selected' : '') + '>' + esc(o.label) + ' — ' + money(o.price) + '</option>';
        }).join('') + '</select>'
      : '';
    return '<article class="menu-item" ' + idAttr + ' data-name="' + esc(item.name) + '" data-price="' + base + '" data-unit="">' +
      (img ? '<img class="menu-item-img" src="' + esc(img) + '" alt="" width="320" height="240" loading="lazy" decoding="async">' : '') +
      '<div class="mi-placeholder" aria-hidden="true"></div>' +
      '<div class="menu-item-info">' +
        '<h4>' + esc(item.name) + '</h4>' +
        '<div class="menu-price">' + money(base) + '</div>' +
        (item.desc ? '<p>' + esc(item.desc) + '</p>' : '') +
        sizeHtml +
        '<div class="item-actions"><span class="mi-meta"></span>' +
          '<button type="button" class="btn btn-solid mi-add" data-menu-add>Add</button></div>' +
      '</div></article>';
  }

  // Built-in data for a card, but only while the card is still that dish. When the
  // Manager renames a dish it becomes a different dish, so the original's choices,
  // sides, sizes and stock photo no longer apply.
  function builtinFor(card){
    var item = itemsById[card.getAttribute('data-item-id')];
    return item && card.getAttribute('data-name') === item.name ? item : null;
  }
  function cardSizes(card){
    var opts = Array.prototype.slice.call(card.querySelectorAll('.size-select option'));
    var renamed = card.hasAttribute('data-item-id') && !builtinFor(card);
    if (renamed && opts.length && opts.every(function(o){ return o.hasAttribute('data-builtin'); })) { return []; }
    return opts.map(function(o){ return { label: o.value, price: parseFloat(o.getAttribute('data-price')) }; });
  }

  // Arabic section titles beside the English, as on the logo. Decorative, so hidden from screen readers.
  var AR = { lunch: 'وجبات الغداء', mains: 'الأطباق الرئيسية', 'catch': 'صيد البحر', sides: 'أطباق جانبية وسلطات', specials: 'أطباق مميزة', drinks: 'المشروبات', desserts: 'الحلويات' };

  catalog.innerHTML = MENU.map(function(cat){
    return '<section class="menu-group" id="group-' + esc(cat.id) + '" aria-labelledby="gh-' + esc(cat.id) + '">' +
      '<div class="menu-group-head"><div class="menu-group-title"><h2 id="gh-' + esc(cat.id) + '">' + esc(cat.label) + '</h2>' +
      (AR[cat.id] ? '<span class="ar" lang="ar" dir="rtl" aria-hidden="true">' + AR[cat.id] + '</span>' : '') + '</div>' +
      (cat.note ? '<p>' + esc(cat.note) + '</p>' : '') + '</div>' +
      '<div class="menu-grid">' + cat.items.map(function(it){ return cardHtml(it); }).join('') + '</div></section>';
  }).join('');

  var groups = Array.prototype.slice.call(catalog.querySelectorAll('.menu-group'));
  function cardsOf(group){ return Array.prototype.slice.call(group.querySelectorAll('.menu-item[data-name]')); }

  function cardNeedsDialog(card){
    return needsOptions(builtinFor(card)) || cardSizes(card).length > 1;
  }

  // Keeps buttons, prices and chips in step with the cards on the page
  // (Manager edits can rename, re-price, remove or add cards after load).
  function syncCards(){
    catalog.querySelectorAll('.menu-item[data-name]').forEach(function(card){
      var name = card.getAttribute('data-name');
      var btn = card.querySelector('[data-menu-add]');
      var meta = card.querySelector('.mi-meta');
      var item = builtinFor(card);
      var dialog = cardNeedsDialog(card);
      var sizes = cardSizes(card);
      var orig = itemsById[card.getAttribute('data-item-id')];
      var img = card.querySelector('img.menu-item-img');
      if (img) { img.classList.toggle('is-stale', !!(orig && !item && orig.photo && img.getAttribute('src') === window.rimalPhotoUrl(orig.photo, 320))); }
      if (btn) {
        btn.textContent = dialog ? 'Choose options' : 'Add';
        btn.setAttribute('aria-label', dialog ? 'Choose options for ' + name : 'Add ' + name + ' to your order');
      }
      if (meta) { meta.textContent = item && item.sides ? 'Includes ' + item.sides + ' sides' : (sizes.length === 1 ? sizes[0].label : ''); }
      var priceEl = card.querySelector('.menu-price');
      if (priceEl && sizes.length > 1) {
        var min = Math.min.apply(null, sizes.map(function(s){ return s.price; }));
        var max = Math.max.apply(null, sizes.map(function(s){ return s.price; }));
        priceEl.textContent = (min === max ? '' : 'From ') + money(min);
      } else if (priceEl) {
        priceEl.textContent = money(sizes.length === 1 ? sizes[0].price : card.getAttribute('data-price'));
      }
    });
  }

  function buildChips(){
    var available = groups.filter(function(g){ return cardsOf(g).length > 0; });
    chipsEl.innerHTML = available.map(function(g){
      var id = g.id.replace('group-', '');
      return '<button type="button" class="chip" data-chip="' + esc(id) + '" aria-controls="' + esc(g.id) + '">' + esc(g.querySelector('h2').textContent) + '</button>';
    }).join('');
    setCurrent(current, true);
  }

  function normalize(s){ return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim(); }

  function applyFilter(){
    var raw = input.value.trim();
    var term = normalize(raw);
    var shown = 0;
    groups.forEach(function(g){
      var cards = cardsOf(g);
      var inScope = cards.length > 0;
      var groupShown = 0;
      cards.forEach(function(card){
        var desc = card.querySelector('.menu-item-info p');
        var hay = normalize(card.getAttribute('data-name') + ' ' + (desc ? desc.textContent : ''));
        var match = inScope && (!term || hay.indexOf(term) !== -1);
        card.hidden = !match;
        if (match) { groupShown++; }
      });
      g.hidden = groupShown === 0;
      shown += groupShown;
    });
    clearBtn.hidden = !raw;
    emptyEl.hidden = !(term && shown === 0);
    emptyTerm.textContent = raw;
    statusEl.textContent = term
      ? (shown ? shown + (shown === 1 ? ' dish matches' : ' dishes match') + ' “' + raw + '”' : 'No dishes match “' + raw + '”')
      : '';
  }

  // Highlights the chip of the section being read and keeps it in view in the
  // chip strip (which scrolls sideways on phones).
  function setCurrent(id, force){
    if (id === current && !force) return;
    current = id;
    var chip = null;
    chipsEl.querySelectorAll('[data-chip]').forEach(function(c){
      var on = c.getAttribute('data-chip') === id;
      if (on) { c.setAttribute('aria-current', 'true'); chip = c; } else { c.removeAttribute('aria-current'); }
    });
    if (chip && chipsEl.scrollWidth > chipsEl.clientWidth) {
      var left = chip.offsetLeft - (chipsEl.clientWidth - chip.offsetWidth) / 2;
      chipsEl.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }
  function reducedMotion(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  // Bottom edge of the header plus whatever menu bar is stuck under it.
  function stuckBottom(){
    var header = document.querySelector('.site-header');
    var toolbar = document.querySelector('.menu-toolbar');
    // On tablets and phones the toolbar is display:contents and only the chips stick.
    var bar = toolbar && getComputedStyle(toolbar).display !== 'contents' ? toolbar : chipsEl;
    return (header ? header.offsetHeight : 0) + bar.offsetHeight;
  }

  function spy(){
    if (spyLocked || window.rimalCurrentPage() !== 'menu') return;
    var line = stuckBottom() + 24;
    var visible = groups.filter(function(g){ return !g.hidden; });
    if (!visible.length) return;
    var id = visible[0].id;
    var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    visible.forEach(function(g){ if (g.getBoundingClientRect().top <= line) { id = g.id; } });
    if (atBottom) { id = visible[visible.length - 1].id; }
    setCurrent(id.replace('group-', ''));
  }
  var spyQueued = false;
  window.addEventListener('scroll', function(){
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function(){ spyQueued = false; spy(); });
  }, { passive: true });

  function jumpTo(id){
    var group = document.getElementById('group-' + id);
    if (!group) return;
    var top = group.getBoundingClientRect().top + window.scrollY - stuckBottom() + 1;
    setCurrent(id);
    spyLocked = true;
    var unlock = function(){ spyLocked = false; window.removeEventListener('scrollend', unlock); };
    window.addEventListener('scrollend', unlock);
    setTimeout(unlock, 1200);
    window.scrollTo({ top: top, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  chipsEl.addEventListener('click', function(e){
    var chip = e.target.closest('[data-chip]');
    if (!chip) return;
    if (input.value) { input.value = ''; applyFilter(); }
    jumpTo(chip.getAttribute('data-chip'));
  });

  input.addEventListener('input', function(){
    applyFilter();
    spy();
  });
  input.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && input.value) { e.preventDefault(); clearSearch(); }
  });
  function clearSearch(){ input.value = ''; applyFilter(); spy(); input.focus(); }
  clearBtn.addEventListener('click', clearSearch);
  emptyClear.addEventListener('click', clearSearch);

  function refresh(){
    syncCards();
    buildChips();
    applyFilter();
    spy();
    document.dispatchEvent(new CustomEvent('rimal:menu'));
  }
  document.addEventListener('rimal:page', function(e){ if (e.detail.id === 'menu') { spy(); } });

  window.rimalMenu = {
    itemsById: itemsById,
    needsOptions: needsOptions,
    cardNeedsDialog: cardNeedsDialog,
    builtinFor: builtinFor,
    cardSizes: cardSizes,
    cardHtml: cardHtml,
    refresh: refresh
  };
  refresh();
})();

(function(){
  // Home page: a short printed-menu preview read from the live menu cards,
  // so it always shows the Manager's current names and prices.
  var box = document.getElementById('homeMenuPreview');
  if (!box) return;
  var PICK = ['mains', 'lunch'];
  var PER_GROUP = 5;
  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function render(){
    box.innerHTML = PICK.map(function(id){
      var group = document.getElementById('group-' + id);
      if (!group) return '';
      var cards = Array.prototype.slice.call(group.querySelectorAll('.menu-item[data-name]')).slice(0, PER_GROUP);
      if (!cards.length) return '';
      var ar = group.querySelector('.menu-group-head .ar');
      var note = group.querySelector('.menu-group-head > p');
      return '<div><div class="hm-head"><h3>' + esc(group.querySelector('h2').textContent) + '</h3>' +
        (ar ? '<span class="ar" lang="ar" dir="rtl" aria-hidden="true">' + esc(ar.textContent) + '</span>' : '') + '</div>' +
        (note ? '<p class="hm-note">' + esc(note.textContent) + '</p>' : '') +
        '<ul class="hm-list">' + cards.map(function(card){
          var name = card.querySelector('h4');
          var price = card.querySelector('.menu-price');
          return '<li class="hm-item"><b>' + esc(name ? name.textContent : card.getAttribute('data-name')) + '</b><i aria-hidden="true"></i>' +
            '<span>' + esc(price ? price.textContent : '') + '</span></li>';
        }).join('') + '</ul></div>';
    }).join('');
  }
  document.addEventListener('rimal:menu', render);
  render();
})();

(function(){
  // ---------------------------------------------------------------
  // Cart, item-options dialog and order submission.
  // A cart line is { v, ref, base, choices, sides, size, name, price, unit, qty, taxable }.
  // "name" keeps the format the kitchen dashboard and receipts already use,
  // e.g. "Mixed Shrimp & Calamari (Fried) w/ Saiadia Rice & Plain Rice".
  // ---------------------------------------------------------------
  var CART_KEY = 'rimalSeafoodCart';
  var CART_VERSION = 2;
  var TABLE_KEY = 'rimalSelectedTable';
  var INFO = window.RIMAL_INFO || {};
  var NYC_TAX_RATE = INFO.taxRate || 0.08875;
  var SIDES = window.RIMAL_SIDES || [];
  var money = window.rimalMoney;
  var rewardDiscount = 0;
  var notice = '';
  var lastCount = 0;
  var menuReady = false;

  var cart = [];
  (function load(){
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch(e){ saved = []; }
    if (!Array.isArray(saved)) saved = [];
    cart = saved.filter(function(l){ return l && l.v === CART_VERSION && l.ref && isFinite(l.price) && l.qty > 0; });
    if (saved.length > cart.length) {
      notice = 'Our menu and prices were updated, so items saved from an earlier visit were removed. Please add them again.';
    }
  })();

  var $ = function(id){ return document.getElementById(id); };
  var cartToggle = $('cartToggle'), cartDrawer = $('cartDrawer'), cartClose = $('cartClose');
  var cartItemsEl = $('cartItems'), cartEmpty = $('cartEmpty'), cartFooter = $('cartFooter'), cartMain = $('cartMain');
  var cartSubtotalEl = $('cartSubtotal'), cartTaxEl = $('cartTax'), cartTotalEl = $('cartTotal'), cartTaxNote = $('cartTaxNote');
  var cartDiscountRow = $('cartDiscountRow'), cartDiscountEl = $('cartDiscount');
  var cartBadge = $('cartBadge'), cartCount = $('cartCount'), cartTableBanner = $('cartTableBanner'), cartNotice = $('cartNotice');
  var cartBar = $('cartBar'), cartBarBtn = $('cartBarBtn'), cartBarLabel = $('cartBarLabel'), cartBarTotal = $('cartBarTotal');
  var orderForm = $('orderForm'), orderNameInput = $('orderNameInput'), orderPhoneInput = $('orderPhoneInput');
  var orderTableSelect = $('orderTableSelect'), orderError = $('orderError'), placeOrderBtn = $('placeOrderBtn');
  var cartConfirm = $('cartConfirm'), cartConfirmDetail = $('cartConfirmDetail'), cartConfirmClose = $('cartConfirmClose');
  var toastEl = $('toast');

  // Delivery (not offered yet: the page has no delivery controls and the
  // geocode Netlify function is not deployed). Kept for when it is set up.
  var RESTAURANT_LAT = 40.6270505;
  var RESTAURANT_LON = -74.0239395;
  var DELIVERY_RATE_PER_2MI = 5;
  var fulfillType = 'pickup';
  var deliveryFeeAmount = 0;
  var deliveryDistanceMiles = null;
  var deliveryFeeReady = false;
  var deliveryFeeChecking = false;
  var fulfillPickupBtn = document.getElementById('fulfillPickupBtn');
  var fulfillDeliveryBtn = document.getElementById('fulfillDeliveryBtn');
  var menuFulfillPickupBtn = document.getElementById('menuFulfillPickupBtn');
  var menuFulfillDeliveryBtn = document.getElementById('menuFulfillDeliveryBtn');
  var pickupLocationNote = document.getElementById('pickupLocationNote');
  var deliveryAddressInput = document.getElementById('deliveryAddressInput');
  var deliveryFeeStatus = document.getElementById('deliveryFeeStatus');
  var cartDeliveryFeeRow = document.getElementById('cartDeliveryFeeRow');
  var cartDeliveryFeeEl = document.getElementById('cartDeliveryFee');
  var cartDeliveryDistanceEl = document.getElementById('cartDeliveryDistance');

  function haversineMiles(lat1, lon1, lat2, lon2){
    var R = 3958.8;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function resetDeliveryFee(){
    deliveryFeeAmount = 0;
    deliveryDistanceMiles = null;
    deliveryFeeReady = false;
    if (cartDeliveryDistanceEl) cartDeliveryDistanceEl.textContent = '';
    if (deliveryFeeStatus) deliveryFeeStatus.hidden = true;
  }

  function calculateDeliveryFee(){
    var address = deliveryAddressInput ? deliveryAddressInput.value.trim() : '';
    resetDeliveryFee();
    render();
    if (!address) return;
    deliveryFeeChecking = true;
    if (deliveryFeeStatus) {
      deliveryFeeStatus.hidden = false;
      deliveryFeeStatus.textContent = 'Checking delivery distance…';
    }
    fetch('/.netlify/functions/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: address })
    }).then(function(resp){ return resp.json(); }).then(function(data){
      deliveryFeeChecking = false;
      if (!data || data.error || typeof data.lat !== 'number') {
        if (deliveryFeeStatus) {
          deliveryFeeStatus.hidden = false;
          deliveryFeeStatus.textContent = (data && data.error) ? data.error : "Couldn't find that address — please double-check it.";
        }
        return;
      }
      var miles = haversineMiles(RESTAURANT_LAT, RESTAURANT_LON, data.lat, data.lon);
      var fee = DELIVERY_RATE_PER_2MI * Math.max(1, Math.ceil(miles / 2));
      deliveryDistanceMiles = miles;
      deliveryFeeAmount = fee;
      deliveryFeeReady = true;
      if (deliveryFeeStatus) {
        deliveryFeeStatus.hidden = false;
        deliveryFeeStatus.textContent = miles.toFixed(1) + ' miles from Rimal Seafood — delivery fee ' + money(fee) + '.';
      }
      if (cartDeliveryDistanceEl) cartDeliveryDistanceEl.textContent = '(' + miles.toFixed(1) + ' mi)';
      render();
    }).catch(function(){
      deliveryFeeChecking = false;
      if (deliveryFeeStatus) {
        deliveryFeeStatus.hidden = false;
        deliveryFeeStatus.textContent = 'Could not check that address right now — please try again.';
      }
    });
  }

  if (deliveryAddressInput) {
    deliveryAddressInput.addEventListener('blur', calculateDeliveryFee);
    deliveryAddressInput.addEventListener('input', function(){
      if (deliveryFeeReady) { resetDeliveryFee(); render(); }
    });
  }

  function setFulfillType(type){
    fulfillType = type;
    if (fulfillPickupBtn) fulfillPickupBtn.classList.toggle('active', type === 'pickup');
    if (fulfillDeliveryBtn) fulfillDeliveryBtn.classList.toggle('active', type === 'delivery');
    if (menuFulfillPickupBtn) menuFulfillPickupBtn.classList.toggle('active', type === 'pickup');
    if (menuFulfillDeliveryBtn) menuFulfillDeliveryBtn.classList.toggle('active', type === 'delivery');
    if (deliveryAddressInput) deliveryAddressInput.hidden = (type !== 'delivery');
    if (pickupLocationNote) pickupLocationNote.hidden = (type !== 'pickup');
    if (cartDeliveryFeeRow) cartDeliveryFeeRow.hidden = (type !== 'delivery');
    if (type !== 'delivery') { resetDeliveryFee(); }
    render();
  }
  if (fulfillPickupBtn) fulfillPickupBtn.addEventListener('click', function(){ setFulfillType('pickup'); });
  if (fulfillDeliveryBtn) fulfillDeliveryBtn.addEventListener('click', function(){ setFulfillType('delivery'); });
  if (menuFulfillPickupBtn) menuFulfillPickupBtn.addEventListener('click', function(){ setFulfillType('pickup'); });
  if (menuFulfillDeliveryBtn) menuFulfillDeliveryBtn.addEventListener('click', function(){ setFulfillType('delivery'); });

  for (var t = 1; t <= 20; t++) {
    var topt = document.createElement('option');
    topt.value = String(t);
    topt.textContent = 'Dining in — Table ' + t;
    orderTableSelect.appendChild(topt);
  }

  function save(){ try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch(e){} }
  function getTable(){ try { return localStorage.getItem(TABLE_KEY) || ''; } catch(e){ return ''; } }
  function setTable(v){ try { if (v) { localStorage.setItem(TABLE_KEY, v); } else { localStorage.removeItem(TABLE_KEY); } } catch(e){} }
  function el(tag, cls, text){ var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function round2(n){ return Math.round(n * 100) / 100; }
  function isWeighed(line){ return line.unit === 'lb'; }
  function stepFor(line){ return isWeighed(line) ? 0.5 : 1; }
  function qtyLabel(line){ return isWeighed(line) ? line.qty + ' lb' : String(line.qty); }

  // Stock is fetched when the page loads and each time the Fish Market opens;
  // cards re-rendered in between reuse the last result.
  var lastInventory = null;
  function paintInventory(){
    var inv = lastInventory;
    if (!inv) return;
    document.querySelectorAll('#page-market .market-card[data-name]').forEach(function(card){
      var name = card.getAttribute('data-name');
      var stock = inv.hasOwnProperty(name) ? inv[name] : null;
      var isSoldOut = stock !== null && stock <= 0;
      card.classList.toggle('sold-out', isSoldOut);
      var badge = card.querySelector('.sold-out-badge');
      if (isSoldOut && !badge) {
        badge = document.createElement('span');
        badge.className = 'sold-out-badge';
        badge.textContent = 'Sold Out';
        card.appendChild(badge);
      } else if (!isSoldOut && badge) {
        badge.remove();
      }
    });
  }
  function applyInventory(){
    if (!window.rimalDb) return;
    window.rimalDb.from('inventory').select('*').then(function(res){
      lastInventory = {};
      (res.data || []).forEach(function(row){ lastInventory[row.item_name] = Number(row.stock); });
      paintInventory();
    }).catch(function(){});
  }
  window.rimalApplyInventory = applyInventory;
  window.rimalPaintInventory = paintInventory;
  applyInventory();

  // ---------- line helpers ----------
  function composeName(base, choices, sides, size, style){
    var name = base;
    Object.keys(choices || {}).forEach(function(k){ name += ' (' + choices[k] + ')'; });
    if (style) { name += ', ' + style; }
    if (sides && sides.length) { name += ' w/ ' + sides.join(' & '); }
    if (size) { name += ' (' + size + ')'; }
    return name;
  }
  function metaText(line){
    var parts = [];
    Object.keys(line.choices || {}).forEach(function(k){ parts.push(line.choices[k]); });
    if (line.style) { parts.push(line.style); }
    if (line.size) { parts.push(line.size); }
    if (line.sides && line.sides.length) { parts.push('Sides: ' + line.sides.join(', ')); }
    return parts.join(' · ');
  }
  function cssEsc(s){ return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }
  function findCard(ref){
    if (!ref) return null;
    if (ref.kind === 'menu') {
      return document.querySelector(ref.custom
        ? '#page-menu .menu-item[data-custom-item="' + cssEsc(ref.id) + '"]'
        : '#page-menu .menu-item[data-item-id="' + cssEsc(ref.id) + '"]');
    }
    var scope = ref.kind === 'grill' ? '#market-grill' : '#market-togo';
    return document.querySelector(scope + ' .market-card[data-name="' + cssEsc(ref.name) + '"]');
  }
  function priceFromCard(card, size){
    if (card.classList.contains('menu-item') && window.rimalMenu) {
      var sizes = window.rimalMenu.cardSizes(card);
      if (size) { var hit = sizes.filter(function(s){ return s.label === size; })[0]; return hit ? hit.price : NaN; }
      return sizes.length === 1 ? sizes[0].price : (sizes.length > 1 ? NaN : parseFloat(card.getAttribute('data-price')));
    }
    if (size) {
      var opt = Array.prototype.find.call(card.querySelectorAll('.size-select option'), function(o){ return o.value === size; });
      return opt ? parseFloat(opt.getAttribute('data-price')) : NaN;
    }
    return parseFloat(card.getAttribute('data-price'));
  }
  function totals(){
    var subtotal = cart.reduce(function(s, i){ return s + i.price * i.qty; }, 0);
    var taxable = cart.reduce(function(s, i){ return s + (i.taxable !== false ? i.price * i.qty : 0); }, 0);
    var discount = Math.min(rewardDiscount, subtotal);
    var tax = Math.max(0, taxable - discount) * NYC_TAX_RATE;
    return { subtotal: subtotal, discount: discount, tax: tax, total: subtotal - discount + tax };
  }
  function itemCount(){ return cart.reduce(function(n, l){ return n + (isWeighed(l) ? 1 : l.qty); }, 0); }

  function addLine(line){
    var same = cart.filter(function(l){ return l.name === line.name && l.price === line.price && l.ref.kind === line.ref.kind; })[0];
    if (same) { same.qty = round2(same.qty + line.qty); } else { cart.push(line); }
    render();
  }

  // Re-checks saved lines against what the page offers right now, so a
  // customer is never charged an old price for something that changed.
  function revalidate(){
    menuReady = true;
    var removed = 0, repriced = 0;
    cart = cart.filter(function(line){
      var card = findCard(line.ref);
      var p = card ? priceFromCard(card, line.size) : NaN;
      if (!card || !isFinite(p)) { removed++; return false; }
      if (Math.abs(p - line.price) > 0.001) { line.price = p; repriced++; }
      if (line.ref.kind === 'menu') {
        var nm = card.getAttribute('data-name');
        if (nm && nm !== line.base) { line.base = nm; line.name = composeName(nm, line.choices, line.sides, line.size); }
      }
      return true;
    });
    if (removed || repriced) {
      notice = (removed ? removed + (removed === 1 ? ' item is' : ' items are') + ' no longer on the menu and ' + (removed === 1 ? 'was' : 'were') + ' removed. ' : '') +
        (repriced ? 'Prices were updated to match the current menu.' : '');
    }
    render();
  }

  // ---------- rendering ----------
  function render(){
    var table = getTable();
    cartTableBanner.hidden = !table;
    cartTableBanner.textContent = table ? 'Dining in — Table ' + table : '';
    orderTableSelect.value = table;
    cartNotice.hidden = !notice;
    cartNotice.textContent = notice;

    cartItemsEl.textContent = '';
    cart.forEach(function(line, idx){
      var li = el('li', 'cart-row');
      var info = el('div');
      info.appendChild(el('div', 'cart-row-name', line.base));
      var meta = metaText(line);
      if (meta) { info.appendChild(el('div', 'cart-row-meta', meta)); }
      info.appendChild(el('div', 'cart-row-meta', money(line.price) + (line.unit ? ' / ' + line.unit : ' each') + (line.taxable === false ? ' · not taxed' : '')));
      li.appendChild(info);
      li.appendChild(el('div', 'cart-row-price', money(line.price * line.qty)));

      var controls = el('div', 'cart-row-controls');
      var stepper = el('div', 'stepper');
      stepper.setAttribute('role', 'group');
      stepper.setAttribute('aria-label', 'Quantity of ' + line.base);
      var minus = el('button'); minus.type = 'button'; minus.setAttribute('data-qty', idx + ':-1');
      minus.setAttribute('aria-label', 'Decrease quantity of ' + line.base); minus.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';
      minus.disabled = line.qty <= stepFor(line);
      var out = el('output', null, qtyLabel(line));
      var plus = el('button'); plus.type = 'button'; plus.setAttribute('data-qty', idx + ':1');
      plus.setAttribute('aria-label', 'Increase quantity of ' + line.base); plus.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
      plus.disabled = line.qty >= 99;
      stepper.appendChild(minus); stepper.appendChild(out); stepper.appendChild(plus);
      controls.appendChild(stepper);
      var card = line.ref.kind === 'menu' ? findCard(line.ref) : null;
      if (card && window.rimalMenu && window.rimalMenu.cardNeedsDialog(card)) {
        var edit = el('button', 'btn-link', 'Edit'); edit.type = 'button'; edit.setAttribute('data-edit', idx);
        edit.setAttribute('aria-label', 'Edit options for ' + line.base);
        controls.appendChild(edit);
      }
      var rm = el('button', 'btn-link cart-row-remove', 'Remove'); rm.type = 'button'; rm.setAttribute('data-remove', idx);
      rm.setAttribute('aria-label', 'Remove ' + line.base);
      controls.appendChild(rm);
      li.appendChild(controls);
      cartItemsEl.appendChild(li);
    });

    var empty = cart.length === 0;
    cartItemsEl.hidden = empty;
    cartFooter.hidden = empty;
    cartEmpty.hidden = !empty;

    var tt = totals();
    cartSubtotalEl.textContent = money(tt.subtotal);
    cartDiscountRow.hidden = !(tt.discount > 0);
    cartDiscountEl.textContent = '-' + money(tt.discount);
    cartTaxEl.textContent = money(tt.tax);
    cartTotalEl.textContent = money(tt.total);
    cartTaxNote.hidden = !cart.some(function(l){ return l.taxable === false; });
    if (!placeOrderBtn.disabled) { placeOrderBtn.textContent = 'Place order · ' + money(tt.total); }

    var count = itemCount();
    var countText = count + (count === 1 ? ' item' : ' items');
    cartBadge.textContent = count;
    cartCount.textContent = countText;
    // The button reads as "Order, 3 items": visible word plus this hidden count.
    document.getElementById('cartToggleCount').textContent = ', ' + countText;
    if (count > lastCount) { cartBadge.classList.remove('bump'); void cartBadge.offsetWidth; cartBadge.classList.add('bump'); }
    lastCount = count;
    cartBarLabel.textContent = 'View order · ' + countText;
    cartBarTotal.textContent = money(tt.total);
    updateCartBar();
    if (empty) { rewardDiscount = 0; }
    save();
  }

  function updateCartBar(){
    var page = window.rimalCurrentPage ? window.rimalCurrentPage() : '';
    var show = cart.length > 0 && (page === 'menu' || page === 'market');
    cartBar.classList.toggle('show', show);
    document.body.classList.toggle('has-cart-bar', show);
  }
  document.addEventListener('rimal:page', updateCartBar);

  // ---------- toast ----------
  var toastTimer = null;
  function toast(message, actionLabel, action){
    toastEl.textContent = '';
    toastEl.appendChild(el('span', null, message));
    if (actionLabel) {
      var b = el('button', null, actionLabel); b.type = 'button';
      b.addEventListener('click', function(){ hideToast(); action(); });
      toastEl.appendChild(b);
    }
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
  }
  function hideToast(){ toastEl.classList.remove('show'); }

  // ---------- drawer ----------
  var cartOpener = null;
  function openCart(){
    fillAccountIntoCart();
    hideToast();
    if (!cartDrawer.open) { cartOpener = document.activeElement; cartDrawer.showModal(); }
  }
  function closeCart(){ if (cartDrawer.open) { cartDrawer.close(); } }
  cartToggle.addEventListener('click', openCart);
  cartBarBtn.addEventListener('click', openCart);
  cartClose.addEventListener('click', closeCart);
  cartDrawer.addEventListener('click', function(e){ if (e.target === cartDrawer) closeCart(); });
  cartDrawer.addEventListener('close', function(){
    if (!cartConfirm.hidden) { cartConfirm.hidden = true; cartMain.hidden = false; }
    if (notice) { notice = ''; render(); }
    var back = cartOpener && document.contains(cartOpener) && cartOpener.offsetParent ? cartOpener : cartToggle;
    cartOpener = null;
    if (back && back !== document.body) { back.focus(); }
  });
  $('cartBrowse').addEventListener('click', function(){ closeCart(); if (window.rimalGoToPage) window.rimalGoToPage('menu'); });

  cartItemsEl.addEventListener('click', function(e){
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-qty')) {
      var parts = b.getAttribute('data-qty').split(':');
      var line = cart[+parts[0]];
      if (!line) return;
      var next = round2(line.qty + Number(parts[1]) * stepFor(line));
      if (next < stepFor(line) || next > 99) return;
      line.qty = next;
      var focusKey = b.getAttribute('data-qty');
      render();
      var again = cartItemsEl.querySelector('[data-qty="' + focusKey + '"]');
      if (again && !again.disabled) { again.focus(); } else { var o = cartItemsEl.querySelectorAll('.cart-row')[+parts[0]]; if (o) o.querySelector('button:not(:disabled)').focus(); }
    } else if (b.hasAttribute('data-remove')) {
      var i = +b.getAttribute('data-remove');
      var removedLine = cart.splice(i, 1)[0];
      render();
      var rows = cartItemsEl.querySelectorAll('.cart-row');
      var target = rows[Math.min(i, rows.length - 1)];
      if (target) { target.querySelector('button').focus(); } else { $('cartBrowse').focus(); }
      if (removedLine) { announce(removedLine.base + ' removed from your order.'); }
    } else if (b.hasAttribute('data-edit')) {
      var ei = +b.getAttribute('data-edit');
      var el2 = cart[ei];
      var card = el2 && findCard(el2.ref);
      if (card) { openItemDialog(card, ei, b); }
    }
  });

  var srStatus = el('div', 'visually-hidden'); srStatus.setAttribute('role', 'status'); document.body.appendChild(srStatus);
  function announce(msg){ srStatus.textContent = ''; setTimeout(function(){ srStatus.textContent = msg; }, 30); }

  orderTableSelect.addEventListener('change', function(){ setTable(orderTableSelect.value); render(); });

  // ---------- item options dialog ----------
  var dlg = $('itemDialog'), dlgForm = $('itemDialogForm'), dlgTitle = $('itemDialogTitle'), dlgPrice = $('itemDialogPrice');
  var dlgBody = $('itemDialogBody'), dlgQty = $('itemQty'), dlgSubmit = $('itemDialogSubmit');
  var dlgState = null;
  var uid = 0;

  function radioGroup(key, label, values, selected, priced){
    var fs = el('fieldset', 'opt-group'); fs.setAttribute('data-key', key);
    var errId = 'err-' + key + '-' + (++uid);
    var lg = el('legend', null, label + ' ');
    lg.appendChild(el('span', 'tag tag-req', 'Required'));
    fs.appendChild(lg);
    var list = el('div', 'opt-list');
    values.forEach(function(v){
      var val = typeof v === 'string' ? v : v.label;
      var lab = el('label', 'opt');
      var r = el('input'); r.type = 'radio'; r.name = key + '-' + uid; r.value = val; r.required = true;
      r.setAttribute('aria-describedby', errId);
      if (selected === val) r.checked = true;
      var span = el('span', null, val);
      if (priced && typeof v !== 'string') { span.appendChild(el('small', null, money(v.price))); }
      lab.appendChild(r); lab.appendChild(span); list.appendChild(lab);
    });
    fs.appendChild(list);
    var err = el('p', 'field-error', 'Please choose one.'); err.id = errId; err.hidden = true;
    fs.appendChild(err);
    return fs;
  }

  function sidesGroup(n, selected){
    var fs = el('fieldset', 'opt-group'); fs.setAttribute('data-key', '__sides');
    var lg = el('legend', null, 'Choose ' + n + ' sides ');
    lg.appendChild(el('span', 'tag', 'Included'));
    fs.appendChild(lg);
    var grid = el('div', 'sides-grid');
    for (var i = 0; i < n; i++) {
      var f = el('div', 'field');
      var sid = 'side-' + (++uid);
      var lab = el('label', null, 'Side ' + (i + 1)); lab.htmlFor = sid;
      var sel = el('select', 'field-select'); sel.id = sid; sel.required = true; sel.setAttribute('data-side', i);
      var ph = el('option', null, 'Select a side'); ph.value = ''; sel.appendChild(ph);
      SIDES.forEach(function(s){ var o = el('option', null, s); o.value = s; sel.appendChild(o); });
      sel.value = (selected && selected[i]) || '';
      var err = el('p', 'field-error', 'Please choose a side.'); err.id = sid + '-err'; err.hidden = true;
      sel.setAttribute('aria-describedby', err.id);
      f.appendChild(lab); f.appendChild(sel); f.appendChild(err);
      grid.appendChild(f);
    }
    fs.appendChild(grid);
    return fs;
  }

  function dialogUnitPrice(){
    if (!dlgState) return 0;
    var size = dlgForm.querySelector('[data-key="__size"] input:checked');
    if (size) { return dlgState.sizes.filter(function(s){ return s.label === size.value; })[0].price; }
    return dlgState.sizes.length === 1 ? dlgState.sizes[0].price : dlgState.base;
  }
  function updateDialogTotal(){
    var total = dialogUnitPrice() * dlgState.qty;
    dlgQty.textContent = dlgState.qty;
    dlgForm.querySelector('[data-step="-1"]').disabled = dlgState.qty <= 1;
    dlgForm.querySelector('[data-step="1"]').disabled = dlgState.qty >= 99;
    dlgSubmit.textContent = (dlgState.editIndex != null ? 'Update order · ' : 'Add to order · ') + money(total);
  }

  function openItemDialog(card, editIndex, opener){
    var item = window.rimalMenu ? window.rimalMenu.builtinFor(card) : null;
    var editing = editIndex != null ? cart[editIndex] : null;
    var sizes = window.rimalMenu ? window.rimalMenu.cardSizes(card) : [];
    dlgState = {
      card: card, item: item, editIndex: editIndex, sizes: sizes,
      name: card.getAttribute('data-name'), base: parseFloat(card.getAttribute('data-price')),
      qty: editing ? editing.qty : 1,
      opener: opener || document.activeElement
    };
    dlgTitle.textContent = dlgState.name;
    var desc = card.querySelector('.menu-item-info p');
    dlgPrice.textContent = (sizes.length > 1 ? 'From ' + money(Math.min.apply(null, sizes.map(function(s){ return s.price; }))) : money(sizes.length === 1 ? sizes[0].price : dlgState.base)) +
      (desc ? ' · ' + desc.textContent : '');
    dlgBody.textContent = '';
    ((item && item.choices) || []).forEach(function(c){
      dlgBody.appendChild(radioGroup(c.key, c.label, c.values, editing && editing.choices ? editing.choices[c.key] : null));
    });
    if (sizes.length > 1) {
      var isSize = sizes.every(function(s){ return /^(small|medium|large|regular)\b/i.test(s.label); });
      dlgBody.appendChild(radioGroup('__size', isSize ? 'Size' : 'Choose one', sizes, editing ? editing.size : null, true));
    }
    if (item && item.sides) { dlgBody.appendChild(sidesGroup(item.sides, editing ? editing.sides : null)); }
    updateDialogTotal();
    if (!dlg.open) { dlg.showModal(); }
    var first = dlgBody.querySelector('input, select');
    if (first) { first.focus(); }
  }

  dlgBody.addEventListener('change', function(e){
    var fs = e.target.closest('.opt-group');
    if (fs) { clearError(fs, e.target); }
    updateDialogTotal();
  });
  function clearError(fs, control){
    if (control && control.tagName === 'SELECT') {
      control.removeAttribute('aria-invalid');
      var er = document.getElementById(control.id + '-err'); if (er) er.hidden = true;
      return;
    }
    fs.removeAttribute('data-invalid');
    var e2 = fs.querySelector(':scope > .field-error'); if (e2) e2.hidden = true;
  }
  dlgForm.querySelectorAll('[data-step]').forEach(function(b){
    b.addEventListener('click', function(){
      dlgState.qty = Math.min(99, Math.max(1, dlgState.qty + Number(b.getAttribute('data-step'))));
      updateDialogTotal();
    });
  });
  $('itemDialogClose').addEventListener('click', function(){ dlg.close(); });
  dlg.addEventListener('close', function(){
    var o = dlgState && dlgState.opener;
    if (o && document.contains(o) && o !== document.body && document.activeElement !== o && !cartItemsEl.contains(document.activeElement)) { o.focus(); }
  });
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });

  dlgForm.addEventListener('submit', function(e){
    e.preventDefault();
    var firstInvalid = null;
    var choices = {}, sides = [], size = '';
    dlgBody.querySelectorAll('.opt-group').forEach(function(fs){
      var key = fs.getAttribute('data-key');
      if (key === '__sides') {
        fs.querySelectorAll('select').forEach(function(sel){
          if (!sel.value) {
            sel.setAttribute('aria-invalid', 'true');
            document.getElementById(sel.id + '-err').hidden = false;
            firstInvalid = firstInvalid || sel;
          } else { sides.push(sel.value); }
        });
        return;
      }
      var checked = fs.querySelector('input:checked');
      if (!checked) {
        fs.setAttribute('data-invalid', '');
        fs.querySelector(':scope > .field-error').hidden = false;
        firstInvalid = firstInvalid || fs.querySelector('input');
        return;
      }
      if (key === '__size') { size = checked.value; } else { choices[key] = checked.value; }
    });
    if (firstInvalid) { firstInvalid.focus(); return; }
    if (!size && dlgState.sizes.length === 1) { size = dlgState.sizes[0].label; }

    var card = dlgState.card;
    var custom = card.hasAttribute('data-custom-item');
    var line = {
      v: CART_VERSION,
      ref: { kind: 'menu', id: custom ? card.getAttribute('data-custom-item') : card.getAttribute('data-item-id'), custom: custom },
      base: dlgState.name, choices: choices, sides: sides, size: size,
      name: composeName(dlgState.name, choices, sides, size),
      price: dialogUnitPrice(), unit: '', qty: dlgState.qty, taxable: true
    };
    var editIndex = dlgState.editIndex;
    dlg.close();
    if (editIndex != null) {
      var twin = cart.filter(function(l, i){ return i !== editIndex && l.name === line.name && l.price === line.price; })[0];
      if (twin) { twin.qty = round2(twin.qty + line.qty); cart.splice(editIndex, 1); } else { cart[editIndex] = line; }
      render();
      announce(line.base + ' updated.');
      var rowsAfter = cartItemsEl.querySelectorAll('.cart-row');
      var updatedIdx = cart.map(function(l){ return l.name; }).indexOf(line.name);
      var rowAfter = rowsAfter[updatedIdx];
      if (rowAfter) { (rowAfter.querySelector('[data-edit]') || rowAfter.querySelector('button')).focus(); }
    } else {
      addLine(line);
      confirmAdded(card, line);
    }
  });

  function confirmAdded(card, line){
    var btn = card && card.querySelector('[data-menu-add], [data-add]');
    if (btn && !btn.classList.contains('is-added')) {
      var label = btn.textContent;
      btn.classList.add('is-added');
      btn.textContent = 'Added ✓';
      setTimeout(function(){ btn.classList.remove('is-added'); btn.textContent = label; }, 1500);
    }
    toast((line.qty > 1 && !isWeighed(line) ? line.qty + ' × ' : '') + line.base + ' added to your order', 'View order', openCart);
  }

  // Menu cards: simple dishes add straight away, dishes with choices open the dialog.
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-menu-add]');
    if (!btn) return;
    var card = btn.closest('.menu-item[data-name]');
    if (!card) return;
    if (window.rimalMenu && window.rimalMenu.cardNeedsDialog(card)) { openItemDialog(card, null, btn); return; }
    var custom = card.hasAttribute('data-custom-item');
    var name = card.getAttribute('data-name');
    var one = window.rimalMenu ? window.rimalMenu.cardSizes(card) : [];
    var size = one.length === 1 ? one[0].label : '';
    var line = {
      v: CART_VERSION,
      ref: { kind: 'menu', id: custom ? card.getAttribute('data-custom-item') : card.getAttribute('data-item-id'), custom: custom },
      base: name, choices: {}, sides: [], size: size, name: composeName(name, null, null, size),
      price: size ? one[0].price : parseFloat(card.getAttribute('data-price')), unit: '', qty: 1, taxable: true
    };
    if (!isFinite(line.price)) { toast('Sorry, this item can\'t be ordered online right now.'); return; }
    addLine(line);
    confirmAdded(card, line);
  });

  // Fish Market cards ("To Go" by weight, and "To Grill & Stay").
  function updateSizePrice(sel){
    var card = sel.closest('.market-card[data-name]');
    var priceEl = card && card.querySelector('.menu-price');
    var opt = sel.options[sel.selectedIndex];
    if (!priceEl || !opt) return;
    var unit = card.getAttribute('data-unit') || '';
    var note = priceEl.querySelector('.grill-note');
    priceEl.textContent = money(parseFloat(opt.getAttribute('data-price'))) + (unit ? '/' + unit : '');
    if (note) { priceEl.appendChild(note); }
  }
  document.addEventListener('change', function(e){
    if (e.target.matches && e.target.matches('.market-card .size-select')) { updateSizePrice(e.target); }
  });
  window.rimalInitSizeSelects = function(){ document.querySelectorAll('.market-card .size-select').forEach(updateSizePrice); };
  window.rimalInitSizeSelects();

  document.addEventListener('click', function(e){
    var btn = e.target.closest('.market-card [data-add]');
    if (!btn) return;
    var card = btn.closest('.market-card[data-name]');
    var kind = card.closest('#market-grill') ? 'grill' : 'market';
    var name = card.getAttribute('data-name');
    var styleSel = card.querySelector('.side-select-fixed');
    var sizeSel = card.querySelector('.size-select');
    var size = sizeSel ? sizeSel.value : '';
    var price = priceFromCard(card, size);
    var qtyInput = card.querySelector('.qty-row .qty-input');
    var qty = qtyInput ? parseFloat(qtyInput.value) : 1;
    var min = qtyInput ? parseFloat(qtyInput.min) || 0.5 : 1;
    if (!isFinite(qty) || qty < min || qty > 99) {
      if (qtyInput) { qtyInput.setAttribute('aria-invalid', 'true'); qtyInput.focus(); }
      toast('Please enter a quantity between ' + min + ' and 99.');
      return;
    }
    if (qtyInput) qtyInput.removeAttribute('aria-invalid');
    var unit = card.getAttribute('data-unit') || '';
    var style = styleSel ? styleSel.value : '';
    var line = {
      v: CART_VERSION, ref: { kind: kind, name: name }, base: name, choices: {}, sides: [], size: size, style: style,
      name: composeName(name, null, null, size, style),
      price: price, unit: unit, qty: round2(qty), taxable: kind !== 'market'
    };
    addLine(line);
    confirmAdded(card, line);
  });

  // ---------- ordering ----------
  function fillAccountIntoCart(){
    try {
      var sessionPhone = localStorage.getItem('rimalRewardsSession');
      if (!sessionPhone) return;
      if (orderPhoneInput && !orderPhoneInput.value) { orderPhoneInput.value = sessionPhone; }
      if (orderNameInput && !orderNameInput.value) {
        var pendingName = localStorage.getItem('rimalPendingName');
        if (pendingName) { orderNameInput.value = pendingName; }
      }
    } catch(e){}
  }
  fillAccountIntoCart();

  // The ids of orders placed from this device. An order id is unguessable, so
  // it works as the key to that order's history (get_my_orders).
  function rememberOrder(id){
    try {
      var ids = JSON.parse(localStorage.getItem('rimalMyOrders') || '[]');
      if (!Array.isArray(ids)) { ids = []; }
      ids.unshift(id);
      localStorage.setItem('rimalMyOrders', JSON.stringify(ids.slice(0, 20)));
    } catch(e){}
  }

  function newOrderId(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Sends the order to the shared database (Supabase) so it reaches the
  // Manager Dashboard. Customers may insert orders but not read them back,
  // so the id is generated here instead of being returned by the database.
  function submitOrder(){
    if (cart.length === 0) return Promise.resolve(null);
    if (!window.rimalDb) {
      return Promise.reject(new Error('We couldn\'t reach the kitchen right now.'));
    }
    var table = orderTableSelect.value;
    setTable(table);
    var phone = orderPhoneInput.value.replace(/\D/g, '');
    var custName = orderNameInput.value.trim();
    var tt = totals();
    var id = newOrderId();
    // Fish Market "To Go" items carry their stock name, so the shared stock
    // count goes down when the manager marks the order paid (mark_order_paid).
    var itemsForDb = cart.map(function(i){
      var row = { name: i.name, qty: i.qty, unit: i.unit, price: i.price, taxable: i.taxable !== false };
      if (i.ref.kind === 'market') { row.stock = i.base; }
      return row;
    });

    return window.rimalDb.from('orders').insert({
      id: id,
      customer_name: custName || null,
      phone: phone || null,
      table_number: table || null,
      items: itemsForDb,
      subtotal: round2(tt.subtotal),
      discount: round2(tt.discount),
      tax: round2(tt.tax),
      total: round2(tt.total),
      status: 'Processing'
    }).then(function(res){
      if (res.error) { throw res.error; }
      // Rewards are credited later, when the manager marks the order paid.
      if (phone) { try { localStorage.setItem('rimalRewardsSession', phone); } catch(e){} }
      rememberOrder(id);
      cart = [];
      rewardDiscount = 0;
      render();
      return { id: id, table: table, total: tt.total, hasRewardsPhone: !!phone };
    });
  }

  function setPlacing(on){
    placeOrderBtn.disabled = on;
    placeOrderBtn.setAttribute('aria-busy', String(on));
    if (on) {
      placeOrderBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending your order…';
    } else {
      placeOrderBtn.textContent = 'Place order · ' + money(totals().total);
    }
  }

  orderForm.addEventListener('submit', function(e){
    e.preventDefault();
    if (cart.length === 0 || placeOrderBtn.disabled) return;
    orderError.hidden = true;
    if (!menuReady) {
      orderError.textContent = 'Loading today\'s menu and prices. Please try again in a moment.';
      orderError.hidden = false;
      return;
    }
    var digits = orderPhoneInput.value.replace(/\D/g, '');
    if (orderPhoneInput.value.trim() && (digits.length < 10 || digits.length > 11)) {
      orderPhoneInput.setAttribute('aria-invalid', 'true');
      orderError.textContent = 'Please enter a 10-digit phone number, or leave it blank.';
      orderError.hidden = false;
      orderPhoneInput.focus();
      return;
    }
    orderPhoneInput.removeAttribute('aria-invalid');
    setPlacing(true);
    submitOrder().then(function(order){
      setPlacing(false);
      if (!order) return;
      var detail = order.table
        ? 'Table ' + order.table + ' · total ' + money(order.total) + '. Pay at your table.'
        : 'Total ' + money(order.total) + '. Show this screen at the counter and pay there when you pick up.';
      if (order.hasRewardsPhone) { detail += ' Once it\'s paid, this order counts toward your Rimal Rewards.'; }
      cartConfirmDetail.textContent = detail;
      cartMain.hidden = true;
      cartConfirm.hidden = false;
      cartConfirm.focus();
    }).catch(function(err){
      setPlacing(false);
      // Database errors are technical, so customers get a plain message.
      orderError.textContent = 'We couldn\'t send your order.' +
        ' Your order is still here. Please try again, or call ' + (INFO.phoneDisplay || '(347) 497-4002') + '.';
      orderError.hidden = false;
      placeOrderBtn.focus();
    });
  });
  orderPhoneInput.addEventListener('input', function(){ orderPhoneInput.removeAttribute('aria-invalid'); });

  cartConfirmClose.addEventListener('click', function(){
    cartConfirm.hidden = true;
    cartMain.hidden = false;
    closeCart();
    if (window.rimalGoToPage) { window.rimalGoToPage('menu'); }
  });

  window.rimalCart = {
    render: render,
    revalidate: revalidate,
    addDiscount: function(amount){ rewardDiscount += amount; render(); },
    openCart: openCart,
    count: itemCount,
    isReady: function(){ return menuReady; }
  };

  // With a database, the Manager's changes load a moment later and trigger
  // revalidate() themselves; checking now would wrongly drop renamed dishes.
  if (window.rimalDb) { render(); } else { revalidate(); }
})();

(function(){
  var SESSION_KEY = 'rimalRewardsSession';

  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  function getSession(){ try { return localStorage.getItem(SESSION_KEY) || ''; } catch(e){ return ''; } }
  function setSession(phone){ try { localStorage.setItem(SESSION_KEY, phone); } catch(e){} }
  function clearSession(){ try { localStorage.removeItem(SESSION_KEY); } catch(e){} }
  function normalizePhone(p){ return (p || '').replace(/\D/g, ''); }

  var signedOutEl = document.getElementById('rewardsSignedOut');
  var signedInEl = document.getElementById('rewardsSignedIn');
  var nameInput = document.getElementById('rewardsName');
  var phoneInput = document.getElementById('rewardsPhone');
  var joinBtn = document.getElementById('rewardsJoinBtn');
  var welcomeEl = document.getElementById('rewardsWelcome');
  var phoneDisplayEl = document.getElementById('rewardsPhoneDisplay');
  var rewardBarFill = document.getElementById('rewardBarFill');
  var spendLabelEl = document.getElementById('rewardSpendLabel');
  var availableBox = document.getElementById('rewardsAvailableBox');
  var availableText = document.getElementById('rewardsAvailableText');
  var signOutBtn = document.getElementById('signOutBtn');
  var tableSelect = document.getElementById('tableSelect');
  var PURCHASES_NEEDED = 5;
  var TABLE_KEY = 'rimalSelectedTable';

  for (var t = 1; t <= 20; t++) {
    var opt = document.createElement('option');
    opt.value = t;
    opt.textContent = 'Table ' + t;
    tableSelect.appendChild(opt);
  }
  tableSelect.addEventListener('change', function(){
    try {
      if (tableSelect.value) { localStorage.setItem(TABLE_KEY, tableSelect.value); }
      else { localStorage.removeItem(TABLE_KEY); }
    } catch(e){}
    if (window.rimalCart) { window.rimalCart.render(); }
  });

  // Account data (visits, spend, reward balance) now lives in the shared
  // database, not this browser — so it's the same whether the customer
  // checks it from their phone or you look it up at the register.
  var currentAcct = null;

  function renderAccount(){
    var phone = getSession();
    if (!phone || !window.rimalDb) {
      signedOutEl.hidden = false;
      signedInEl.hidden = true;
      return;
    }
    signedOutEl.hidden = true;
    signedInEl.hidden = false;
    welcomeEl.textContent = 'Looking up your account…';
    phoneDisplayEl.textContent = phone;

    window.rimalDb.rpc('get_rewards', { p_phone: phone }).then(function(res){
      var row = (res.data && res.data[0]) ? res.data[0] : null;
      currentAcct = row || { visits: 0, cycle_purchases: 0, platters_ready: 0 };
      var savedName = '';
      try { savedName = localStorage.getItem('rimalPendingName') || ''; } catch(e){}
      welcomeEl.textContent = row ? ('Welcome back' + (savedName ? ', ' + savedName : '')) : 'No account yet';
      var cyclePurchases = Number(currentAcct.cycle_purchases) || 0;
      var plattersReady = Number(currentAcct.platters_ready) || 0;
      var pct = Math.min(100, (cyclePurchases / PURCHASES_NEEDED) * 100);
      rewardBarFill.style.width = pct + '%';
      spendLabelEl.textContent = row
        ? (cyclePurchases + ' of ' + PURCHASES_NEEDED + ' purchases toward your next free gift platter')
        : 'Place your first order to start earning rewards.';
      if (plattersReady > 0) {
        availableBox.hidden = false;
        availableText.textContent = '🎁 You have ' + plattersReady + (plattersReady === 1 ? ' free gift platter' : ' free gift platters') + ' waiting!';
      } else {
        availableBox.hidden = true;
      }
    }).catch(function(){
      welcomeEl.textContent = 'Could not reach the server — check your connection.';
    });

    try { tableSelect.value = localStorage.getItem(TABLE_KEY) || ''; } catch(e){ tableSelect.value = ''; }

    var historyEl = document.getElementById('myOrderHistory');
    if (historyEl && window.rimalDb) {
      historyEl.innerHTML = '<p class="admin-empty">Loading…</p>';
      var myIds = [];
      try { myIds = JSON.parse(localStorage.getItem('rimalMyOrders') || '[]'); } catch(e){}
      if (!Array.isArray(myIds)) { myIds = []; }
      myIds = myIds.filter(function(x){ return /^[0-9a-f-]{36}$/i.test(x); });
      var lookup = myIds.length
        ? window.rimalDb.rpc('get_my_orders', { p_ids: myIds })
        : Promise.resolve({ data: [] });
      lookup.then(function(res){
        if (res.error) { throw res.error; }
        var myOrders = res.data || [];
        if (myOrders.length === 0) {
          historyEl.innerHTML = '<p class="admin-empty">No orders from this device yet. Orders you place on this device will appear here.</p>';
        } else {
          historyEl.innerHTML = myOrders.map(function(o){
            var itemsSummary = (Array.isArray(o.items) ? o.items : []).filter(function(i){ return i && typeof i === 'object'; })
              .map(function(i){ return i.qty + 'x ' + i.name; }).join(', ');
            return '<div class="admin-row">' +
              '<div class="admin-row-main">' +
                '<div class="admin-row-title">' + esc(new Date(o.created_at).toLocaleDateString()) + '</div>' +
                '<div class="admin-row-meta">' + esc(itemsSummary) + '</div>' +
              '</div>' +
              '<div class="admin-row-value">$' + Number(o.total).toFixed(2) +
                '<div style="font-size:.7rem;color:' + (o.payment_status === 'paid' ? 'var(--gold-light)' : 'var(--text-dim)') + ';">' +
                (o.payment_status === 'paid' ? '✓ Paid' : 'Awaiting payment') + '</div></div>' +
            '</div>';
          }).join('');
        }
      }).catch(function(){
        historyEl.innerHTML = '<p class="admin-empty">Could not load order history.</p>';
      });
    }
  }

  joinBtn.addEventListener('click', function(){
    var name = nameInput.value.trim();
    var phone = normalizePhone(phoneInput.value);
    if (!name || !phone) { alert('Please enter your name and phone number.'); return; }
    setSession(phone);
    try { localStorage.setItem('rimalPendingName', name); } catch(e){}
    renderAccount();
  });

  signOutBtn.addEventListener('click', function(){
    clearSession();
    // Leave nothing personal on a shared device: name, table and this device's order numbers.
    try { ['rimalPendingName', 'rimalMyOrders', TABLE_KEY].forEach(function(k){ localStorage.removeItem(k); }); } catch(e){}
    if (window.rimalCart) { window.rimalCart.render(); }
    renderAccount();
  });

  renderAccount();
})();

(function(){
  // Menu and Fish Market management. Two kinds of change live in the shared
  // database and are applied to this page when it loads:
  //   menu_items      - items the manager ADDED (drawn into the same grids as
  //                     the built-in items, using the same markup)
  //   menu_overrides  - changes to items that are BUILT INTO this page (new
  //                     price/description/photo/options, or removed)
  // Ordering, search and the grill tab treat both kinds identically.
  var CATS = {
    menu_lunch:       { sel: '#group-lunch .menu-grid' },
    menu_mains:       { sel: '#group-mains .menu-grid' },
    menu_sides:       { sel: '#group-sides .menu-grid' },
    menu_salads:      { sel: '#group-sides .menu-grid' },
    menu_specials:    { sel: '#group-specials .menu-grid' },
    menu_drinks:      { sel: '#group-drinks .menu-grid' },
    menu_desserts:    { sel: '#group-desserts .menu-grid' },
    market_fish:      { sel: '#market-togo .market-grid', idx: 0, market: true },
    market_shellfish: { sel: '#market-togo .market-grid', idx: 1, market: true }
  };
  var GROUP_LABELS = {
    'group-lunch': 'Menu — Lunch Special',
    'group-mains': 'Menu — Main Plates',
    'group-catch': 'Menu — Catch Your Plate',
    'group-sides': 'Menu — Sides & Salads',
    'group-specials': 'Menu — Specials',
    'group-drinks': 'Menu — Drinks',
    'group-desserts': 'Menu — Desserts'
  };
  var PHOTO_BUCKET = 'menu-photos';

  var formEl = document.getElementById('newItemForm');
  var listEl = document.getElementById('customItemsList');
  var categoryEl = document.getElementById('newItemCategory');

  var builtIns = [];      // items written into the page: {key, section, card, pristine, marker, removed, touched}
  var overrides = {};     // item_key -> menu_overrides row
  var customItems = [];   // menu_items rows
  var editing = null;     // null (adding) | {kind:'custom', item} | {kind:'builtin', entry}
  var listRows = [];

  function categorySortIndex(cat){
    var order = {
      menu_lunch: 1,
      menu_mains: 2,
      menu_sides: 3,
      menu_salads: 4,
      menu_specials: 5,
      menu_drinks: 6,
      menu_desserts: 7,
      market_fish: 8,
      market_shellfish: 9
    };
    return order[cat] || 999;
  }

  function getCustomDisplayOrder(item){
    return Number(item && item.display_order) || 1000;
  }

  function sortCustomItemsByOrder(a, b){
    var catDelta = categorySortIndex(a.category) - categorySortIndex(b.category);
    if (catDelta !== 0) return catDelta;
    return getCustomDisplayOrder(a) - getCustomDisplayOrder(b) || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  }

  function getNextCustomDisplayOrder(){
    if (!customItems.length) return 1000;
    return Math.max.apply(null, customItems.map(function(item){ return getCustomDisplayOrder(item); })) + 100;
  }

  function reorderCustomItem(itemId, direction){
    if (!window.rimalDb) return Promise.resolve();
    var ordered = customItems.slice().sort(sortCustomItemsByOrder);
    var idx = ordered.findIndex(function(item){ return item.id === itemId; });
    if (idx < 0) return Promise.resolve();
    var target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= ordered.length) return Promise.resolve();

    var swapped = ordered.slice();
    var temp = swapped[idx];
    swapped[idx] = swapped[target];
    swapped[target] = temp;

    swapped.forEach(function(item, index){ item.display_order = (index + 1) * 100; });
    customItems = swapped.slice();

    return Promise.all(swapped.map(function(item){
      return window.rimalDb.from('menu_items').update({ display_order: item.display_order }).eq('id', item.id);
    })).then(function(){
      return reloadAll();
    });
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(p){ return '$' + (Number(p) || 0).toFixed(2); }
  function cleanOptions(list){
    return (Array.isArray(list) ? list : []).filter(function(o){
      return o && o.label && isFinite(Number(o.price));
    });
  }
  function optionsHtml(opts){
    return cleanOptions(opts).map(function(o, i){
      return '<option value="' + esc(o.label) + '" data-price="' + Number(o.price) + '"' + (i === 0 ? ' selected' : '') + '>' +
        esc(o.label) + ' — ' + fmt(o.price) + '</option>';
    }).join('');
  }
  function cloneWithSelects(node){
    var copy = window.rimalCopyNode(node);
    var src = node.querySelectorAll('select'), dst = copy.querySelectorAll('select');
    for (var i = 0; i < src.length; i++) { dst[i].selectedIndex = src[i].selectedIndex; }
    return copy;
  }

  // ---------- Items built into the page ----------
  function sectionOf(card){
    var group = card.closest('.menu-group');
    if (group) { return { id: group.id, label: GROUP_LABELS[group.id] || group.id }; }
    var grids = document.querySelectorAll('#market-togo .market-grid');
    var idx = Array.prototype.indexOf.call(grids, card.closest('.market-grid'));
    return { id: 'market-' + idx, label: idx === 1 ? 'Fresh Market — Shellfish & More' : 'Fresh Market — Fin Fish' };
  }

  function scanBuiltIns(){
    var seen = {};
    document.querySelectorAll('#page-menu .menu-item[data-name], #page-menu .market-card[data-name], #market-togo .market-card[data-name]').forEach(function(card){
      if (card.closest('[data-grill-clone]') || card.hasAttribute('data-custom-item')) return;
      var sec = sectionOf(card);
      var base = sec.id + '|' + card.getAttribute('data-name');
      var key = base, n = 2;
      while (seen[key]) { key = base + '#' + (n++); }
      seen[key] = true;
      builtIns.push({ key: key, section: sec.label, card: card, pristine: cloneWithSelects(card), marker: null, removed: false, touched: false });
    });
  }

  function readCard(card){
    var h4 = card.querySelector('h4');
    var p = card.querySelector('.menu-item-info p, .market-card-body p');
    var img = card.querySelector('img');
    var opts = Array.prototype.map.call(card.querySelectorAll('.size-select option'), function(o){
      return { label: o.value, price: parseFloat(o.getAttribute('data-price')) };
    });
    return {
      name: h4 ? h4.textContent.trim() : (card.getAttribute('data-name') || ''),
      description: p ? p.textContent.trim() : '',
      price: parseFloat(card.getAttribute('data-price')) || 0,
      unit: card.getAttribute('data-unit') || '',
      options: opts,
      image_url: img ? img.getAttribute('src') : ''
    };
  }

  // Applies one override row to a fresh copy of a built-in card.
  function mutateCard(card, ov){
    var isMarket = card.classList.contains('market-card');
    var holder = card.querySelector(isMarket ? '.market-card-body' : '.menu-item-info');
    var h4 = card.querySelector('h4');
    var priceEl = card.querySelector('.menu-price');
    var unit = card.getAttribute('data-unit') || '';

    if (ov.name && h4 && ov.name !== h4.textContent.trim()) {
      h4.textContent = ov.name;
      card.setAttribute('data-name', ov.name);
    }

    if (ov.description != null && holder) {
      var p = holder.querySelector('p');
      if (ov.description === '') {
        if (p) { p.remove(); }
      } else if (p) {
        p.textContent = ov.description;
      } else {
        p = document.createElement('p');
        p.textContent = ov.description;
        if (h4 && h4.parentNode === holder) { h4.after(p); } else { holder.insertBefore(p, holder.firstChild); }
      }
    }

    function setBase(price){
      card.setAttribute('data-price', String(price));
      if (priceEl) { priceEl.textContent = fmt(price) + (unit ? '/' + unit : ''); }
    }
    if (Array.isArray(ov.options)) {
      var sel = card.querySelector('.size-select');
      var opts = cleanOptions(ov.options);
      if (opts.length) {
        if (!sel && holder) {
          sel = document.createElement('select');
          sel.className = 'size-select';
          if (isMarket && priceEl) { priceEl.parentNode.insertBefore(sel, priceEl); } else { holder.appendChild(sel); }
        }
        if (sel) { sel.innerHTML = optionsHtml(opts); }
        setBase(Number(opts[0].price));
      } else {
        if (sel) { sel.remove(); }
        if (ov.price != null) { setBase(Number(ov.price)); }
      }
    } else if (ov.price != null) {
      setBase(Number(ov.price));
    }

    if (ov.image_url != null) {
      var img = card.querySelector('img');
      if (ov.image_url === '') {
        if (img) { img.remove(); }
      } else if (img) {
        img.setAttribute('src', ov.image_url);
      } else {
        img = document.createElement('img');
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
        img.setAttribute('src', ov.image_url);
        img.setAttribute('alt', ov.name || card.getAttribute('data-name') || '');
        if (!isMarket) { img.className = 'menu-item-img'; }
        card.insertBefore(img, card.firstChild);
      }
    }
  }

  function applyOverrides(){
    builtIns.forEach(function(e){
      var ov = overrides[e.key];
      if (!ov && !e.touched) return;
      var next;
      if (ov && ov.removed) {
        next = document.createComment('removed by manager');
      } else {
        next = cloneWithSelects(e.pristine);
        if (ov) { mutateCard(next, ov); }
      }
      var cur = e.marker || e.card;
      if (cur.parentNode) { cur.parentNode.replaceChild(next, cur); }
      if (next.nodeType === 8) { e.marker = next; e.removed = true; }
      else { e.card = next; e.marker = null; e.removed = false; }
      e.touched = !!ov;
    });
  }

  // ---------- Items the manager added ----------
  function buildCardHtml(item){
    var cat = CATS[item.category];
    var opts = cleanOptions(item.options);
    var basePrice = opts.length ? Number(opts[0].price) : Number(item.price);
    var unit = cat.market ? (item.unit || '') : '';
    var img = item.image_url ? esc(item.image_url) : '';
    var sizeHtml = opts.length ? '<select class="size-select">' + optionsHtml(opts) + '</select>' : '';
    var attrs = 'data-custom-item="' + esc(item.id) + '" data-name="' + esc(item.name) + '" data-price="' + basePrice + '" data-unit="' + esc(unit) + '"';
    if (cat.market) {
      var step = unit === 'lb' ? 0.5 : 1;
      return '<div class="market-card" ' + attrs + '>' +
        (img ? '<img src="' + img + '" alt="' + esc(item.name) + '" width="480" height="360" loading="lazy" decoding="async">' : '') +
        '<div class="market-card-body"><h4>' + esc(item.name) + '</h4>' +
        (item.description ? '<p>' + esc(item.description) + '</p>' : '') +
        sizeHtml +
        '<div class="menu-price">' + fmt(basePrice) + (unit ? '/' + esc(unit) : '') + '</div>' +
        '<div class="qty-row"><input type="number" class="qty-input" value="1" min="' + step + '" step="' + step + '">' +
        (unit ? '<span class="qty-unit">' + esc(unit) + '</span>' : '') +
        '<button class="btn btn-solid btn-cart" type="button" data-add>Add</button></div></div></div>';
    }
    return window.rimalMenu.cardHtml({
      customId: item.id, name: item.name, price: basePrice, desc: item.description,
      imageUrl: item.image_url || '', sizes: opts
    });
  }

  function renderPublic(){
    document.querySelectorAll('[data-custom-item]').forEach(function(el){ el.remove(); });
    applyOverrides();
    customItems = customItems.slice().sort(sortCustomItemsByOrder);
    customItems.forEach(function(item){
      var cat = CATS[item.category];
      if (!cat) return;
      var grid = document.querySelectorAll(cat.sel)[cat.idx || 0];
      if (!grid) return;
      var holder = document.createElement('div');
      holder.innerHTML = buildCardHtml(item);
      grid.appendChild(holder.firstElementChild);
    });
    if (window.rimalBuildGrillTab) { window.rimalBuildGrillTab(); }
    if (window.rimalInitSizeSelects) { window.rimalInitSizeSelects(); }
    if (window.rimalPaintInventory) { window.rimalPaintInventory(); }
    if (window.rimalMenu) { window.rimalMenu.refresh(); }
    if (window.rimalCart && window.rimalCart.revalidate) { window.rimalCart.revalidate(); }
  }

  function categoryLabel(key){
    var opt = categoryEl && categoryEl.querySelector('option[value="' + key + '"]');
    return opt ? opt.textContent : key;
  }

  // ---------- Manager list ----------
  function summaryPrice(d){
    var opts = cleanOptions(d.options);
    return opts.length
      ? opts.map(function(o){ return esc(o.label) + ' ' + fmt(o.price); }).join(' · ')
      : fmt(d.price) + (d.unit ? '/' + esc(d.unit) : '');
  }

  function buildRows(){
    listRows = [];
    builtIns.forEach(function(e){
      var d = readCard(e.removed ? e.pristine : e.card);
      listRows.push({ kind: 'builtin', entry: e, data: d, section: e.section, removed: e.removed, edited: !!overrides[e.key] });
    });
    customItems.forEach(function(item){
      listRows.push({ kind: 'custom', item: item, section: categoryLabel(item.category), removed: false, edited: false,
        data: { name: item.name, description: item.description || '', price: item.price, unit: item.unit || '', options: item.options, image_url: item.image_url || '' } });
    });
  }

  function renderAdminList(){
    if (!listEl) return;
    buildRows();
    var searchEl = document.getElementById('itemManageSearch');
    var term = searchEl ? searchEl.value.trim().toLowerCase() : '';
    var orderMap = {};
    customItems.slice().sort(sortCustomItemsByOrder).forEach(function(item, index){
      orderMap[item.id] = index + 1;
    });
    var sections = [], bySection = {};
    listRows.forEach(function(row, i){
      if (term && (row.data.name + ' ' + row.section).toLowerCase().indexOf(term) === -1) return;
      if (!bySection[row.section]) { bySection[row.section] = []; sections.push(row.section); }
      bySection[row.section].push({ row: row, i: i });
    });
    if (sections.length === 0) {
      listEl.innerHTML = '<p class="admin-empty">' + (term ? 'No items match your search.' : 'No items found.') + '</p>';
      return;
    }
    listEl.innerHTML = sections.map(function(sec){
      return '<h5 style="font-size:.72rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-dim);margin:14px 0 2px;">' + esc(sec) + '</h5>' +
        bySection[sec].map(function(x){
          var row = x.row, d = row.data;
          var orderLabel = row.kind === 'custom' && row.item && orderMap[row.item.id] ? ' · Order #' + orderMap[row.item.id] : '';
          var tags = (row.kind === 'custom' ? ' · <b>Added by you</b>' : '') + (row.edited && !row.removed ? ' · <b>Edited</b>' : '') + (row.removed ? ' · <b style="color:#a8433a;">Removed</b>' : '');
          return '<div class="admin-row"' + (row.removed ? ' style="opacity:.6;"' : '') + '>' +
            (d.image_url ? '<img class="custom-item-thumb" src="' + esc(d.image_url) + '" alt="" loading="lazy" decoding="async">' : '') +
            '<div class="admin-row-main"><div class="admin-row-title">' + esc(d.name) + '</div>' +
            '<div class="admin-row-meta">' + summaryPrice(d) + orderLabel + tags + '</div></div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">' +
            (row.kind === 'custom' && !row.removed ?
              '<button class="btn status-toggle-btn" type="button" data-item-order="up" data-item-id="' + row.item.id + '">↑</button>' +
              '<button class="btn status-toggle-btn" type="button" data-item-order="down" data-item-id="' + row.item.id + '">↓</button>' : '') +
            (row.removed
              ? '<button class="btn status-toggle-btn" type="button" data-item-act="restore" data-i="' + x.i + '">Restore</button>'
              : '<button class="btn status-toggle-btn" type="button" data-item-act="edit" data-i="' + x.i + '">Edit</button>' +
                '<button class="btn status-toggle-btn" type="button" data-item-act="remove" data-i="' + x.i + '" style="color:#a8433a;border-color:#a8433a;">Remove</button>') +
            '</div></div>';
        }).join('');
    }).join('');
  }

  // ---------- Loading ----------
  function load(){
    if (!window.rimalDb) return Promise.resolve();
    // Items are sorted in the browser (sortCustomItemsByOrder), so the query
    // doesn't depend on the display_order column, which older databases lack.
    return Promise.all([
      window.rimalDb.from('menu_items').select('*').order('created_at', { ascending: true }),
      window.rimalDb.from('menu_overrides').select('*')
    ]).then(function(results){
      if (results[0] && results[0].error) { console.warn('Rimal Seafood: could not load added menu items:', results[0].error.message); }
      customItems = (results[0] && results[0].data) || [];
      overrides = {};
      ((results[1] && results[1].data) || []).forEach(function(row){ overrides[row.item_key] = row; });
      renderPublic();
      renderAdminList();
    }).catch(function(){
      if (window.rimalCart && window.rimalCart.revalidate) { window.rimalCart.revalidate(); }
    });
  }
  function reloadAll(){
    return load().then(function(){
      if (window.rimalRenderDashboard) { window.rimalRenderDashboard(); }
    });
  }
  window.rimalLoadMenuItems = load;
  scanBuiltIns();
  load();

  if (!formEl) return;

  // ---------- Form ----------
  var unitWrap = document.getElementById('newItemUnitWrap');
  var unitEl = document.getElementById('newItemUnit');
  var optionsEl = document.getElementById('newItemOptions');
  var photoEl = document.getElementById('newItemPhoto');
  var previewEl = document.getElementById('newItemPhotoPreview');
  var removePhotoWrap = document.getElementById('newItemRemovePhotoWrap');
  var removePhotoEl = document.getElementById('newItemRemovePhoto');
  var statusEl = document.getElementById('newItemStatus');
  var saveBtn = document.getElementById('newItemSaveBtn');
  var cancelBtn = document.getElementById('newItemCancelBtn');
  var resetBtn = document.getElementById('newItemResetBtn');
  var titleEl = document.getElementById('newItemFormTitle');
  var fixedCatEl = document.getElementById('newItemCategoryFixed');
  var nameEl = document.getElementById('newItemName');
  var descEl = document.getElementById('newItemDesc');
  var priceEl = document.getElementById('newItemPrice');

  function setStatus(msg, isError){
    statusEl.hidden = !msg;
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#a8433a' : 'var(--gold-light)';
  }

  function syncUnit(){
    var cat = CATS[categoryEl.value];
    var builtinMarketEdit = editing && editing.kind === 'builtin';
    unitWrap.hidden = builtinMarketEdit || !(cat && cat.market);
  }
  categoryEl.addEventListener('change', syncUnit);

  function addOptionRow(label, price){
    var row = document.createElement('div');
    row.className = 'item-option-row';
    row.innerHTML =
      '<input type="text" class="admin-input" data-opt-label maxlength="30" placeholder="Option name (e.g. Small)">' +
      '<input type="number" class="admin-input" data-opt-price min="0" step="0.01" placeholder="Price">' +
      '<button class="btn" type="button" data-opt-remove style="padding:6px 12px;">&times;</button>';
    if (label != null) { row.querySelector('[data-opt-label]').value = label; }
    if (price != null) { row.querySelector('[data-opt-price]').value = price; }
    optionsEl.appendChild(row);
  }
  document.getElementById('addOptionRowBtn').addEventListener('click', function(){ addOptionRow(); });
  optionsEl.addEventListener('click', function(e){
    var rm = e.target.closest('[data-opt-remove]');
    if (rm) { rm.parentNode.remove(); }
  });

  photoEl.addEventListener('change', function(){
    var file = photoEl.files && photoEl.files[0];
    if (!file) { return; }
    previewEl.src = URL.createObjectURL(file);
    previewEl.hidden = false;
    removePhotoEl.checked = false;
  });

  function resetForm(){
    editing = null;
    formEl.reset();
    optionsEl.innerHTML = '';
    previewEl.hidden = true;
    previewEl.removeAttribute('src');
    removePhotoWrap.hidden = true;
    fixedCatEl.hidden = true;
    categoryEl.hidden = false;
    titleEl.textContent = 'Add a Menu or Fish Market Item';
    saveBtn.textContent = 'Add Item to Website';
    cancelBtn.hidden = true;
    resetBtn.hidden = true;
    syncUnit();
  }
  resetForm();

  function startEdit(row){
    var d = row.data;
    resetForm();
    setStatus('', false);
    editing = row.kind === 'custom' ? { kind: 'custom', item: row.item } : { kind: 'builtin', entry: row.entry };
    titleEl.textContent = 'Edit: ' + d.name;
    saveBtn.textContent = 'Save Changes';
    cancelBtn.hidden = false;
    nameEl.value = d.name;
    descEl.value = d.description || '';
    priceEl.value = d.price != null ? d.price : '';
    cleanOptions(d.options).forEach(function(o){ addOptionRow(o.label, o.price); });
    if (row.kind === 'custom') {
      categoryEl.value = row.item.category;
      if (unitEl && row.item.unit) { unitEl.value = row.item.unit; }
    } else {
      categoryEl.hidden = true;
      fixedCatEl.hidden = false;
      fixedCatEl.textContent = row.section + ' (stays in this section)';
      resetBtn.hidden = !overrides[row.entry.key];
    }
    syncUnit();
    if (d.image_url) {
      previewEl.src = d.image_url;
      previewEl.hidden = false;
      removePhotoWrap.hidden = false;
    }
    var tab = document.querySelector('[data-admin-tab="additem"]');
    if (tab) { tab.click(); }
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    nameEl.focus();
  }
  cancelBtn.addEventListener('click', function(){ resetForm(); setStatus('', false); });

  // Phone photos are several MB; shrink to a web-sized JPEG before upload.
  function resizeImage(file, maxDim){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function(blob){ blob ? resolve(blob) : reject(new Error('Could not process that photo.')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('Could not read that photo. Try a JPG or PNG.')); };
      img.src = url;
    });
  }
  // Menu and market photos show at most ~220px wide (440px on sharp screens),
  // so 640px keeps them crisp at a fraction of the download.
  function uploadPhoto(file, maxDim){
    return resizeImage(file, maxDim || 640).then(function(blob){
      var path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      return window.rimalDb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' }).then(function(res){
        if (res.error) { throw res.error; }
        return window.rimalDb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
      });
    });
  }
  // Only photos we uploaded are ever deleted from storage (never the
  // built-in website photos).
  function discardPhoto(url){
    var marker = '/' + PHOTO_BUCKET + '/';
    var at = url ? url.indexOf(marker) : -1;
    if (at !== -1) {
      window.rimalDb.storage.from(PHOTO_BUCKET).remove([decodeURIComponent(url.slice(at + marker.length))]);
    }
  }

  // Shared with the website-photos manager below.
  window.rimalPhotoTools = { upload: uploadPhoto, discard: discardPhoto };

  formEl.addEventListener('submit', function(e){
    e.preventDefault();
    if (!window.rimalDb) { setStatus('Database is not connected.', true); return; }

    var name = nameEl.value.replace(/[<>]/g, '').trim();
    var desc = descEl.value.replace(/[<>]/g, '').trim();
    var category = categoryEl.value;
    var isMarket = !!(CATS[category] && CATS[category].market);
    var unit = isMarket ? unitEl.value : null;

    if (!name) { setStatus('Please enter the item name.', true); return; }

    var options = [];
    var optionError = false;
    optionsEl.querySelectorAll('.item-option-row').forEach(function(row){
      var label = row.querySelector('[data-opt-label]').value.replace(/[<>]/g, '').trim();
      var priceRaw = row.querySelector('[data-opt-price]').value;
      if (!label && !priceRaw) return;
      var p = parseFloat(priceRaw);
      if (!label || !isFinite(p) || p < 0) { optionError = true; return; }
      options.push({ label: label, price: p });
    });
    if (optionError) { setStatus('Each option needs both a name and a price.', true); return; }

    var price = options.length ? options[0].price : parseFloat(priceEl.value);
    if (!isFinite(price) || price < 0) { setStatus('Please enter a price.', true); return; }

    var file = photoEl.files && photoEl.files[0];
    var removePhoto = !removePhotoWrap.hidden && removePhotoEl.checked;
    saveBtn.disabled = true;
    setStatus('Saving…', false);

    (file ? uploadPhoto(file) : Promise.resolve(null)).then(function(newUrl){
      var db = window.rimalDb;
      if (!editing) {
        return db.from('menu_items').insert({
          name: name, description: desc || null, category: category, price: price, unit: unit,
          options: options.length ? options : null, image_url: newUrl, display_order: getNextCustomDisplayOrder()
        });
      }
      if (editing.kind === 'custom') {
        var oldUrl = editing.item.image_url || null;
        var nextUrl = newUrl || (removePhoto ? null : oldUrl);
        return db.from('menu_items').update({
          name: name, description: desc || null, category: category, price: price, unit: unit,
          options: options.length ? options : null, image_url: nextUrl, display_order: editing.item.display_order || getNextCustomDisplayOrder()
        }).eq('id', editing.item.id).then(function(res){
          if (!res.error && oldUrl && nextUrl !== oldUrl) { discardPhoto(oldUrl); }
          return res;
        });
      }
      var key = editing.entry.key;
      var existing = overrides[key] || null;
      var oldOvUrl = existing ? existing.image_url : null;
      var nextOvUrl = newUrl || (removePhoto ? '' : oldOvUrl);
      return db.from('menu_overrides').upsert({
        item_key: key, name: name, description: desc, price: price, options: options,
        image_url: nextOvUrl == null ? null : nextOvUrl, removed: false, updated_at: new Date().toISOString()
      }, { onConflict: 'item_key' }).then(function(res){
        if (!res.error && oldOvUrl && nextOvUrl !== oldOvUrl) { discardPhoto(oldOvUrl); }
        return res;
      });
    }).then(function(res){
      if (res.error) { throw res.error; }
      var wasEditing = !!editing;
      resetForm();
      setStatus(wasEditing ? '✓ "' + name + '" was updated on the website.' : '✓ "' + name + '" was added to the website.', false);
      return reloadAll();
    }).catch(function(err){
      var msg = (err && err.message) ? err.message : 'Please try again.';
      if (/bucket not found/i.test(msg)) {
        msg += ' (In Supabase, open Storage and create a PUBLIC bucket named menu-photos.)';
      } else if (/menu_items|menu_overrides|schema cache|bucket/i.test(msg)) {
        msg += ' (Run the latest supabase-setup.sql in Supabase first.)';
      }
      setStatus('Could not save: ' + msg, true);
    }).then(function(){
      saveBtn.disabled = false;
    });
  });

  resetBtn.addEventListener('click', function(){
    if (!editing || editing.kind !== 'builtin' || !window.rimalDb) return;
    var key = editing.entry.key;
    var existing = overrides[key];
    if (!confirm('Undo all your changes to this item and put it back exactly as it was originally?')) return;
    window.rimalDb.from('menu_overrides').delete().eq('item_key', key).then(function(res){
      if (res.error) { setStatus('Could not undo: ' + res.error.message, true); return; }
      if (existing && existing.image_url) { discardPhoto(existing.image_url); }
      resetForm();
      setStatus('✓ Item is back to its original version.', false);
      reloadAll();
    });
  });

  var searchEl = document.getElementById('itemManageSearch');
  if (searchEl) { searchEl.addEventListener('input', renderAdminList); }

  listEl.addEventListener('click', function(e){
    var orderBtn = e.target.closest('[data-item-order]');
    if (orderBtn && window.rimalDb) {
      var itemId = orderBtn.getAttribute('data-item-id');
      var direction = orderBtn.getAttribute('data-item-order');
      e.preventDefault();
      reorderCustomItem(itemId, direction).catch(function(){
        alert('Could not reorder the item right now.');
      });
      return;
    }
    var btn = e.target.closest('[data-item-act]');
    if (!btn || !window.rimalDb) return;
    var row = listRows[parseInt(btn.getAttribute('data-i'), 10)];
    if (!row) return;
    var act = btn.getAttribute('data-item-act');

    if (act === 'edit') { startEdit(row); return; }

    if (act === 'remove') {
      if (!confirm('Remove "' + row.data.name + '" from the website? Customers will no longer see it.' + (row.kind === 'builtin' ? ' You can bring it back later with Restore.' : ''))) return;
      btn.disabled = true;
      var p;
      if (row.kind === 'custom') {
        p = window.rimalDb.from('menu_items').delete().eq('id', row.item.id).then(function(res){
          if (!res.error && row.item.image_url) { discardPhoto(row.item.image_url); }
          return res;
        });
      } else {
        p = window.rimalDb.from('menu_overrides').upsert({ item_key: row.entry.key, removed: true, updated_at: new Date().toISOString() }, { onConflict: 'item_key' });
      }
      p.then(function(res){
        if (res.error) { btn.disabled = false; alert('Could not remove: ' + res.error.message); return; }
        if (editing && ((editing.kind === 'custom' && row.item === editing.item) || (editing.kind === 'builtin' && row.entry === editing.entry))) { resetForm(); }
        reloadAll();
      });
      return;
    }

    if (act === 'restore') {
      btn.disabled = true;
      window.rimalDb.from('menu_overrides').upsert({ item_key: row.entry.key, removed: false, updated_at: new Date().toISOString() }, { onConflict: 'item_key' }).then(function(res){
        if (res.error) { btn.disabled = false; alert('Could not restore: ' + res.error.message); return; }
        reloadAll();
      });
    }
  });
})();


(function(){
  // Website photos outside the menu/market items: Home background, About
  // photo, Visit background, Logo and the Gallery. The manager can replace or
  // remove them, and add new Gallery photos. Changes are stored in the shared
  // database (site_photos) and applied to this page when it loads.
  var VISIT_OVERLAY = 'linear-gradient(180deg, rgba(13,28,54,.9), rgba(13,28,54,.93))';
  var VISIT_ORIGINAL = 'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=400&auto=format&fit=crop';

  var heroImg = document.querySelector('#page-home .home-photo img');
  var heroFig = heroImg && heroImg.closest('figure');
  var aboutImg = document.querySelector('#page-about .about-photo img');
  var aboutFig = aboutImg && aboutImg.closest('figure');
  var visitSec = document.querySelector('section.reserve');
  var logos = document.querySelectorAll('.brand-logo');
  var galleryGrid = document.querySelector('#page-about .gallery-grid');

  var ORIG = {
    home_hero: heroImg ? heroImg.getAttribute('src') : '',
    about: aboutImg ? aboutImg.getAttribute('src') : '',
    visit_bg: VISIT_ORIGINAL,
    logo: logos.length ? logos[0].getAttribute('src') : ''
  };
  var SLOTS = [
    { key: 'home_hero', label: 'Home page photo', removable: true },
    { key: 'about',     label: 'About page photo', removable: true },
    { key: 'visit_bg',  label: 'Visit page background', removable: true },
    { key: 'logo',      label: 'Logo (top and bottom of every page)', removable: false }
  ];

  // The gallery pictures written into the page, in their original order.
  var galleryBuiltIns = [];
  if (galleryGrid) {
    Array.prototype.forEach.call(galleryGrid.children, function(a, i){
      var img = a.querySelector('img');
      if (!img) return;
      galleryBuiltIns.push({ key: 'gallery-' + (i + 1), a: a, marker: null, removed: false, origSrc: img.getAttribute('src') });
    });
  }

  var overrides = {};   // photo_key -> row (built-in slots)
  var addedRows = [];   // gallery photos the manager added

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // A manager photo replaces the built-in one, so its srcset (sizes of the
  // built-in photo) is dropped, and put back when the photo is restored.
  function setPhoto(img, url, origSrc){
    if (!img.hasAttribute('data-orig-srcset')) { img.setAttribute('data-orig-srcset', img.getAttribute('srcset') || ''); }
    var origSet = img.getAttribute('data-orig-srcset');
    if (url || !origSet) { img.removeAttribute('srcset'); } else { img.setAttribute('srcset', origSet); }
    img.setAttribute('src', url || origSrc);
  }

  function applyPhotos(){
    var o = overrides;

    var h = o.home_hero;
    if (heroImg) {
      heroFig.style.display = h && h.removed ? 'none' : '';
      heroFig.parentNode.classList.toggle('no-photo', !!(h && h.removed));
      setPhoto(heroImg, h && h.image_url, ORIG.home_hero);
    }

    var a = o.about;
    if (aboutImg) {
      aboutFig.style.display = a && a.removed ? 'none' : '';
      aboutFig.parentNode.style.gridTemplateColumns = a && a.removed ? '1fr' : '';
      setPhoto(aboutImg, a && a.image_url, ORIG.about);
    }

    var v = o.visit_bg;
    if (visitSec) {
      if (v && v.removed) { visitSec.style.background = '#0D1C36'; }
      // Only a plain https address may go inside url("..."), so a stored value can't break out of the CSS.
      else if (v && /^https:\/\/[^"'()\\\s]+$/.test(v.image_url || '')) { visitSec.style.background = VISIT_OVERLAY + ', url("' + v.image_url + '") center/cover'; }
      else { visitSec.style.background = ''; }
    }

    var l = o.logo;
    logos.forEach(function(img){ setPhoto(img, l && l.image_url, ORIG.logo); });

    galleryBuiltIns.forEach(function(g){
      var ov = o[g.key];
      var wantRemoved = !!(ov && ov.removed);
      if (wantRemoved && !g.removed) {
        g.marker = document.createComment('removed by manager');
        g.a.parentNode.replaceChild(g.marker, g.a);
        g.removed = true;
      } else if (!wantRemoved && g.removed) {
        g.marker.parentNode.replaceChild(g.a, g.marker);
        g.marker = null;
        g.removed = false;
      }
      setPhoto(g.a.querySelector('img'), ov && ov.image_url, g.origSrc);
    });

    if (galleryGrid) {
      Array.prototype.slice.call(galleryGrid.querySelectorAll('[data-new-gallery]')).forEach(function(el){ el.remove(); });
      addedRows.forEach(function(r){
        if (!r.image_url || r.removed) return;
        var link = document.createElement('figure');
        link.setAttribute('data-new-gallery', r.photo_key);
        var img = document.createElement('img');
        img.setAttribute('src', r.image_url);
        img.setAttribute('alt', 'Rimal Seafood photo');
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
        link.appendChild(img);
        galleryGrid.appendChild(link);
      });
    }
  }

  function load(){
    if (!window.rimalDb) return Promise.resolve();
    return window.rimalDb.from('site_photos').select('*').order('created_at', { ascending: true }).then(function(res){
      overrides = {};
      addedRows = [];
      ((res && res.data) || []).forEach(function(row){
        if (row.photo_key.indexOf('gallery-new-') === 0) { addedRows.push(row); }
        else { overrides[row.photo_key] = row; }
      });
      applyPhotos();
      renderList();
    }).catch(function(){});
  }

  // ---------- Manager list ----------
  var listEl = document.getElementById('sitePhotosList');
  var fileEl = document.getElementById('sitePhotoFile');
  var statusEl = document.getElementById('sitePhotoStatus');
  var addBtn = document.getElementById('addGalleryPhotoBtn');
  var rows = [];
  var pendingKey = null;

  function setStatus(msg, isError){
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#a8433a' : 'var(--gold-light)';
  }

  function buildRows(){
    rows = [];
    SLOTS.forEach(function(s){
      rows.push({ key: s.key, label: s.label, removable: s.removable, orig: ORIG[s.key], ov: overrides[s.key] || null, added: false });
    });
    galleryBuiltIns.forEach(function(g, i){
      rows.push({ key: g.key, label: 'Gallery photo ' + (i + 1) + ' (original)', removable: true, orig: g.origSrc, ov: overrides[g.key] || null, added: false });
    });
    addedRows.forEach(function(r, i){
      rows.push({ key: r.photo_key, label: 'Gallery photo you added #' + (i + 1), removable: true, orig: '', ov: r, added: true });
    });
  }

  function renderList(){
    if (!listEl) return;
    buildRows();
    listEl.innerHTML = rows.map(function(r, i){
      var removed = !!(r.ov && r.ov.removed);
      var replaced = !!(r.ov && r.ov.image_url) && !r.added;
      var thumb = (r.ov && r.ov.image_url) || r.orig;
      var tags = (removed ? ' <b style="color:#a8433a;">Removed</b>' : '') + (replaced ? ' <b>Replaced</b>' : '') + (r.added ? ' <b>Added by you</b>' : '');
      var btns;
      if (removed) {
        btns = '<button class="btn status-toggle-btn" type="button" data-photo-act="restore" data-i="' + i + '">Restore</button>';
      } else {
        btns = '<button class="btn status-toggle-btn" type="button" data-photo-act="replace" data-i="' + i + '">Replace</button>' +
          (replaced ? '<button class="btn status-toggle-btn" type="button" data-photo-act="restore" data-i="' + i + '">Undo</button>' : '') +
          (r.removable ? '<button class="btn status-toggle-btn" type="button" data-photo-act="remove" data-i="' + i + '" style="color:#a8433a;border-color:#a8433a;">Remove</button>' : '');
      }
      return '<div class="admin-row"' + (removed ? ' style="opacity:.6;"' : '') + '>' +
        (thumb ? '<img class="custom-item-thumb" style="width:64px;height:48px;" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async">' : '') +
        '<div class="admin-row-main"><div class="admin-row-title">' + esc(r.label) + '</div>' +
        '<div class="admin-row-meta">' + tags + '</div></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">' + btns + '</div></div>';
    }).join('');
  }

  function fail(err){
    var msg = (err && err.message) ? err.message : 'Please try again.';
    if (/bucket not found/i.test(msg)) { msg += ' (In Supabase, open Storage and create a PUBLIC bucket named menu-photos.)'; }
    else if (/site_photos|schema cache|bucket/i.test(msg)) { msg += ' (Run the latest supabase-setup.sql in Supabase first.)'; }
    setStatus('Could not save: ' + msg, true);
  }
  function reloadAll(){ return load(); }

  if (!listEl || !fileEl) { load(); return; }

  addBtn.addEventListener('click', function(){
    pendingKey = 'gallery-new-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    fileEl.value = '';
    fileEl.click();
  });

  fileEl.addEventListener('change', function(){
    var file = fileEl.files && fileEl.files[0];
    var key = pendingKey;
    pendingKey = null;
    if (!file || !key || !window.rimalDb || !window.rimalPhotoTools) return;
    setStatus('Uploading photo…', false);
    var existing = overrides[key] || null;
    window.rimalPhotoTools.upload(file, 1600).then(function(url){
      return window.rimalDb.from('site_photos').upsert({ photo_key: key, image_url: url, removed: false }, { onConflict: 'photo_key' }).then(function(res){
        if (res.error) { throw res.error; }
        var oldUrl = existing ? existing.image_url : null;
        if (oldUrl && oldUrl !== url) { window.rimalPhotoTools.discard(oldUrl); }
      });
    }).then(function(){
      setStatus('✓ Photo saved — it is now live on the website.', false);
      return reloadAll();
    }).catch(fail);
  });

  listEl.addEventListener('click', function(e){
    var btn = e.target.closest('[data-photo-act]');
    if (!btn || !window.rimalDb) return;
    var row = rows[parseInt(btn.getAttribute('data-i'), 10)];
    if (!row) return;
    var act = btn.getAttribute('data-photo-act');
    var oldUrl = row.ov ? row.ov.image_url : null;

    if (act === 'replace') {
      pendingKey = row.key;
      fileEl.value = '';
      fileEl.click();
      return;
    }

    if (act === 'remove') {
      var msg = row.added
        ? 'Delete this gallery photo? This cannot be undone.'
        : 'Remove "' + row.label + '" from the website? You can bring it back with Restore.';
      if (!confirm(msg)) return;
      btn.disabled = true;
      var p = row.added
        ? window.rimalDb.from('site_photos').delete().eq('photo_key', row.key)
        : window.rimalDb.from('site_photos').upsert({ photo_key: row.key, image_url: null, removed: true }, { onConflict: 'photo_key' });
      p.then(function(res){
        if (res.error) { throw res.error; }
        if (oldUrl) { window.rimalPhotoTools.discard(oldUrl); }
        setStatus('✓ Removed.', false);
        return reloadAll();
      }).catch(function(err){ btn.disabled = false; fail(err); });
      return;
    }

    if (act === 'restore') {
      if (!confirm('Put "' + row.label + '" back to the original photo?')) return;
      btn.disabled = true;
      window.rimalDb.from('site_photos').delete().eq('photo_key', row.key).then(function(res){
        if (res.error) { throw res.error; }
        if (oldUrl) { window.rimalPhotoTools.discard(oldUrl); }
        setStatus('✓ Original photo restored.', false);
        return reloadAll();
      }).catch(function(err){ btn.disabled = false; fail(err); });
    }
  });

  window.rimalLoadSitePhotos = load;
  load();
})();

(function(){
  // Manager Dashboard > Reports: sales grouped by day, week, month or year.
  var panel = document.getElementById('adminPanel-reports');
  if (!panel) return;

  var UNITS = {
    days:   { count: 30, head: 'Day',   best: 'Best Day',   span: 'the last 30 days' },
    weeks:  { count: 12, head: 'Week',  best: 'Best Week',  span: 'the last 12 weeks' },
    months: { count: 12, head: 'Month', best: 'Best Month', span: 'the last 12 months' },
    years:  { count: 5,  head: 'Year',  best: 'Best Year',  span: 'the last 5 years' }
  };
  var state = { unit: 'days', paid: 'all' };
  var current = null;   // last rendered buckets, for CSV export
  var runId = 0;

  var chartEl = document.getElementById('reportChart');
  var rowsEl = document.getElementById('reportRows');
  var footEl = document.getElementById('reportFoot');

  function money(n){
    return '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function tickMoney(n){
    return '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // Start of the day / Monday-based week / month / year containing d.
  function startOf(unit, d){
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (unit === 'weeks') { x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); }
    else if (unit === 'months') { x.setDate(1); }
    else if (unit === 'years') { x.setMonth(0, 1); }
    return x;
  }
  function addUnit(unit, d, k){
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (unit === 'days') { x.setDate(x.getDate() + k); }
    else if (unit === 'weeks') { x.setDate(x.getDate() + 7 * k); }
    else if (unit === 'months') { x.setMonth(x.getMonth() + k, 1); }
    else { x.setFullYear(x.getFullYear() + k, 0, 1); }
    return x;
  }
  function fullLabel(unit, d){
    if (unit === 'days')   { return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
    if (unit === 'weeks')  { return 'Week of ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    if (unit === 'months') { return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
    return String(d.getFullYear());
  }
  function axisLabel(unit, d){
    if (unit === 'days' || unit === 'weeks') { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    if (unit === 'months') { return d.toLocaleDateString(undefined, { month: 'short' }); }
    return String(d.getFullYear());
  }

  // Round the top of the y-axis to a clean number so four equal steps read cleanly.
  function niceMax(v){
    if (v <= 0) { return 100; }
    var exp = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var f = v / exp;
    var pick = [1, 2, 4, 8, 10].filter(function(s){ return s >= f; })[0];
    return pick * exp;
  }

  function fetchOrders(sinceIso){
    var all = [];
    function page(from){
      return window.rimalDb.from('orders').select('created_at,total,payment_status')
        .gte('created_at', sinceIso).order('created_at', { ascending: true }).range(from, from + 999)
        .then(function(res){
          var rows = res.data || [];
          all = all.concat(rows);
          return (rows.length === 1000 && from < 49000) ? page(from + 1000) : all;
        });
    }
    return page(0);
  }

  function buildBuckets(unit, orders, paidOnly){
    var cfg = UNITS[unit];
    var last = startOf(unit, new Date());
    var first = addUnit(unit, last, -(cfg.count - 1));
    var buckets = [], byTime = {};
    for (var i = 0; i < cfg.count; i++) {
      var s = addUnit(unit, first, i);
      var b = { start: s, orders: 0, sales: 0 };
      buckets.push(b);
      byTime[s.getTime()] = b;
    }
    orders.forEach(function(o){
      if (paidOnly && o.payment_status !== 'paid') return;
      var b = byTime[startOf(unit, new Date(o.created_at)).getTime()];
      if (!b) return;
      b.orders += 1;
      b.sales += Number(o.total) || 0;
    });
    return { unit: unit, first: first, buckets: buckets };
  }

  function renderSummary(data){
    var buckets = data.buckets, cfg = UNITS[data.unit];
    var sales = 0, orders = 0, best = null;
    buckets.forEach(function(b){
      sales += b.sales; orders += b.orders;
      if (b.sales > 0 && (!best || b.sales > best.sales)) { best = b; }
    });
    document.getElementById('repSales').textContent = money(sales);
    document.getElementById('repOrders').textContent = orders;
    document.getElementById('repAvg').textContent = money(orders ? sales / orders : 0);
    document.getElementById('repBest').textContent = best ? axisLabel(data.unit, best.start) + (data.unit === 'months' ? ' ' + best.start.getFullYear() : '') : '—';
    document.getElementById('repBestLabel').textContent = cfg.best;
    document.getElementById('repPeriodHead').textContent = cfg.head;
    document.getElementById('reportRange').textContent =
      'Showing ' + cfg.span + ': ' + fullLabel(data.unit, buckets[0].start) + ' – ' + fullLabel(data.unit, buckets[buckets.length - 1].start) + '.';
    return { sales: sales, orders: orders };
  }

  function renderChart(data){
    var buckets = data.buckets, unit = data.unit;
    chartEl.innerHTML = '';
    var maxSales = buckets.reduce(function(m, b){ return Math.max(m, b.sales); }, 0);
    var top = niceMax(maxSales);

    for (var g = 0; g <= 4; g++) {
      var line = document.createElement('div');
      line.className = 'report-gridline' + (g === 0 ? ' base' : '');
      line.style.bottom = (g * 25) + '%';
      var lab = document.createElement('span');
      lab.textContent = tickMoney(top * g / 4);
      line.appendChild(lab);
      chartEl.appendChild(line);
    }

    var cols = document.createElement('div');
    cols.className = 'report-cols';
    var step = Math.ceil(buckets.length / 8);
    var tip = document.createElement('div');
    tip.className = 'report-tip';
    tip.hidden = true;
    var tipValue = document.createElement('strong');
    var tipMeta = document.createElement('span');
    tip.appendChild(tipValue);
    tip.appendChild(tipMeta);

    function showTip(col, b){
      tipValue.textContent = money(b.sales);
      tipMeta.textContent = fullLabel(unit, b.start) + ' · ' + b.orders + (b.orders === 1 ? ' order' : ' orders');
      tip.hidden = false;
      var barTop = col.offsetTop + col.offsetHeight * (1 - (top ? b.sales / top : 0));
      var half = tip.offsetWidth / 2;
      var x = col.offsetLeft + col.offsetWidth / 2;
      x = Math.max(half - 44, Math.min(chartEl.clientWidth - half, x));
      tip.style.left = x + 'px';
      tip.style.top = (barTop - 8) + 'px';
    }

    buckets.forEach(function(b, i){
      var col = document.createElement('div');
      col.className = 'report-col';
      col.tabIndex = 0;
      col.setAttribute('aria-label', fullLabel(unit, b.start) + ': ' + money(b.sales) + ', ' + b.orders + ' orders');
      var bar = document.createElement('div');
      bar.className = 'report-bar';
      var pct = top ? (b.sales / top) * 100 : 0;
      bar.style.height = pct + '%';
      if (b.sales > 0) { bar.style.minHeight = '2px'; }
      col.appendChild(bar);
      if (i % step === 0) {
        var xl = document.createElement('div');
        xl.className = 'report-xl';
        xl.textContent = axisLabel(unit, b.start);
        col.appendChild(xl);
      }
      col.addEventListener('pointerenter', function(){ showTip(col, b); });
      col.addEventListener('focus', function(){ showTip(col, b); });
      col.addEventListener('pointerleave', function(){ tip.hidden = true; });
      col.addEventListener('blur', function(){ tip.hidden = true; });
      cols.appendChild(col);
    });
    chartEl.appendChild(cols);
    chartEl.appendChild(tip);
  }

  function renderTable(data, totals){
    var unit = data.unit;
    rowsEl.innerHTML = '';
    data.buckets.slice().reverse().forEach(function(b){
      var tr = document.createElement('tr');
      [fullLabel(unit, b.start), String(b.orders), money(b.sales), money(b.orders ? b.sales / b.orders : 0)].forEach(function(text, i){
        var td = document.createElement('td');
        if (i > 0) { td.className = 'num'; }
        td.textContent = text;
        tr.appendChild(td);
      });
      rowsEl.appendChild(tr);
    });
    footEl.innerHTML = '';
    var tr = document.createElement('tr');
    ['Total', String(totals.orders), money(totals.sales), money(totals.orders ? totals.sales / totals.orders : 0)].forEach(function(text, i){
      var td = document.createElement('td');
      if (i > 0) { td.className = 'num'; }
      td.textContent = text;
      tr.appendChild(td);
    });
    footEl.appendChild(tr);
  }

  function refresh(){
    if (!panel.classList.contains('active') || !window.rimalDb) return;
    var id = ++runId;
    var cfg = UNITS[state.unit];
    var since = addUnit(state.unit, startOf(state.unit, new Date()), -(cfg.count - 1));
    fetchOrders(since.toISOString()).then(function(orders){
      if (id !== runId) return;   // a newer request replaced this one
      var data = buildBuckets(state.unit, orders, state.paid === 'paid');
      current = data;
      var totals = renderSummary(data);
      renderChart(data);
      renderTable(data, totals);
    });
  }
  window.rimalRefreshReport = refresh;

  document.getElementById('reportUnit').addEventListener('click', function(e){
    var btn = e.target.closest('[data-unit]');
    if (!btn) return;
    state.unit = btn.getAttribute('data-unit');
    this.querySelectorAll('button').forEach(function(b){ b.classList.toggle('active', b === btn); });
    refresh();
  });
  document.getElementById('reportPaid').addEventListener('change', function(){
    state.paid = this.value;
    refresh();
  });
  // Panel becomes visible when its tab is clicked (the tab handler runs first).
  document.getElementById('adminTabs').addEventListener('click', function(e){
    var tab = e.target.closest('[data-admin-tab="reports"]');
    if (tab) { setTimeout(refresh, 0); }
  });

  document.getElementById('reportCsvBtn').addEventListener('click', function(){
    if (!current) return;
    var unit = current.unit;
    var rows = [[UNITS[unit].head, 'Orders', 'Sales', 'Average Order']];
    current.buckets.forEach(function(b){
      rows.push([fullLabel(unit, b.start), b.orders, b.sales.toFixed(2), (b.orders ? b.sales / b.orders : 0).toFixed(2)]);
    });
    var csv = rows.map(function(r){
      return r.map(function(cell){ return '"' + window.rimalCsvSafe(cell).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = 'rimal-seafood-report-' + unit + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
})();

(function(){
  var gate = document.getElementById('adminGate');
  var dash = document.getElementById('adminDashboard');
  var MANAGER_EMAIL = 'bulbulseafood1@gmail.com';
  var passwordInput = document.getElementById('adminPasswordInput');
  var unlockBtn = document.getElementById('adminUnlockBtn');
  var pinError = document.getElementById('adminPinError');
  var lockBtn = document.getElementById('adminLockBtn');
  var resetBtn = document.getElementById('adminResetBtn');
  var exportBtn = document.getElementById('exportCsvBtn');
  var passwordStep = document.getElementById('adminPasswordStep');
  var codeStep = document.getElementById('adminCodeStep');
  var codeInput = document.getElementById('adminCodeInput');
  var codeBtn = document.getElementById('adminCodeBtn');
  var codeCancelBtn = document.getElementById('adminCodeCancelBtn');
  var codeError = document.getElementById('adminCodeError');
  var realtimeChannel = null;

  function money(n){ return '$' + (Number(n) || 0).toFixed(2); }
  // Orders come from the public website, so anything a customer typed (name,
  // item text, table) is escaped before it is put into the dashboard's HTML.
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  // Only well-formed items. Orders saved before the database checked them
  // could hold anything, and one bad row must not break the whole dashboard.
  function itemsOf(o){ return (o && Array.isArray(o.items) ? o.items : []).filter(function(i){ return i && typeof i === 'object'; }); }
  function buildTableSelect(orderId, currentTable){
    var opts = '<option value="">No table</option>';
    for (var t = 1; t <= 20; t++) {
      opts += '<option value="' + t + '"' + (String(currentTable) === String(t) ? ' selected' : '') + '>Table ' + t + '</option>';
    }
    return '<select class="inv-input" style="width:auto;" aria-label="Table" data-assign-table-id="' + esc(orderId) + '">' + opts + '</select>';
  }

  // Every load below talks to the real shared database — what one
  // manager sees here is the same for every device, in real time.
  function loadOrders(){
    if (!window.rimalDb) return Promise.resolve([]);
    return window.rimalDb.from('orders').select('*').order('created_at', { ascending: false }).limit(300)
      .then(function(res){ return res.data || []; });
  }
  function loadInventoryMap(){
    if (!window.rimalDb) return Promise.resolve({});
    return window.rimalDb.from('inventory').select('*').then(function(res){
      var map = {};
      (res.data || []).forEach(function(row){ map[row.item_name] = Number(row.stock); });
      return map;
    });
  }
  function loadAccounts(){
    if (!window.rimalDb) return Promise.resolve([]);
    return window.rimalDb.from('rewards_accounts').select('*').then(function(res){ return res.data || []; });
  }

  function printReceipt(order){
    var lines = itemsOf(order).map(function(i){
      var unitLabel = i.unit ? (' ' + esc(i.unit)) : '';
      var lineTotal = (Number(i.price) * Number(i.qty)).toFixed(2);
      return '<div class="r-item">' +
        '<span class="r-item-name">' + esc(i.qty) + unitLabel + ' &times; ' + esc(i.name) + '</span>' +
        '<span class="r-item-price">$' + lineTotal + '</span>' +
      '</div>';
    }).join('');

    var suggested = [15, 18, 20].map(function(pct){
      var amt = (order.subtotal - order.discount) * (pct / 100);
      return '<div class="r-item"><span>' + pct + '%</span><span>$' + amt.toFixed(2) + '</span></div>';
    }).join('');

    var html =
      '<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>' +
      'body{font-family:"Courier New",monospace;max-width:320px;margin:0 auto;padding:24px 18px;color:#111;background:#fff;}' +
      'h1{font-size:1.1rem;text-align:center;margin:0 0 2px;letter-spacing:1px;}' +
      '.r-sub{text-align:center;font-size:.72rem;color:#444;margin-bottom:14px;}' +
      '.r-line{border-top:1px dashed #999;margin:12px 0;}' +
      '.r-meta{font-size:.78rem;margin-bottom:4px;}' +
      '.r-item{display:flex;justify-content:space-between;font-size:.82rem;padding:3px 0;}' +
      '.r-item-name{padding-right:10px;}' +
      '.r-total-row{display:flex;justify-content:space-between;font-size:.85rem;padding:2px 0;}' +
      '.r-grand{font-weight:bold;font-size:1rem;border-top:1px solid #111;margin-top:6px;padding-top:8px;}' +
      '.r-tip-line{margin:10px 0 4px;font-size:.82rem;}' +
      '.r-blank{display:inline-block;border-bottom:1px solid #111;min-width:110px;height:16px;}' +
      '.r-blank-wide{min-width:200px;}' +
      '.r-suggest{font-size:.72rem;color:#444;margin:6px 0 0;}' +
      '.r-thanks{text-align:center;margin-top:18px;font-size:.8rem;}' +
      '.r-print-btn{display:block;width:100%;margin:20px 0 0;padding:10px;font-size:.85rem;cursor:pointer;}' +
      '@media print{.r-print-btn{display:none;}}' +
      '</style></head><body>' +
      '<h1>RIMAL SEAFOOD</h1>' +
      '<p class="r-sub">7812 5th Ave, Brooklyn, NY 11209<br>(347) 497-4002</p>' +
      '<div class="r-line"></div>' +
      '<div class="r-meta">Date: ' + new Date(order.created_at).toLocaleString() + '</div>' +
      '<div class="r-meta">Order #' + esc(String(order.id).slice(-6)) + '</div>' +
      (order.customer_name ? '<div class="r-meta">Guest: ' + esc(order.customer_name) + '</div>' : '') +
      (order.table_number ? '<div class="r-meta">Table: ' + esc(order.table_number) + '</div>' : '') +
      '<div class="r-line"></div>' +
      lines +
      '<div class="r-line"></div>' +
      '<div class="r-total-row"><span>Subtotal</span><span>' + money(order.subtotal) + '</span></div>' +
      (order.discount > 0 ? '<div class="r-total-row"><span>Rewards Discount</span><span>-' + money(order.discount) + '</span></div>' : '') +
      '<div class="r-total-row"><span>Sales Tax</span><span>' + money(order.tax) + '</span></div>' +
      '<div class="r-total-row r-grand"><span>Total</span><span>' + money(order.total) + '</span></div>' +
      '<div class="r-line"></div>' +
      '<div class="r-tip-line">Tip: <span class="r-blank"></span></div>' +
      '<div class="r-tip-line">Total with Tip: <span class="r-blank"></span></div>' +
      '<div class="r-suggest">Suggested tip (on ' + money(order.subtotal - order.discount) + '):</div>' +
      suggested +
      '<div class="r-line"></div>' +
      '<div class="r-tip-line">Signature: <span class="r-blank r-blank-wide"></span></div>' +
      '<div class="r-thanks">Thank you for dining with us!</div>' +
      '<button class="r-print-btn" type="button">Print This Receipt</button>' +
      '</body></html>';

    var w = window.open('', '_blank', 'width=380,height=640');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      var printBtn = w.document.querySelector('.r-print-btn');
      if (printBtn) { printBtn.addEventListener('click', function(){ w.print(); }); }
    }
  }

  function showDashboard(){
    gate.hidden = true;
    dash.hidden = false;
    renderDashboard();
    if (window.rimalRefreshMfa) { window.rimalRefreshMfa(); }
    // Data retention (see privacy.html): erases names and phones from orders
    // older than 90 days. Normally a nightly database job; this is the backup.
    if (window.rimalDb) { window.rimalDb.rpc('apply_retention').then(function(){}, function(){}); }
    if (window.rimalDb && !realtimeChannel) {
      // Live updates: a new order placed on any device (a customer's
      // phone, another register) appears here within a second or two,
      // with no page refresh needed.
      realtimeChannel = window.rimalDb.channel('orders-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, function(payload){
          scheduleRender();
          if (payload.eventType === 'UPDATE' && payload.new && payload.new.payment_method === 'card' && payload.new.payment_status === 'paid' &&
              Date.now() - new Date(payload.new.created_at).getTime() < 6 * 3600000) {
            printReceipt(payload.new);
          }
        })
        .subscribe();
    }
  }
  function showGate(){
    gate.hidden = false;
    dash.hidden = true;
    passwordStep.hidden = false;
    codeStep.hidden = true;
    passwordInput.value = '';
    pinError.hidden = true;
    if (realtimeChannel && window.rimalDb) { window.rimalDb.removeChannel(realtimeChannel); realtimeChannel = null; }
  }

  unlockBtn.addEventListener('click', function(){
    if (!window.rimalDb) { pinError.hidden = false; pinError.textContent = 'Database is not configured yet — see config.js.'; return; }
    unlockBtn.disabled = true;
    window.rimalDb.auth.signInWithPassword({ email: MANAGER_EMAIL, password: passwordInput.value })
      .then(function(res){
        unlockBtn.disabled = false;
        if (res.error) {
          pinError.textContent = 'Incorrect email or password.';
          pinError.hidden = false;
          passwordInput.value = '';
          passwordInput.focus();
          return;
        }
        continueSignIn();
      });
  });
  passwordInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') unlockBtn.click(); });

  // Two-step sign-in: once the manager has turned it on (Sign-In Security tab),
  // the password alone is not enough, and the database refuses the dashboard's
  // requests until the 6-digit code is entered (see is_admin() in the SQL).
  function continueSignIn(){
    return window.rimalDb.auth.mfa.getAuthenticatorAssuranceLevel().then(function(res){
      var d = res.data || {};
      if (d.nextLevel === 'aal2' && d.currentLevel !== 'aal2') { showCodeStep(); }
      else { showDashboard(); }
    }).catch(function(){
      // Couldn't check: stay on the sign-in screen rather than guess.
      showGate();
      pinError.textContent = "Couldn't check your sign-in. Check the internet connection and try again.";
      pinError.hidden = false;
    });
  }
  function showCodeStep(){
    gate.hidden = false;
    dash.hidden = true;
    passwordStep.hidden = true;
    codeStep.hidden = false;
    codeInput.value = '';
    codeError.hidden = true;
    codeInput.focus();
  }
  codeBtn.addEventListener('click', function(){
    var code = codeInput.value.replace(/\D/g, '');
    if (code.length !== 6) { codeError.textContent = 'Enter the 6 digits from your authenticator app.'; codeError.hidden = false; return; }
    codeBtn.disabled = true;
    // If more than one phone is set up, the code is tried against each.
    window.rimalDb.auth.mfa.listFactors().then(function(res){
      var factors = (res.data && res.data.totp) || [];
      if (!factors.length) { throw new Error('no factor'); }
      function tryFactor(i){
        if (i >= factors.length) { throw new Error('wrong code'); }
        return window.rimalDb.auth.mfa.challengeAndVerify({ factorId: factors[i].id, code: code }).then(function(r){
          return r.error ? tryFactor(i + 1) : r;
        });
      }
      return tryFactor(0);
    }).then(function(){
      codeBtn.disabled = false;
      showDashboard();
    }).catch(function(){
      codeBtn.disabled = false;
      codeError.textContent = "That code didn't work. Wait for the next code in your app and try again.";
      codeError.hidden = false;
      codeInput.value = '';
      codeInput.focus();
    });
  });
  codeInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') codeBtn.click(); });
  codeCancelBtn.addEventListener('click', function(){
    if (window.rimalDb) { window.rimalDb.auth.signOut(); }
    showGate();
  });

  lockBtn.addEventListener('click', function(){
    if (window.rimalDb) { window.rimalDb.auth.signOut(); }
    showGate();
  });

  resetBtn.addEventListener('click', function(){
    if (!window.rimalDb) return;
    if (!confirm('This permanently deletes every order (all sales, reports and order history) for ALL devices from the shared database. This cannot be undone. Continue?')) return;
    var alsoRewards = confirm('Also reset Rimal Rewards? Press OK to erase every rewards member, purchase count and free platter (recommended when clearing test data). Press Cancel to keep rewards accounts.');
    resetBtn.disabled = true;
    window.rimalDb.from('orders').delete().gte('created_at', '1900-01-01').then(function(res){
      if (res.error) { throw res.error; }
      if (!alsoRewards) return null;
      return window.rimalDb.from('rewards_accounts').delete().gte('updated_at', '1900-01-01').then(function(r2){
        if (r2.error) { throw r2.error; }
      });
    }).then(function(){
      resetBtn.disabled = false;
      alert('Done. All sales data' + (alsoRewards ? ' and rewards accounts' : '') + ' cleared.');
      renderDashboard();
    }).catch(function(err){
      resetBtn.disabled = false;
      alert('Could not clear everything: ' + ((err && err.message) || 'unknown error') + '\n\nRun the latest supabase-setup.sql in Supabase, then try again.');
      renderDashboard();
    });
  });

  exportBtn.addEventListener('click', function(){
    loadOrders().then(function(orders){
    var rows = [['Date/Time', 'Table', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total']];
    orders.forEach(function(o){
      var itemsStr = itemsOf(o).map(function(i){ return i.qty + 'x ' + i.name; }).join('; ');
      rows.push([
        new Date(o.created_at).toLocaleString(),
        o.table_number || '',
        itemsStr,
        Number(o.subtotal).toFixed(2), Number(o.discount).toFixed(2), Number(o.tax).toFixed(2), Number(o.total).toFixed(2)
      ]);
    });
    var csv = rows.map(function(r){
      return r.map(function(cell){ return '"' + window.rimalCsvSafe(cell).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'rimal-seafood-sales.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    });
  });

  window.rimalRenderDashboard = function(){ renderDashboard(); };

  var adminTabs = document.getElementById('adminTabs');
  adminTabs.addEventListener('click', function(e){
    var tab = e.target.closest('[data-admin-tab]');
    if (!tab) return;
    var key = tab.getAttribute('data-admin-tab');
    adminTabs.querySelectorAll('.admin-tab').forEach(function(t){ t.classList.toggle('active', t === tab); });
    document.querySelectorAll('.admin-panel').forEach(function(p){ p.classList.toggle('active', p.id === 'adminPanel-' + key); });
  });

  // Live updates can arrive in bursts, so the dashboard redraws at most once a second.
  var renderTimer = null;
  function scheduleRender(){
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderDashboard, 1000);
  }

  function renderDashboard(){
    if (window.rimalRefreshReport) { window.rimalRefreshReport(); }
    Promise.all([loadOrders(), loadInventoryMap(), loadAccounts()]).then(function(results){
      var orders = results[0], inv = results[1], accounts = results[2];

      var now = new Date();
      var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      var startWeek = startToday - 6 * 86400000;

      var todayOrders = orders.filter(function(o){ return new Date(o.created_at).getTime() >= startToday; });
      var weekOrders = orders.filter(function(o){ return new Date(o.created_at).getTime() >= startWeek; });

      document.getElementById('statTodayRevenue').textContent = money(todayOrders.reduce(function(s,o){ return s + Number(o.total); }, 0));
      document.getElementById('statTodayOrders').textContent = todayOrders.length;
      document.getElementById('statWeekRevenue').textContent = money(weekOrders.reduce(function(s,o){ return s + Number(o.total); }, 0));
      document.getElementById('statAllRevenue').textContent = money(orders.reduce(function(s,o){ return s + Number(o.total); }, 0));

      var qtyByName = {};
      orders.forEach(function(o){
        itemsOf(o).forEach(function(i){
          qtyByName[i.name] = (qtyByName[i.name] || 0) + i.qty;
        });
      });
      var topItems = Object.keys(qtyByName).map(function(name){ return { name: name, qty: qtyByName[name] }; })
        .sort(function(a,b){ return b.qty - a.qty; }).slice(0, 8);
      var topItemsList = document.getElementById('topItemsList');
      topItemsList.innerHTML = '';
      if (topItems.length === 0) {
        topItemsList.innerHTML = '<p class="admin-empty">No sales logged yet. Orders are logged when a customer taps "Place Order" in the cart.</p>';
      } else {
        topItems.forEach(function(item){
          var row = document.createElement('div');
          row.className = 'admin-row';
          row.innerHTML =
            '<div class="admin-row-main"><div class="admin-row-title">' + esc(item.name) + '</div></div>' +
            '<div class="admin-row-value">' + esc(item.qty) + ' sold</div>';
          topItemsList.appendChild(row);
        });
      }

      var accountsByPhone = {};
      accounts.forEach(function(a){ accountsByPhone[a.phone] = a; });

      var ordersList = document.getElementById('ordersList');
      ordersList.innerHTML = '';
      // Every order still open (not ready, or not paid) is listed, so a burst of
      // new orders can't push one off the screen; then the latest finished ones.
      var openOrders = orders.filter(function(o){ return o.status !== 'Ready' || o.payment_status !== 'paid'; });
      var doneOrders = orders.filter(function(o){ return openOrders.indexOf(o) === -1; });
      var recent = openOrders.slice(0, 100).concat(doneOrders.slice(0, Math.max(0, 15 - openOrders.length)));
      if (recent.length === 0) {
        ordersList.innerHTML = '<p class="admin-empty">No orders logged yet.</p>';
      } else {
        recent.forEach(function(o){
          var itemsSummary = itemsOf(o).map(function(i){ return i.qty + 'x ' + i.name; }).join(', ');
          var status = o.status || 'Processing';
          var badgeClass = status === 'Ready' ? 'status-ready' : 'status-processing';
          var acctForOrder = o.phone ? accountsByPhone[o.phone] : null;
          var hasReward = acctForOrder && Number(acctForOrder.platters_ready) > 0;
          var row = document.createElement('div');
          row.className = 'admin-row';
          row.innerHTML =
            '<div class="admin-row-main">' +
              '<div class="admin-row-title">' + esc(o.customer_name ? o.customer_name : 'Guest') + ' · ' + esc(new Date(o.created_at).toLocaleString()) + (o.table_number ? ' · Table ' + esc(o.table_number) : '') + '</div>' +
              '<div class="admin-row-meta">' + esc(itemsSummary) + (o.phone ? ' · 📱 ' + esc(o.phone) : ' · no phone on file') + '</div>' +
              '<span class="status-badge ' + badgeClass + '">' + esc(status) + '</span>' +
              '<span class="status-badge ' + (o.payment_status === 'paid' ? 'status-ready' : 'status-processing') + '" style="margin-left:6px;">Cash · ' + (o.payment_status === 'paid' ? 'Paid' : 'Unpaid') + '</span>' +
              (hasReward ? '<span class="status-badge status-ready" style="margin-left:6px;">🎁 Free Platter Waiting</span>' : '') +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">' +
              '<div class="admin-row-value">' + money(o.total) + '</div>' +
              buildTableSelect(o.id, o.table_number) +
              '<button class="btn status-toggle-btn" type="button" data-order-id="' + esc(o.id) + '">' +
                (status === 'Ready' ? 'Mark Processing' : 'Mark Ready') +
              '</button>' +
              (o.phone ? '<button class="btn status-toggle-btn" type="button" data-text-id="' + esc(o.id) + '">Text Customer</button>' : '') +
              (o.payment_method !== 'card' && o.payment_status !== 'paid' ? '<button class="btn status-toggle-btn" type="button" data-cash-paid-id="' + esc(o.id) + '">Mark Cash Paid &amp; Print</button>' : '') +
              '<button class="btn status-toggle-btn" type="button" data-receipt-id="' + esc(o.id) + '">Print Receipt</button>' +
              '<button class="btn status-toggle-btn" type="button" data-delete-id="' + esc(o.id) + '" style="color:#a8433a;border-color:#a8433a;">Delete</button>' +
            '</div>';
          ordersList.appendChild(row);
        });
      }

      var invList = document.getElementById('inventoryList');
      invList.innerHTML = '';
      var LOW_STOCK_THRESHOLD = 5;
      var lowStockItems = [];
      var marketCards = document.querySelectorAll('#page-market .market-card[data-name]');
      if (marketCards.length === 0) {
        invList.innerHTML = '<p class="admin-empty">No Fish Market items found.</p>';
      } else {
        marketCards.forEach(function(card){
          var name = card.getAttribute('data-name');
          var unit = card.getAttribute('data-unit') || '';
          var stock = inv.hasOwnProperty(name) ? inv[name] : 20;
          var row = document.createElement('div');
          row.className = 'admin-row inv-row' + (stock <= 0 ? ' sold-out-row' : '');
          row.innerHTML =
            '<div class="admin-row-main"><div class="admin-row-title">' + esc(name) + '</div><div class="admin-row-meta">per ' + esc(unit || 'unit') + '</div></div>' +
            '<input type="number" class="inv-input" min="0" step="1" value="' + esc(stock) + '" aria-label="Units of ' + esc(name) + ' in stock" data-inv-name="' + esc(name) + '">';
          invList.appendChild(row);
          if (stock > 0 && stock < LOW_STOCK_THRESHOLD) {
            lowStockItems.push({ name: name, stock: stock, unit: unit || 'unit' });
          }
        });
      }

      var alertBox = document.getElementById('lowStockAlert');
      var alertList = document.getElementById('lowStockAlertList');
      if (lowStockItems.length === 0) {
        alertBox.hidden = true;
      } else {
        alertBox.hidden = false;
        alertList.innerHTML = lowStockItems.map(function(i){
          return '<span class="low-stock-chip"><b>' + esc(i.name) + '</b> — ' + esc(i.stock) + ' ' + esc(i.unit) + ' left</span>';
        }).join('');
      }

      document.getElementById('statMembers').textContent = accounts.length;
      document.getElementById('statVisitsLogged').textContent = accounts.reduce(function(s,a){ return s + (a.visits || 0); }, 0);
      document.getElementById('statRewardsGiven').textContent = accounts.reduce(function(s,a){ return s + Number(a.platters_earned_total || 0); }, 0);

      var readyList = document.getElementById('rewardsReadyList');
      readyList.innerHTML = '';
      var withRewards = accounts.filter(function(a){ return Number(a.platters_ready || 0) > 0; });
      if (withRewards.length === 0) {
        readyList.innerHTML = '<p class="admin-empty">No customers have a free platter waiting right now.</p>';
      } else {
        withRewards.forEach(function(a){
          var row = document.createElement('div');
          row.className = 'admin-row';
          row.innerHTML =
            '<div class="admin-row-main"><div class="admin-row-title">' + esc(a.name || 'Guest') + '</div><div class="admin-row-meta">📱 ' + esc(a.phone) + '</div></div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">' +
              '<div class="admin-row-value">🎁 ' + esc(a.platters_ready) + (Number(a.platters_ready) === 1 ? ' platter' : ' platters') + '</div>' +
              '<button class="btn status-toggle-btn" type="button" data-give-platter="' + esc(a.phone) + '" data-give-name="' + esc(a.name || 'this customer') + '">Give Platter</button>' +
            '</div>';
          readyList.appendChild(row);
        });
      }
    }).catch(function(){
      document.getElementById('ordersList').innerHTML = '<p class="admin-empty">Couldn\'t load the dashboard. Check the internet connection, then reload the page.</p>';
    });
  }

  document.getElementById('ordersList').addEventListener('change', function(e){
    var tableSel = e.target.closest('[data-assign-table-id]');
    if (!tableSel || !window.rimalDb) return;
    window.rimalDb.from('orders').update({ table_number: tableSel.value || null })
      .eq('id', tableSel.getAttribute('data-assign-table-id'))
      .then(function(res){
        if (res.error) { alert('Could not change the table. Please try again.'); }
        renderDashboard();
      });
  });

  document.getElementById('ordersList').addEventListener('click', function(e){
    if (!window.rimalDb) return;
    var delBtn = e.target.closest('[data-delete-id]');
    if (delBtn) {
      if (!confirm('Delete this order permanently? Use this for test or fake orders.')) return;
      delBtn.disabled = true;
      window.rimalDb.from('orders').delete().eq('id', delBtn.getAttribute('data-delete-id')).then(function(res){
        if (res.error) { delBtn.disabled = false; alert('Could not delete the order. Please try again.'); return; }
        renderDashboard();
      });
      return;
    }
    var cashPaidBtn = e.target.closest('[data-cash-paid-id]');
    if (cashPaidBtn) {
      var cashOrderId = cashPaidBtn.getAttribute('data-cash-paid-id');
      cashPaidBtn.disabled = true;
      // mark_order_paid also lowers Fish Market stock and adds the purchase to
      // the customer's rewards, once per order.
      window.rimalDb.rpc('mark_order_paid', { p_order_id: cashOrderId }).then(function(res){
        if (res.error) { throw res.error; }
        return window.rimalDb.from('orders').select('*').eq('id', cashOrderId).single();
      }).then(function(res){
        if (res.data) { printReceipt(res.data); }
        renderDashboard();
        try { if (window.rimalApplyInventory) { window.rimalApplyInventory(); } } catch(e){}
      }).catch(function(){
        cashPaidBtn.disabled = false;
        alert('Could not mark the cash order as paid.');
      });
      return;
    }
    var textBtn = e.target.closest('[data-text-id]');
    if (textBtn) {
      window.rimalDb.from('orders').select('*').eq('id', textBtn.getAttribute('data-text-id')).single().then(function(res){
        var order = res.data;
        if (order && order.phone) {
          var msg = 'Rimal Seafood: your order' + (order.table_number ? ' for Table ' + order.table_number : '') + ' is ready!';
          window.open('sms:' + String(order.phone).replace(/\D/g, '') + '?body=' + encodeURIComponent(msg), '_blank');
        }
      });
      return;
    }
    var receiptBtn = e.target.closest('[data-receipt-id]');
    if (receiptBtn) {
      window.rimalDb.from('orders').select('*').eq('id', receiptBtn.getAttribute('data-receipt-id')).single().then(function(res){
        if (res.data) { printReceipt(res.data); }
      });
      return;
    }
    var btn = e.target.closest('[data-order-id]');
    if (!btn) return;
    var id = btn.getAttribute('data-order-id');
    window.rimalDb.from('orders').select('*').eq('id', id).single().then(function(res){
      var order = res.data;
      if (!order) return;
      var goingReady = order.status !== 'Ready';
      window.rimalDb.from('orders').update({ status: goingReady ? 'Ready' : 'Processing' }).eq('id', id).then(function(res){
        renderDashboard();
        if (res.error) { alert('Could not update the order. Please try again.'); return; }
        if (goingReady && order.phone) {
          var msg = 'Rimal Seafood: your order' + (order.table_number ? ' for Table ' + order.table_number : '') + ' is ready!';
          window.open('sms:' + String(order.phone).replace(/\D/g, '') + '?body=' + encodeURIComponent(msg), '_blank');
        }
      });
    });
  });

  document.getElementById('rewardsReadyList').addEventListener('click', function(e){
    var btn = e.target.closest('[data-give-platter]');
    if (!btn || !window.rimalDb) return;
    if (!confirm('Give one free gift platter to ' + btn.getAttribute('data-give-name') + '?')) return;
    btn.disabled = true;
    window.rimalDb.rpc('redeem_rewards', { p_phone: btn.getAttribute('data-give-platter') }).then(function(res){
      if (res.error) { throw res.error; }
      renderDashboard();
    }).catch(function(){
      btn.disabled = false;
      alert('Could not record the platter. Please try again.');
    });
  });

  var mfaStatus = document.getElementById('mfaStatus');
  var mfaSetupBtn = document.getElementById('mfaSetupBtn');
  var mfaEnroll = document.getElementById('mfaEnroll');
  var mfaQr = document.getElementById('mfaQr');
  var mfaSecret = document.getElementById('mfaSecret');
  var mfaEnrollCode = document.getElementById('mfaEnrollCode');
  var mfaEnrollConfirm = document.getElementById('mfaEnrollConfirm');
  var mfaEnrollError = document.getElementById('mfaEnrollError');
  var mfaRemoveBtn = document.getElementById('mfaRemoveBtn');
  var mfaNag = document.getElementById('mfaNag');
  var pendingFactorId = null;
  var verifiedFactors = [];

  function refreshMfa(){
    if (!window.rimalDb) return;
    window.rimalDb.auth.mfa.listFactors().then(function(res){
      verifiedFactors = (res.data && res.data.totp) || [];
      var on = verifiedFactors.length > 0;
      mfaStatus.textContent = on
        ? 'On. Signing in needs the password and a 6-digit code from your authenticator app.'
        : 'Off. Anyone who learns the password can open this dashboard. Turn it on to also require a code from your phone.';
      mfaSetupBtn.hidden = on || !mfaEnroll.hidden;
      mfaRemoveBtn.hidden = !on;
      mfaNag.hidden = on;
    });
  }
  // New phone: turn two-step sign-in off here (while signed in with a code),
  // then turn it on again with the new phone.
  mfaRemoveBtn.addEventListener('click', function(){
    if (!confirm('Turn off two-step sign-in? Only do this to move it to a new phone, then turn it on again right away.')) return;
    mfaRemoveBtn.disabled = true;
    Promise.all(verifiedFactors.map(function(f){ return window.rimalDb.auth.mfa.unenroll({ factorId: f.id }); })).then(function(results){
      mfaRemoveBtn.disabled = false;
      if (results.some(function(r){ return r.error; })) { alert('Could not turn it off. Sign out, sign in again with your code, and retry.'); }
      refreshMfa();
    });
  });
  document.getElementById('mfaNagBtn').addEventListener('click', function(){
    var tab = document.querySelector('[data-admin-tab="security"]');
    if (tab) { tab.click(); }
  });
  mfaSetupBtn.addEventListener('click', function(){
    mfaSetupBtn.disabled = true;
    var mfa = window.rimalDb.auth.mfa;
    // Clear any half-finished setup first, then start a new one.
    mfa.listFactors().then(function(res){
      var stale = ((res.data && res.data.all) || []).filter(function(f){ return f.status !== 'verified'; });
      return Promise.all(stale.map(function(f){ return mfa.unenroll({ factorId: f.id }); }));
    }).then(function(){
      return mfa.enroll({ factorType: 'totp', friendlyName: 'Rimal Manager ' + Date.now() });
    }).then(function(res){
      mfaSetupBtn.disabled = false;
      if (res.error) { throw res.error; }
      pendingFactorId = res.data.id;
      mfaQr.src = res.data.totp.qr_code;
      mfaSecret.textContent = res.data.totp.secret;
      mfaEnrollCode.value = '';
      mfaEnrollError.hidden = true;
      mfaEnroll.hidden = false;
      mfaSetupBtn.hidden = true;
    }).catch(function(err){
      mfaSetupBtn.disabled = false;
      alert('Could not start the setup: ' + ((err && err.message) || 'please try again.'));
    });
  });
  mfaEnrollConfirm.addEventListener('click', function(){
    var code = mfaEnrollCode.value.replace(/\D/g, '');
    if (!pendingFactorId || code.length !== 6) { mfaEnrollError.textContent = 'Enter the 6 digits your app shows.'; mfaEnrollError.hidden = false; return; }
    mfaEnrollConfirm.disabled = true;
    window.rimalDb.auth.mfa.challengeAndVerify({ factorId: pendingFactorId, code: code }).then(function(res){
      mfaEnrollConfirm.disabled = false;
      if (res.error) { throw res.error; }
      pendingFactorId = null;
      mfaEnroll.hidden = true;
      refreshMfa();
    }).catch(function(){
      mfaEnrollConfirm.disabled = false;
      mfaEnrollError.textContent = "That code didn't work. Wait for the next code in your app and try again.";
      mfaEnrollError.hidden = false;
    });
  });
  mfaEnrollCode.addEventListener('keydown', function(e){ if (e.key === 'Enter') mfaEnrollConfirm.click(); });
  window.rimalRefreshMfa = refreshMfa;
  document.getElementById('adminTabs').addEventListener('click', function(e){
    if (e.target.closest('[data-admin-tab="security"]')) { refreshMfa(); }
  });

  document.getElementById('inventoryList').addEventListener('change', function(e){
    if (!e.target.matches('[data-inv-name]') || !window.rimalDb) return;
    var name = e.target.getAttribute('data-inv-name');
    var val = Math.max(0, parseInt(e.target.value, 10) || 0);
    window.rimalDb.from('inventory').upsert({ item_name: name, stock: val }).then(function(){
      e.target.closest('.inv-row').classList.toggle('sold-out-row', val <= 0);
      if (window.rimalApplyInventory) { window.rimalApplyInventory(); }
    });
  });

  if (window.rimalDb) {
    window.rimalDb.auth.getSession().then(function(res){
      if (res.data && res.data.session) { continueSignIn(); } else { showGate(); }
    });
  } else {
    showGate();
  }
})();
}
if (document.visibilityState === 'hidden') { rimalStart(); }
else { requestAnimationFrame(function(){ setTimeout(rimalStart, 0); }); }
