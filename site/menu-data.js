// ============================================================
// RIMAL SEAFOOD — MENU & BUSINESS INFO
// ============================================================
// This data file is also consumed by the server-side Stripe catalog.
// In browsers globalThis.window is the normal window object; in Node a
// private object is used and exported below.
var window = (typeof globalThis !== 'undefined')
  ? (globalThis.window || (globalThis.window = {}))
  : {};
// The website's built-in menu. The live menu is these items PLUS the
// changes made in the Manager dashboard (renames, prices, photos, options,
// removals and added dishes), which are stored in the shared database and
// applied when the page loads. The dashboard is the source of truth, so to
// change a dish, change it in the dashboard rather than here.
//
// Dashboard edits find a dish by its section and its original name
// ("group-lunch|Grilled Salmon"), so never rename an item here: that would
// disconnect the edits your father has already made.
//
// Descriptions here only state facts already published by the restaurant
// (piece counts, included sides, choices). No preparation or ingredient claims.
//
// Item fields:
//   id       stable id the cart uses
//   name     original dish name (also the dashboard key)
//   price    dollars
//   desc     optional, facts only
//   photo    optional Unsplash photo id (representative photo)
//   choices  optional [{ key, label, values }]: every choice is required
//   sides    optional number of included sides, picked from RIMAL_SIDES
//   sizes    optional [{ label, price }]: priced options (Small/Large…)
// ============================================================

window.RIMAL_INFO = {
  name: 'Rimal Seafood',
  street: '7812 5th Ave',
  cityLine: 'Brooklyn, NY 11209',
  phoneDisplay: '(347) 497-4004',
  phoneTel: '+13474974004',
  hours: 'Daily 12:00 PM – 9:00 PM',
  taxRate: 0.08875,
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=7812+5th+Ave,+Brooklyn,+NY+11209'
};

window.rimalFormatTime = function(value){
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))) return '';
  var parts = value.split(':');
  var hour = Number(parts[0]);
  var minute = parts[1];
  return (hour % 12 || 12) + (minute === '00' ? '' : ':' + minute) + ' ' + (hour < 12 ? 'AM' : 'PM');
};
window.rimalFormatHours = function(hours){
  var opens = hours && window.rimalFormatTime(hours.opens);
  var closes = hours && window.rimalFormatTime(hours.closes);
  return opens && closes ? 'Daily ' + opens + ' – ' + closes : window.RIMAL_INFO.hours;
};

// The sides customers pick from when a dish includes sides.
window.RIMAL_SIDES = [
  'Saiadia Rice', 'Seafood Rice', 'Plain Rice', 'Baba Ghanoush', 'Tahini',
  'French Fries', 'Lemon Potato', 'Mediterranean Salad', 'Greek Salad'
];

// Category ids match the original page (group-<id>) so dashboard edits and
// dashboard-added dishes land in the right place. Empty categories are hidden.
window.RIMAL_MENU = [
  {
    id: 'lunch', label: "Lunch Specials", note: "Monday to Friday · 12:00 PM – 4:00 PM",
    items: [
      { id: "lunch-mixed-shrimp-and-calamari", name: "Mixed Shrimp & Calamari", price: 18.00, desc: "Served with 2 sides of your choice.", photo: "1761314025807-34cfab3c18e6", choices: [{ key: "choice", label: "Fried or grilled?", values: ["Fried","Grilled"] }], sides: 2 },
      { id: "lunch-fish-and-chips", name: "Fish & Chips", price: 9.99, desc: "2 pc fried whiting or tilapia, with fries.", photo: "1579208030886-b937da0925dc", choices: [{ key: "choice", label: "Which fish?", values: ["Whiting","Tilapia"] }] },
      { id: "lunch-shrimp-and-chips", name: "Shrimp and Chips", price: 9.99, desc: "Fried shrimp with fries.", photo: "1674207166635-7b2f0a58fea1", sizes: [{ label: "Small", price: 9.99 }, { label: "Large", price: 16.99 }] },
      { id: "lunch-shrimp-fish-and-chips", name: "Shrimp, Fish & Chips", price: 14.99, desc: "5 pc fried shrimp, 2 pc fried whiting, and fries.", photo: "1674207166635-7b2f0a58fea1" },
      { id: "lunch-whiting-fish", name: "Whiting Fish", price: 9.99, desc: "Fried whiting with fries.", photo: "1548704087-b11dab0fbec0", sizes: [{ label: "Small", price: 9.99 }, { label: "Large", price: 16.99 }] },
      { id: "lunch-fish-nuggets", name: "Fish Nuggets", price: 8.99, desc: "Fried fish bites with fries.", photo: "1562967916-eb82221dfb92", sizes: [{ label: "Small", price: 8.99 }, { label: "Large", price: 14.99 }] },
      { id: "lunch-grilled-salmon", name: "Grilled Salmon", price: 17.00, desc: "Served with 2 sides of your choice.", photo: "1539136788836-5699e78bfc75", sides: 2 },
      { id: "lunch-grilled-bronzini", name: "Grilled Bronzini", price: 18.00, desc: "Served with 2 sides of your choice.", photo: "1600699899970-b1c9fadd8f9e", sides: 2 }
    ]
  },
  {
    id: 'mains', label: "Main Plates",
    items: [
      { id: "mains-seafood-pizza", name: "Seafood Pizza", price: 29.99, photo: "1579751626657-72bc17010498" },
      { id: "mains-chilled-oyster-trio", name: "Chilled Oyster Trio", price: 22.00, photo: "1615141982883-c7ad0e69fd62" },
      { id: "mains-rimal-seafood-tower", name: "Rimal Seafood Tower", price: 78.00, photo: "1651323018466-b36b7df1d2b1" },
      { id: "mains-char-grilled-octopus", name: "Char-Grilled Octopus", price: 28.00, photo: "1626232441076-a2a5ada2256a" },
      { id: "mains-whole-roasted-branzino", name: "Whole Roasted Branzino", price: 36.00, photo: "1644784643137-b9073dd262f6" },
      { id: "mains-butter-poached-lobster", name: "Butter-Poached Lobster", price: 52.00, photo: "1655697253644-63c270874bb7" },
      { id: "mains-rimal-cioppino", name: "Rimal Cioppino", price: 34.00, photo: "1504674999014-e8f0b689c560" }
    ]
  },
  {
    id: 'catch', label: "Catch Your Plate", note: "Availability changes daily. Please confirm with staff.",
    items: [
      { id: "catch-whole-fish", name: "Whole Fish", price: 24.00, desc: "Pick your fish and how you'd like it cooked.", photo: "1764345960391-9b66a2541deb", choices: [{ key: "pick", label: "Which fish?", values: ["Large Branzino","Small Branzino","Red Snapper","Black Sea Bass","Striped Bass","Whiting","Porgy","Flounder","Monkfish","Pink Snapper","Mackerel","Bergoni","Mullet","Sardine","Grouper"] }, { key: "style", label: "How should we cook it?", values: ["Grilled","Fried","Sautéed","Middle Eastern Style"] }] },
      { id: "catch-fillet", name: "Fillet", price: 26.00, desc: "Pick your fillet and how you'd like it cooked.", photo: "1499125562588-29fb8a56b5d5", choices: [{ key: "pick", label: "Which fillet or steak?", values: ["Salmon (Filet)","Salmon (Steak)","Swordfish","Tuna","Kingfish","Chilean Sea Bass (Steak)","Codfish","Hake","Grouper","Pollock","Tilapia","Halibut (Filet)","Halibut (Steak)","Mahi Mahi","Flounder (Fillet)"] }, { key: "style", label: "How should we cook it?", values: ["Grilled","Fried","Sautéed","Middle Eastern Style"] }] },
      { id: "catch-shellfish", name: "Shellfish", price: 28.00, desc: "Pick your shellfish and how you'd like it cooked.", photo: "1655697253644-63c270874bb7", choices: [{ key: "pick", label: "Which shellfish?", values: ["Oyster","Mussel","Clams","Scallops","Calamari (Clean)","Calamari (Dirty)","Octopus"] }, { key: "style", label: "How should we cook it?", values: ["Grilled","Fried","Sautéed","Middle Eastern Style"] }] }
    ]
  },
  {
    id: 'sides', label: "Sides & Salads",
    items: [
      { id: "sides-saiadia-rice", name: "Saiadia Rice", price: 10.00, photo: "1665332195309-9d75071138f0" },
      { id: "sides-seafood-rice", name: "Seafood Rice", price: 16.00, photo: "1775201651117-2e8aa549f04c" },
      { id: "sides-plain-rice", name: "Plain Rice", price: 6.00, photo: "1705147271933-5c7052f15a90" },
      { id: "sides-seafood-pasta", name: "Seafood Pasta", price: 24.00, desc: "Your choice of red or white sauce.", photo: "1539586345401-51d5bfba7ac0", choices: [{ key: "choice", label: "Which sauce?", values: ["Red Sauce","White Sauce"] }] },
      { id: "sides-baba-ghanoush", name: "Baba Ghanoush", price: 9.00, photo: "1779805795356-29bbe8a8c950" },
      { id: "sides-tahini", name: "Tahini", price: 6.00, photo: "1591120583691-49d2741e55da" },
      { id: "sides-french-fries", name: "French Fries", price: 8.00, photo: "1615485290836-4ebcebf44aaf", sizes: [{ label: "Small", price: 8.00 }, { label: "Large", price: 12.00 }] },
      { id: "sides-lemon-potato", name: "Lemon Potato", price: 8.00, photo: "1633959639799-6d3f66e05710" },
      { id: "sides-mediterranean-salad", name: "Mediterranean Salad", price: 11.00, photo: "1505253716362-afaea1d3d1af", sizes: [{ label: "Small", price: 11.00 }, { label: "Large", price: 15.00 }] },
      { id: "sides-greek-salad", name: "Greek Salad", price: 12.00, photo: "1769481614068-47cfb4d1f125", sizes: [{ label: "Small", price: 12.00 }, { label: "Large", price: 16.00 }] },
      { id: "sides-moussaka", name: "Moussaka", price: 18.00, photo: "1777199311086-ec5ff230aefd" },
      { id: "sides-seafood-soup", name: "Seafood Soup", price: 14.00, photo: "1571167366136-b57e07761625" },
      { id: "sides-seafood-tajeen", name: "Seafood Tajeen", price: 28.00, desc: "Your choice of red or white sauce.", photo: "1578935149228-66b184c83e69", choices: [{ key: "choice", label: "Which sauce?", values: ["Red Sauce","White Sauce"] }] },
      { id: "sides-caesar-salad", name: "Caesar Salad", price: 12.00, sizes: [{ label: "Small", price: 12.00 }, { label: "Large", price: 16.00 }] },
      { id: "sides-regular-salad", name: "Regular Salad", price: 9.00, sizes: [{ label: "Small", price: 9.00 }, { label: "Large", price: 13.00 }] },
      { id: "sides-eggplant", name: "Eggplant", price: 9.00 },
      { id: "sides-avocado-salad", name: "Avocado Salad", price: 11.00, sizes: [{ label: "Small", price: 11.00 }, { label: "Large", price: 15.00 }] },
      { id: "sides-beet-salad", name: "Beet Salad", price: 10.00, sizes: [{ label: "Small", price: 10.00 }, { label: "Large", price: 14.00 }] },
      { id: "sides-pea-salad", name: "Pea Salad", price: 10.00, sizes: [{ label: "Small", price: 10.00 }, { label: "Large", price: 14.00 }] },
      { id: "sides-octopus-salad", name: "Octopus Salad", price: 14.00, photo: "1764397514747-8272f2da3f36", sizes: [{ label: "Small", price: 14.00 }, { label: "Large", price: 18.00 }] },
      { id: "sides-calamari-salad", name: "Calamari Salad", price: 13.00, photo: "1781639250755-f49e6120a78d", sizes: [{ label: "Small", price: 13.00 }, { label: "Large", price: 17.00 }] },
      { id: "sides-mixed-shrimp-and-calamari-side", name: "Mixed Shrimp & Calamari (Side)", price: 16.00, desc: "Side portion." },
      { id: "sides-clam-soup", name: "Clam Soup", price: 11.00 }
    ]
  },
  {
    id: 'specials', label: "Specials",
    items: [
      { id: "specials-empanada-shrimp", name: "Empanada Shrimp", price: 9.00 },
      { id: "specials-plantains-green", name: "Plantains (Green)", price: 6.00 },
      { id: "specials-oven-roasted-potatoes", name: "Oven Roasted Potatoes", price: 7.00 },
      { id: "specials-fish-soup", name: "Fish Soup", price: 10.00 },
      { id: "specials-shrimp-soup", name: "Shrimp Soup", price: 11.00 },
      { id: "specials-rice-seafood", name: "Rice Seafood", price: 16.00 },
      { id: "specials-soft-shell-crab", name: "Soft Shell Crab", price: 19.00 },
      { id: "specials-spaghetti-seafood", name: "Spaghetti Seafood", price: 22.00 },
      { id: "specials-shrimp-tacos", name: "Shrimp Tacos", price: 14.00 },
      { id: "specials-corn", name: "Corn", price: 6.00 },
      { id: "specials-spinach", name: "Spinach", price: 7.00 },
      { id: "specials-broccoli", name: "Broccoli", price: 7.00 },
      { id: "specials-asparagus", name: "Asparagus", price: 8.00 },
      { id: "specials-mixed-grilled-vegetables", name: "Mixed Grilled Vegetables", price: 9.00 },
      { id: "specials-garlic-bread", name: "Garlic Bread", price: 7.00 }
    ]
  },
  {
    id: 'drinks', label: "Drinks",
    items: [
      { id: "drinks-coca-cola", name: "Coca-Cola", price: 3.00, photo: "1554866585-cd94860890b7" },
      { id: "drinks-diet-coke", name: "Diet Coke", price: 3.00, photo: "1492558830530-c134e4d828fc" },
      { id: "drinks-pepsi", name: "Pepsi", price: 3.00, photo: "1629203849820-fdd70d49c38e" },
      { id: "drinks-sprite", name: "Sprite", price: 3.00, photo: "1554310636-9eef29dea2fa" },
      { id: "drinks-canada-dry-ginger-ale", name: "Canada Dry Ginger Ale", price: 3.00, photo: "1732247610040-c6a2193092ca" },
      { id: "drinks-laziza-malt-apple", name: "Laziza Malt (Apple)", price: 4.00, desc: "Apple flavor.", photo: "1714413713216-ffbe4149cf79" },
      { id: "drinks-laziza-malt-pineapple", name: "Laziza Malt (Pineapple)", price: 4.00, desc: "Pineapple flavor.", photo: "1714413713216-ffbe4149cf79" },
      { id: "drinks-bottled-water", name: "Bottled Water", price: 2.00, photo: "1602143407151-7111542de6e8" },
      { id: "drinks-sparkling-water", name: "Sparkling Water", price: 3.00, photo: "1548839140-29a749e1cf4d" },
      { id: "drinks-iced-tea", name: "Iced Tea", price: 3.00, photo: "1556679343-c7306c1976bc" },
      { id: "drinks-lemon-juice", name: "Lemon Juice", price: 8.00, photo: "1621263764928-df1444c5e859" },
      { id: "drinks-tea", name: "Tea", price: 3.99, photo: "1615227875116-ae28a77814fb" }
    ]
  },
  {
    id: 'desserts', label: "Desserts",
    items: [
      { id: "desserts-tiramisu", name: "Tiramisu", price: 9.00, photo: "1571877227200-a0d98ea607e9" },
      { id: "desserts-chocolate-cake", name: "Chocolate Cake", price: 9.00, photo: "1517427294546-5aa121f68e8a" },
      { id: "desserts-baklava", name: "Baklava", price: 8.00, photo: "1761828122856-8703baac8e86" },
      { id: "desserts-kunafa", name: "Kunafa", price: 10.00, photo: "1778447812923-88a9e3e6b567" },
      { id: "desserts-cheesecake", name: "Cheesecake", price: 9.00, photo: "1524351199678-941a58a3df50" }
    ]
  }
];

// Fish Market, sold to go by weight or by the piece (raw, not taxed).
window.RIMAL_MARKET = [
  { label: 'Fin Fish', items: [
    { name: "Atlantic Salmon Fillet", price: 16.00, unit: 'lb', photo: '1499125562588-29fb8a56b5d5', step: 0.5 },
    { name: "Whole Branzino", price: 14.00, unit: 'lb', photo: '1764345960391-9b66a2541deb', step: 0.5 },
    { name: "Striped Bass", price: 19.00, unit: 'lb', photo: '1784043436637-ab9f19bcfcc1', step: 0.5 },
    { name: "Fluke (Summer Flounder)", price: 18.00, unit: 'lb', photo: '1764345704514-7bf2934f360b', step: 0.5 },
    { name: "Black Sea Bass", price: 15.00, unit: 'lb', photo: '1611214774777-3d997a9d0e35', step: 0.5 },
    { name: "Red Snapper", price: 17.00, unit: 'lb', photo: '1764813824645-e5dc9e49d8cb', step: 0.5 },
    { name: "Atlantic Cod", price: 14.00, unit: 'lb', photo: '1500732917506-30dc38b6477f', step: 0.5 },
    { name: "Haddock", price: 13.00, unit: 'lb', photo: '1569224559512-1bea230f2e51', step: 0.5 },
    { name: "Halibut", price: 24.00, unit: 'lb', photo: '1559058789-672da06263d8', step: 0.5 },
    { name: "Yellowfin Tuna", price: 26.00, unit: 'lb', photo: '1772329320539-d297125453c1', step: 0.5 },
    { name: "Swordfish Steak", price: 22.00, unit: 'lb', photo: '1772155657429-bf1f7d64934b', step: 0.5 },
    { name: "Bluefish", price: 11.00, unit: 'lb', photo: '1764345960391-9b66a2541deb', step: 0.5 },
    { name: "Porgy (Scup)", price: 9.00, unit: 'lb', photo: '1784043436637-ab9f19bcfcc1', step: 0.5 },
    { name: "Mackerel", price: 9.00, unit: 'lb', photo: '1764345704514-7bf2934f360b', step: 0.5 },
    { name: "Monkfish", price: 17.00, unit: 'lb', photo: '1611214774777-3d997a9d0e35', step: 0.5 },
    { name: "Tilapia", price: 8.00, unit: 'lb', photo: '1569224559512-1bea230f2e51', step: 0.5 },
    { name: "Rainbow Trout", price: 12.00, unit: 'lb', photo: '1764813824645-e5dc9e49d8cb', step: 0.5 },
    { name: "Mahi Mahi", price: 16.00, unit: 'lb', photo: '1500732917506-30dc38b6477f', step: 0.5 }
  ] },
  { label: 'Shellfish & More', items: [
    { name: "Live Lobster", price: 22.00, unit: 'lb', photo: '1655697253644-63c270874bb7', step: 0.5 },
    { name: "Small Shrimp (51/60 ct)", price: 10.00, unit: 'lb', photo: '1565680018434-b513d5e5fd47', step: 0.5 },
    { name: "Medium Shrimp (41/50 ct)", price: 12.00, unit: 'lb', photo: '1565680018434-b513d5e5fd47', step: 0.5 },
    { name: "Large Shrimp (31/40 ct)", price: 15.00, unit: 'lb', photo: '1565680018434-b513d5e5fd47', step: 0.5 },
    { name: "Jumbo Shrimp (21/25 ct)", price: 18.00, unit: 'lb', photo: '1565680018434-b513d5e5fd47', step: 0.5 },
    { name: "Colossal Shrimp (U/15 ct)", price: 24.00, unit: 'lb', photo: '1565680018434-b513d5e5fd47', step: 0.5 },
    { name: "Sea Scallops", price: 28.00, unit: 'lb', photo: '1779444142856-747cccbaf12d', step: 0.5 },
    { name: "Blue Crab", price: 9.00, unit: 'each', photo: '1561361398-b2bc9f049851', step: 1 },
    { name: "Snow Crab Legs", price: 19.00, unit: 'lb', photo: '1677643612277-1509dce0b697', step: 0.5 },
    { name: "Little Neck Clams", price: 8.00, unit: 'dz', photo: '1763575392558-7a83929678fd', step: 1 },
    { name: "Blue Mussels", price: 6.00, unit: 'lb', photo: '1448043552756-e747b7a2b2b8', step: 0.5 },
    { name: "Fresh Oysters", price: 2.50, unit: 'each', photo: '1633321094192-388268512e0f', step: 1, qty: 6 },
    { name: "Calamari (Squid)", price: 9.00, unit: 'lb', photo: '1565062043758-ef4656ef275d', step: 0.5 },
    { name: "Octopus", price: 13.00, unit: 'lb', photo: '1569933044748-ab0fa292068a', step: 0.5 }
  ] }
];

// Representative photo URL at a given width.
window.rimalPhotoUrl = function(photoId, width){
  return 'https://images.unsplash.com/photo-' + photoId + '?q=75&w=' + (width || 480) + '&auto=format&fit=crop';
};

// Always two decimals: $22.00, $9.99.
window.rimalMoney = function(n){ return '$' + (Number(n) || 0).toFixed(2); };

// Applies the Manager dashboard's saved changes to the built-in data. Used by
// the printable menu (rimal-menu.html); the main page applies the same rows
// to its cards. Returns { menu, market } with removed items dropped.
window.rimalApplyDashboard = function(overrides, customItems){
  var ov = {};
  (overrides || []).forEach(function(r){ ov[r.item_key] = r; });
  function apply(item, key){
    var o = ov[key];
    if (!o) return item;
    if (o.removed) return null;
    var out = {};
    Object.keys(item).forEach(function(k){ out[k] = item[k]; });
    var renamed = o.name && o.name !== item.name;
    if (renamed) { out.name = o.name; delete out.choices; delete out.sides; }
    if (o.description != null) { out.desc = o.description; }
    if (Array.isArray(o.options)) {
      var opts = o.options.filter(function(x){ return x && x.label && isFinite(Number(x.price)); });
      if (opts.length) { out.sizes = opts.map(function(x){ return { label: x.label, price: Number(x.price) }; }); out.price = Number(opts[0].price); }
      else { delete out.sizes; if (o.price != null) out.price = Number(o.price); }
    } else if (o.price != null) { out.price = Number(o.price); }
    return out;
  }
  var menu = window.RIMAL_MENU.map(function(cat){
    var seen = {};
    var items = cat.items.map(function(it){
      var base = 'group-' + cat.id + '|' + it.name, key = base, n = 2;
      while (seen[key]) { key = base + '#' + (n++); }
      seen[key] = true;
      return apply(it, key);
    }).filter(Boolean);
    return { id: cat.id, label: cat.label, note: cat.note, items: items };
  });
  var market = window.RIMAL_MARKET.map(function(g, gi){
    return { label: g.label, items: g.items.map(function(it){ return apply(it, 'market-' + gi + '|' + it.name); }).filter(Boolean) };
  });
  var CAT = { menu_lunch: 'lunch', menu_mains: 'mains', menu_sides: 'sides', menu_salads: 'sides', menu_specials: 'specials', menu_drinks: 'drinks', menu_desserts: 'desserts' };
  (customItems || []).slice().sort(function(a, b){ return (Number(a.display_order) || 1000) - (Number(b.display_order) || 1000); }).forEach(function(c){
    var opts = (Array.isArray(c.options) ? c.options : []).filter(function(x){ return x && x.label && isFinite(Number(x.price)); });
    var item = { name: c.name, price: opts.length ? Number(opts[0].price) : Number(c.price), desc: c.description || '' };
    if (opts.length) item.sizes = opts.map(function(x){ return { label: x.label, price: Number(x.price) }; });
    if (c.category === 'market_fish' || c.category === 'market_shellfish') {
      item.unit = c.unit || '';
      market[c.category === 'market_fish' ? 0 : 1].items.push(item);
    } else if (CAT[c.category]) {
      menu.filter(function(m){ return m.id === CAT[c.category]; })[0].items.push(item);
    }
  });
  return { menu: menu, market: market };
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    info: window.RIMAL_INFO,
    menu: window.RIMAL_MENU,
    market: window.RIMAL_MARKET,
    sides: window.RIMAL_SIDES,
    applyDashboard: window.rimalApplyDashboard
  };
}
