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
    console.warn('Rimal Seafood: Supabase is not configured yet (see config.js). Live menu, hours and Rewards features may be unavailable.');
  }
})();

(function(){
  var DEFAULT_HOURS = { opens: '12:00', closes: '21:00' };
  var openInput = document.getElementById('businessHoursOpen');
  var closeInput = document.getElementById('businessHoursClose');
  var form = document.getElementById('businessHoursForm');
  var saveButton = document.getElementById('businessHoursSave');
  var status = document.getElementById('businessHoursStatus');

  function validTime(value){ return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }
  function validHours(hours){ return hours && validTime(hours.opens) && validTime(hours.closes); }
  function setStatus(message, isError){
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.style.color = isError ? 'var(--error)' : 'var(--success)';
  }
  function applyHours(hours){
    if (!validHours(hours)) return;
    var display = window.rimalFormatHours(hours);
    var range = window.rimalFormatTime(hours.opens) + ' – ' + window.rimalFormatTime(hours.closes);
    window.RIMAL_INFO.hours = display;
    document.querySelectorAll('[data-info="hours"]').forEach(function(el){ el.textContent = display; });
    document.querySelectorAll('[data-hours-range]').forEach(function(el){ el.textContent = range; });
    var openLabel = document.querySelector('[data-hours-open]');
    var closeLabel = document.querySelector('[data-hours-close]');
    if (openLabel) openLabel.textContent = window.rimalFormatTime(hours.opens);
    if (closeLabel) closeLabel.textContent = window.rimalFormatTime(hours.closes);

    var schemaScript = document.querySelector('script[type="application/ld+json"]');
    if (schemaScript) {
      try {
        var schema = JSON.parse(schemaScript.textContent);
        schema.openingHoursSpecification[0].opens = hours.opens;
        schema.openingHoursSpecification[0].closes = hours.closes;
        schemaScript.textContent = JSON.stringify(schema);
      } catch(e){}
    }
  }
  function loadHours(showErrors){
    if (!window.rimalDb) return Promise.resolve(DEFAULT_HOURS);
    return window.rimalDb.from('business_settings').select('setting_value').eq('setting_key', 'hours').maybeSingle()
      .then(function(res){
        if (res.error) throw res.error;
        var hours = res.data && res.data.setting_value;
        if (!validHours(hours)) hours = DEFAULT_HOURS;
        applyHours(hours);
        if (openInput) openInput.value = hours.opens;
        if (closeInput) closeInput.value = hours.closes;
        if (showErrors) setStatus('', false);
        return hours;
      }).catch(function(){
        if (showErrors) setStatus('Could not load saved hours. Run the updated setup/supabase-setup.sql in Supabase.', true);
        return DEFAULT_HOURS;
      });
  }
  window.rimalLoadBusinessHours = function(){ return loadHours(true); };
  loadHours(false);

  if (form) form.addEventListener('submit', function(event){
    event.preventDefault();
    var hours = { opens: openInput.value, closes: closeInput.value };
    if (!validHours(hours)) { setStatus('Enter valid opening and closing times.', true); return; }
    if (!window.rimalDb) { setStatus('Business settings database is not configured.', true); return; }
    saveButton.disabled = true;
    setStatus('Saving…', false);
    window.rimalDb.from('business_settings').upsert({
      setting_key: 'hours', setting_value: hours, updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' }).then(function(res){
      if (res.error) throw res.error;
      applyHours(hours);
      setStatus('Opening hours updated.', false);
    }).catch(function(){
      setStatus('Could not save hours. Check the database setup and manager access.', true);
    }).then(function(){ saveButton.disabled = false; });
  });
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
    var id = (location.hash || '#' + (window.RIMAL_DEFAULT_PAGE || 'home')).slice(1);
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
  // "Order Delivery" links (header menu + Visit page) from RIMAL_INFO.orderLinks.
  // Services without an https:// url are skipped; with none, the header menu stays hidden.
  var info = window.RIMAL_INFO || {};
  var links = (info.orderLinks || []).filter(function(l){ return l && l.name && /^https:\/\//.test(l.url || ''); });
  if (!links.length) return;
  document.querySelectorAll('[data-order-links]').forEach(function(box){
    links.forEach(function(l){
      var a = document.createElement('a');
      a.className = 'btn';
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = l.name;
      var note = document.createElement('span');
      note.className = 'visually-hidden';
      note.textContent = ' (opens in a new tab)';
      a.appendChild(note);
      box.appendChild(a);
    });
  });
  var menu = document.querySelector('.order-menu');
  if (menu) {
    menu.hidden = false;
    // Close the header menu on Escape or on a click elsewhere.
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
    document.addEventListener('click', function(e){
      if (menu.open && !menu.contains(e.target)) { menu.open = false; }
    });
  }
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
  // Fish Market source cards, rendered from RIMAL_MARKET before the manager
  // tools scan and the "To Stay" tab copies them.
  var data = window.RIMAL_MARKET || [];
  var grids = document.querySelectorAll('#market-togo .market-grid');
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  data.forEach(function(group, gi){
    var grid = grids[gi];
    if (!grid) return;
    grid.innerHTML = group.items.map(function(it){
      return '<div class="market-card" data-name="' + esc(it.name) + '" data-price="' + it.price + '" data-unit="' + esc(it.unit) + '">' +
        (it.photo ? '<img src="' + esc(window.rimalPhotoUrl(it.photo, 480)) + '" alt="' + esc(it.name) + '" width="480" height="360" loading="lazy" decoding="async">' : '') +
        '<div class="market-card-body"><h4>' + esc(it.name) + '</h4>' +
        '<div class="menu-price">' + window.rimalMoney(it.price) + (it.unit ? '/' + esc(it.unit) : '') + '</div>' +
        '<div class="qty-row"><label class="visually-hidden" for="market-qty-' + gi + '-' + esc(it.name).replace(/[^a-zA-Z0-9_-]/g, '-') + '">Quantity of ' + esc(it.name) + (it.unit ? ' in ' + esc(it.unit) : '') + '</label>' +
        '<input class="qty-input" id="market-qty-' + gi + '-' + esc(it.name).replace(/[^a-zA-Z0-9_-]/g, '-') + '" type="number" min="' + (it.step || 1) + '" step="' + (it.step || 1) + '" value="' + (it.step || 1) + '" inputmode="decimal">' +
        (it.unit ? '<span class="qty-unit">' + esc(it.unit) + '</span>' : '') +
        '<button class="btn btn-solid btn-cart" type="button" data-add aria-label="Add ' + esc(it.name) + ' to order">Add to order</button></div></div></div>';
    }).join('');
  });
})();

(function(){
  var GRILL_FEE = 4.99;
  var source = document.getElementById('market-togo');
  var dest = document.getElementById('market-grill');

  // Builds the market's dine-in tab from its source cards and adds the grill fee.
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
          var serviceMode = card.getAttribute('data-service-mode') || 'stay';
          if (serviceMode === 'togo') { card.remove(); return; }
          card.removeAttribute('hidden');
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
        });
      }
      dest.appendChild(clone);
    });
    source.querySelectorAll('.market-card[data-name]').forEach(function(card){
      card.hidden = (card.getAttribute('data-service-mode') || 'stay') === 'stay';
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
        var match = !card.hidden && card.textContent.toLowerCase().indexOf(term) !== -1;
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
    return '<article class="menu-item" ' + idAttr + ' data-name="' + esc(item.name) + '" data-price="' + base + '" data-unit="" data-service-mode="' + esc(item.serviceMode || item.service_mode || 'both') + '">' +
      (img ? '<img class="menu-item-img" src="' + esc(img) + '" alt="" width="320" height="240" loading="lazy" decoding="async">' : '') +
      '<div class="mi-placeholder" aria-hidden="true"></div>' +
      '<div class="menu-item-info">' +
        '<h4>' + esc(item.name) + '</h4>' +
        '<div class="menu-price">' + money(base) + '</div>' +
        (item.desc ? '<p>' + esc(item.desc) + '</p>' : '') +
        sizeHtml +
        '<div class="item-actions"><span class="mi-meta"></span>' +
          '<button class="btn btn-solid mi-add" type="button" data-menu-add aria-label="Add ' + esc(item.name) + ' to order">Add to order</button></div>' +
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

  // Keeps prices and chips in step with the cards on the page
  // (Manager edits can rename, re-price, remove or add cards after load).
  function syncCards(){
    catalog.querySelectorAll('.menu-item[data-name]').forEach(function(card){
      var name = card.getAttribute('data-name');
      var meta = card.querySelector('.mi-meta');
      var item = builtinFor(card);
      var sizes = cardSizes(card);
      var orig = itemsById[card.getAttribute('data-item-id')];
      var img = card.querySelector('img.menu-item-img');
      if (img) { img.classList.toggle('is-stale', !!(orig && !item && orig.photo && img.getAttribute('src') === window.rimalPhotoUrl(orig.photo, 320))); }
      if (meta) {
        var details = item && item.sides ? 'Includes ' + item.sides + ' sides' : (sizes.length === 1 ? sizes[0].label : '');
        var serviceMode = card.getAttribute('data-service-mode') || 'both';
        var availability = serviceMode === 'togo' ? 'To Go only' : (serviceMode === 'stay' ? 'To Stay only' : '');
        meta.textContent = [details, availability].filter(Boolean).join(' · ');
      }
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
    try {
      var saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (Array.isArray(saved)) {
        cart = saved.filter(function(line){
          return line && line.v === CART_VERSION && line.ref && typeof line.ref.kind === 'string' &&
            typeof line.base === 'string' && typeof line.name === 'string' &&
            isFinite(Number(line.price)) && Number(line.price) >= 0 &&
            isFinite(Number(line.qty)) && Number(line.qty) > 0;
        }).slice(0, 100);
      }
    } catch(e) { cart = []; }
  })();

  var $ = function(id){ return document.getElementById(id); };
  var cartToggle = $('cartToggle'), cartDrawer = $('cartDrawer'), cartClose = $('cartClose');
  var cartItemsEl = $('cartItems'), cartEmpty = $('cartEmpty'), cartFooter = $('cartFooter'), cartMain = $('cartMain');
  var cartSubtotalEl = $('cartSubtotal'), cartTaxEl = $('cartTax'), cartTotalEl = $('cartTotal'), cartTaxNote = $('cartTaxNote');
  var cartDiscountRow = $('cartDiscountRow'), cartDiscountEl = $('cartDiscount');
  var cartBadge = $('cartBadge'), cartCount = $('cartCount'), cartTableBanner = $('cartTableBanner'), cartNotice = $('cartNotice');
  var cartBar = $('cartBar'), cartBarBtn = $('cartBarBtn'), cartBarLabel = $('cartBarLabel'), cartBarTotal = $('cartBarTotal');
  var orderTableSelect = $('orderTableSelect'), orderError = $('orderError'), placeOrderBtn = $('placeOrderBtn');
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
    placeOrderBtn.textContent = 'Call (347) 497-4002 to place order';
    placeOrderBtn.setAttribute('aria-label', 'Call Rimal Seafood at 347-497-4002 to place your order');

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
    hideToast();
    if (!cartDrawer.open) { cartOpener = document.activeElement; cartDrawer.showModal(); }
  }
  function closeCart(){ if (cartDrawer.open) { cartDrawer.close(); } }
  cartToggle.addEventListener('click', openCart);
  cartBarBtn.addEventListener('click', openCart);
  cartClose.addEventListener('click', closeCart);
  cartDrawer.addEventListener('click', function(e){ if (e.target === cartDrawer) closeCart(); });
  cartDrawer.addEventListener('close', function(){
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

  orderTableSelect.addEventListener('change', function(){
    setTable(orderTableSelect.value);
    render();
    var modeError = cartServiceModeError(orderTableSelect.value);
    if (modeError) {
      orderError.textContent = modeError;
      orderError.hidden = false;
    } else {
      orderError.hidden = true;
    }
  });

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

  // Fish Market cards in the "To Stay" tab.
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
    var custom = card.hasAttribute('data-custom-item');
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
      v: CART_VERSION, ref: { kind: kind, name: name, id: custom ? card.getAttribute('data-custom-item') : '', custom: custom }, base: name, choices: {}, sides: [], size: size, style: style,
      name: composeName(name, null, null, size, style),
      price: price, unit: unit, qty: round2(qty), taxable: kind !== 'market'
    };
    addLine(line);
    confirmAdded(card, line);
  });

  // The cart is a local checklist; customers confirm orders by phone.
  function cartServiceModeError(table){
    for (var i = 0; i < cart.length; i++) {
      var line = cart[i];
      if (line.ref.kind === 'market') {
        return 'Fresh Fish Market selections are only available To Stay. Remove To Go market items or call us to discuss options.';
      }
      if (line.ref.kind === 'grill' && !table) {
        return 'Select a table for Fresh Fish Market items To Stay, or call us to confirm your plans.';
      }
      if (line.ref.kind !== 'menu') continue;
      var card = findCard(line.ref);
      var mode = card && card.getAttribute('data-service-mode') || 'both';
      if (mode === 'stay' && !table) {
        return 'Select a table for items marked To Stay only, or call us to confirm your plans.';
      }
      if (mode === 'togo' && table) {
        return 'Clear the table selection for items marked To Go only, or call us to confirm your plans.';
      }
    }
    return '';
  }

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
    menu_catch:       { sel: '#group-catch .menu-grid' },
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
      menu_catch: 3,
      menu_sides: 4,
      menu_salads: 5,
      menu_specials: 6,
      menu_drinks: 7,
      menu_desserts: 8,
      market_fish: 9,
      market_shellfish: 10
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

  function saveCustomMenuItem(db, values, itemId){
    function save(payload){
      var request = itemId
        ? db.from('menu_items').update(payload).eq('id', itemId)
        : db.from('menu_items').insert(payload);
      return request.then(function(res){
        var message = res.error && res.error.message || '';
        if (!Object.prototype.hasOwnProperty.call(payload, 'display_order') ||
            !/display_order.*schema cache/i.test(message)) return res;
        var compatiblePayload = Object.assign({}, payload);
        delete compatiblePayload.display_order;
        return save(compatiblePayload);
      });
    }
    return save(values);
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
      card.setAttribute('data-service-mode', sec.id.indexOf('market-') === 0 ? 'stay' : 'both');
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
    if (isMarket) {
      card.setAttribute('data-service-mode', 'stay');
    } else if (['both', 'togo', 'stay'].indexOf(ov.service_mode) !== -1) {
      card.setAttribute('data-service-mode', ov.service_mode);
    }

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
    var step = unit === 'lb' ? 0.5 : 1;
    var img = item.image_url ? esc(item.image_url) : '';
    var sizeHtml = opts.length ? '<select class="size-select">' + optionsHtml(opts) + '</select>' : '';
    var attrs = 'data-custom-item="' + esc(item.id) + '" data-name="' + esc(item.name) + '" data-price="' + basePrice + '" data-unit="' + esc(unit) + '"' +
      ' data-service-mode="' + (cat.market ? 'stay' : esc(item.service_mode || 'both')) + '"';
    if (cat.market) {
      return '<div class="market-card" ' + attrs + '>' +
        (img ? '<img src="' + img + '" alt="' + esc(item.name) + '" width="480" height="360" loading="lazy" decoding="async">' : '') +
        '<div class="market-card-body"><h4>' + esc(item.name) + '</h4>' +
        (item.description ? '<p>' + esc(item.description) + '</p>' : '') +
        sizeHtml +
        '<div class="menu-price">' + fmt(basePrice) + (unit ? '/' + esc(unit) : '') + '</div>' +
        '<div class="qty-row"><input class="qty-input" type="number" min="' + step + '" step="' + step + '" value="' + step + '" inputmode="decimal" aria-label="Quantity of ' + esc(item.name) + (unit ? ' in ' + esc(unit) : '') + '">' +
        (unit ? '<span class="qty-unit">' + esc(unit) + '</span>' : '') +
        '<button class="btn btn-solid btn-cart" type="button" data-add aria-label="Add ' + esc(item.name) + ' to order">Add to order</button></div></div></div>';
    }
    return window.rimalMenu.cardHtml({
      customId: item.id, name: item.name, price: basePrice, desc: item.description,
      imageUrl: item.image_url || '', sizes: opts, serviceMode: item.service_mode || 'both'
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
  var availabilityWrap = document.getElementById('newItemAvailabilityWrap');
  var availabilityEl = document.getElementById('newItemAvailability');
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
  var availabilityFixedEl = document.getElementById('newItemAvailabilityFixed');
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
    var builtinMarketEdit = editing && editing.kind === 'builtin' && editing.entry.key.indexOf('market-') === 0;
    unitWrap.hidden = builtinMarketEdit || !(cat && cat.market);
    var marketItem = builtinMarketEdit || !!(cat && cat.market);
    availabilityWrap.hidden = marketItem;
    availabilityFixedEl.hidden = !marketItem;
    if (marketItem) { availabilityFixedEl.textContent = 'To Stay only'; }
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
    categoryEl.hidden = false;
    fixedCatEl.hidden = true;
    availabilityEl.value = 'both';
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
      availabilityEl.value = row.item.service_mode || 'both';
    } else {
      categoryEl.hidden = true;
      document.getElementById('newItemCategoryFixed').hidden = false;
      document.getElementById('newItemCategoryFixed').textContent = row.section + ' (stays in this section)';
      if (row.entry.key.indexOf('market-') !== 0) {
        availabilityEl.value = overrides[row.entry.key] && overrides[row.entry.key].service_mode || 'both';
      }
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
    var isMarket = !!(CATS[category] && CATS[category].market) ||
      !!(editing && editing.kind === 'builtin' && editing.entry.key.indexOf('market-') === 0);
    var unit = isMarket ? unitEl.value : null;
    var serviceMode = isMarket ? 'stay' : availabilityEl.value;

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
        return saveCustomMenuItem(db, {
          name: name, description: desc || null, category: category, price: price, unit: unit,
          options: options.length ? options : null, image_url: newUrl, display_order: getNextCustomDisplayOrder(),
          service_mode: serviceMode
        });
      }
      if (editing.kind === 'custom') {
        var oldUrl = editing.item.image_url || null;
        var nextUrl = newUrl || (removePhoto ? null : oldUrl);
        return saveCustomMenuItem(db, {
          name: name, description: desc || null, category: category, price: price, unit: unit,
          options: options.length ? options : null, image_url: nextUrl, display_order: editing.item.display_order || getNextCustomDisplayOrder(),
          service_mode: serviceMode
        }, editing.item.id).then(function(res){
          if (!res.error && oldUrl && nextUrl !== oldUrl) { discardPhoto(oldUrl); }
          return res;
        });
      }
      var key = editing.entry.key;
      var existing = overrides[key] || null;
      var oldOvUrl = existing ? existing.image_url : null;
      var nextOvUrl = newUrl || (removePhoto ? '' : oldOvUrl);
      var overridePayload = {
        item_key: key, name: name, description: desc, price: price, options: options,
        image_url: nextOvUrl == null ? null : nextOvUrl, removed: false, updated_at: new Date().toISOString()
      };
      overridePayload.service_mode = serviceMode;
      return db.from('menu_overrides').upsert(overridePayload, { onConflict: 'item_key' }).then(function(res){
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
  var homeWayImgs = document.querySelectorAll('#page-home .home-ways .way img');
  var aboutImg = document.querySelector('#page-about .about-photo img');
  var aboutFig = aboutImg && aboutImg.closest('figure');
  var visitSec = document.querySelector('section.reserve');
  var logos = document.querySelectorAll('.brand-logo');
  var galleryGrid = document.querySelector('#page-about .gallery-grid');

  var ORIG = {
    home_hero: heroImg ? heroImg.getAttribute('src') : '',
    home_way_dinein: homeWayImgs[0] ? homeWayImgs[0].getAttribute('src') : '',
    home_way_order: homeWayImgs[1] ? homeWayImgs[1].getAttribute('src') : '',
    home_way_market: homeWayImgs[2] ? homeWayImgs[2].getAttribute('src') : '',
    about: aboutImg ? aboutImg.getAttribute('src') : '',
    visit_bg: VISIT_ORIGINAL,
    logo: logos.length ? logos[0].getAttribute('src') : ''
  };
  var SLOTS = [
    { key: 'home_hero', label: 'Home page photo', removable: true },
    { key: 'home_way_dinein', label: 'Home page — Dine in photo', removable: true },
    { key: 'home_way_order', label: 'Home page — Order ahead photo', removable: true },
    { key: 'home_way_market', label: 'Home page — Take the catch home photo', removable: true },
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

    [
      { key: 'home_way_dinein', img: homeWayImgs[0] },
      { key: 'home_way_order', img: homeWayImgs[1] },
      { key: 'home_way_market', img: homeWayImgs[2] }
    ].forEach(function(photo){
      if (!photo.img) return;
      var row = o[photo.key];
      var figure = photo.img.closest('figure');
      figure.style.display = row && row.removed ? 'none' : '';
      setPhoto(photo.img, row && row.image_url, ORIG[photo.key]);
    });

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
      if (res.error) { throw res.error; }
      overrides = {};
      addedRows = [];
      ((res && res.data) || []).forEach(function(row){
        if (row.photo_key.indexOf('gallery-new-') === 0) { addedRows.push(row); }
        else { overrides[row.photo_key] = row; }
      });
      applyPhotos();
      renderList();
      return true;
    }).catch(function(err){
      var msg = (err && err.message) ? err.message : 'Please refresh and try again.';
      setStatus('Could not load website photos: ' + msg, true);
      return false;
    });
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
    if (!file || !key) return;
    if (!window.rimalDb) { setStatus('Could not change photo: the database is not connected. Refresh the page and sign in again.', true); return; }
    if (!window.rimalPhotoTools) { setStatus('Could not change photo: photo upload is not ready. Refresh the page and try again.', true); return; }
    setStatus('Uploading photo…', false);
    var existing = overrides[key] || null;
    window.rimalPhotoTools.upload(file, 1600).then(function(url){
      return window.rimalDb.from('site_photos').upsert({ photo_key: key, image_url: url, removed: false }, { onConflict: 'photo_key' }).then(function(res){
        if (res.error) { throw res.error; }
        var oldUrl = existing ? existing.image_url : null;
        if (oldUrl && oldUrl !== url) { window.rimalPhotoTools.discard(oldUrl); }
      });
    }).then(function(){
      return reloadAll().then(function(loaded){
        if (loaded) { setStatus('✓ Photo saved — it is now live on the website.', false); }
        else { setStatus('Photo saved, but the website photo list could not reload. Refresh the page to check the update.', true); }
      });
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

// The Manager Dashboard lives in admin.js, loaded only by manage.html.
if (window.rimalAdminStart) { window.rimalAdminStart(); }
}
if (document.visibilityState === 'hidden') { rimalStart(); }
else { requestAnimationFrame(function(){ setTimeout(rimalStart, 0); }); }
