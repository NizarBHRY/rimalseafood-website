// Printable menu (rimal-menu.html). Kept in its own file so the site's
// Content-Security-Policy can forbid inline scripts.
(function(){
  var INFO = window.RIMAL_INFO, money = window.rimalMoney;
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function row(name, desc, price){
    return '<li><span><span class="name">' + esc(name) + '</span>' + (desc ? '<span class="desc">' + esc(desc) + '</span>' : '') +
      '</span><span class="dots"></span><span class="price">' + price + '</span></li>';
  }
  document.getElementById('info').innerHTML =
    esc(INFO.street + ', ' + INFO.cityLine) + ' · <a href="tel:' + INFO.phoneTel + '">' + esc(INFO.phoneDisplay) + '</a><br>' + esc(INFO.hours);

  function draw(data, live){
  var html = data.menu.filter(function(c){ return c.items.length; }).map(function(c){
    return '<section><h2>' + esc(c.label) + '</h2>' + (c.note ? '<p class="note">' + esc(c.note) + '</p>' : '') +
      '<ul>' + c.items.map(function(it){
        var desc = it.desc || '';
        if (it.choices && c.id !== 'catch') { desc = (desc ? desc + ' ' : '') + it.choices.map(function(ch){ return ch.values.join(' / '); }).join(' · '); }
        var price = it.sizes && it.sizes.length > 1
          ? it.sizes.map(function(s){ return esc(s.label) + ' ' + money(s.price); }).join('<br>')
          : money(it.sizes && it.sizes.length === 1 ? it.sizes[0].price : it.price);
        if (it.sizes && it.sizes.length === 1) { desc = (desc ? desc + ' ' : '') + it.sizes[0].label; }
        return row(it.name, desc, price);
      }).join('') + '</ul></section>';
  }).join('');
  html += '<section><h2>Fresh Fish Market</h2><p class="note">To take home. Availability changes daily.</p><ul>' +
    data.market.map(function(g){ return g.items.map(function(it){ return row(it.name, '', money(it.price) + (it.unit ? '/' + esc(it.unit) : '')); }).join(''); }).join('') +
    '</ul></section>';
  if (!live) { html = '<p class="note" style="margin-top:20px;">We couldn\'t load today\'s menu, so this list may be out of date. Please check prices with our staff.</p>' + html; }
  document.getElementById('menu').innerHTML = html;
  }

  // Same dishes, prices and removals as the website: built-in items plus the
  // Manager dashboard's saved changes.
  var cfg = window.RIMAL_CONFIG || {};
  var db = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  if (db) {
    db.from('business_settings').select('setting_value').eq('setting_key', 'hours').maybeSingle().then(function(res){
      var hours = res.data && res.data.setting_value;
      if (!res.error && hours && window.rimalFormatHours(hours)) {
        INFO.hours = window.rimalFormatHours(hours);
        document.getElementById('info').innerHTML =
          esc(INFO.street + ', ' + INFO.cityLine) + ' · <a href="tel:' + INFO.phoneTel + '">' + esc(INFO.phoneDisplay) + '</a><br>' + esc(INFO.hours);
      }
    }).catch(function(){});
  }
  var ready = db
    ? Promise.all([db.from('menu_overrides').select('*'), db.from('menu_items').select('*')]).then(function(r){
        if (r[0].error || r[1].error) throw r[0].error || r[1].error;
        draw(window.rimalApplyDashboard(r[0].data, r[1].data), true);
      })
    : Promise.reject(new Error('no database'));
  ready = ready.catch(function(){ draw(window.rimalApplyDashboard([], []), false); });
  document.getElementById('foot').innerHTML =
    'Prices exclude ' + (INFO.taxRate * 100).toFixed(3).replace(/0+$/, '') + '% NYC sales tax on prepared food. Please ask our staff about allergens.<br>© 2026 Rimal Seafood';

  if (/[?&]print=1/.test(location.search)) {
    ready.then(function(){ return document.fonts ? document.fonts.ready : null; }).then(function(){ setTimeout(function(){ window.print(); }, 150); });
  }

  document.getElementById('printBtn').addEventListener('click', function(){ window.print(); });
})();
