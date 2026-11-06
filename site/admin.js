// ============================================================
// RIMAL SEAFOOD — MANAGER DASHBOARD
// ============================================================
// Loaded only by manage.html, before app.js. app.js calls rimalAdminStart()
// at the end of rimalStart(), once the database client and the shared
// helpers (rimalCsvSafe, rimalApplyInventory, ...) exist.
// ============================================================

window.rimalAdminStart = function(){
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
    if (window.rimalLoadBusinessHours) { window.rimalLoadBusinessHours(); }
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
          if (payload.eventType === 'UPDATE' && payload.new && (payload.new.payment_method === 'card' || payload.new.payment_method === 'stripe') && payload.new.payment_status === 'paid' &&
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
        topItemsList.innerHTML = '<p class="admin-empty">No sales have been recorded yet.</p>';
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
              '<span class="status-badge ' + (o.payment_status === 'paid' ? 'status-ready' : 'status-processing') + '" style="margin-left:6px;">' + (o.payment_method === 'stripe' ? 'Online card' : o.payment_method === 'card' ? 'Card' : 'Cash') + ' · ' + (o.payment_status === 'paid' ? 'Paid' : 'Unpaid') + '</span>' +
              (hasReward ? '<span class="status-badge status-ready" style="margin-left:6px;">🎁 Free Platter Waiting</span>' : '') +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">' +
              '<div class="admin-row-value">' + money(o.total) + '</div>' +
              buildTableSelect(o.id, o.table_number) +
              '<button class="btn status-toggle-btn" type="button" data-order-id="' + esc(o.id) + '">' +
                (status === 'Ready' ? 'Mark Processing' : 'Mark Ready') +
              '</button>' +
              (o.phone ? '<button class="btn status-toggle-btn" type="button" data-text-id="' + esc(o.id) + '">Text Customer</button>' : '') +
              (o.payment_method !== 'card' && o.payment_method !== 'stripe' && o.payment_status !== 'paid' ? '<button class="btn status-toggle-btn" type="button" data-cash-paid-id="' + esc(o.id) + '">Mark Cash Paid &amp; Print</button>' : '') +
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
};
