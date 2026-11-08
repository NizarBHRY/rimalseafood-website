// Spelling and punctuation fixes for menu text typed into the Manager
// dashboard. The website shows the corrected text; the dashboard data itself
// is not changed.
//
// A fix applies only when the dashboard text matches exactly (ignoring extra
// spaces), so when the Manager edits a dish, the new text is shown as typed.
// Item keys are untouched: only the displayed name and description change.
//
// Used by the website build (src/data/menu.ts) and the printable menu
// (rimal-menu.js).
window.RIMAL_CORRECTIONS = {
  names: {
    'Shrimp Sandwish': 'Shrimp Sandwich',
    'Fish Burger.': 'Fish Burger',
    'Rimal Seafood Tajeen.': 'Rimal Seafood Tajeen',
    'FATTOUSH': 'Fattoush',
    'Mix Appetizers': 'Mixed Appetizers',
    'Whole Fish (Bronzini Or Orata)': 'Whole Fish (Branzino or Orata)',
    'Black tea with mint': 'Black Tea with Mint',
    'Special soda': 'Special Soda'
  },
  descriptions: {
    'sandwich featuring crispy fried shrimp, fresh vegetables, and a creamy, tangy sauce on crusty French bread.':
      'Sandwich featuring crispy fried shrimp, fresh vegetables, and a creamy, tangy sauce on crusty French bread.',
    'grilled fish rolled in soft wraps with pickles, greens & creamy garlic sauce. Served with crispy fries':
      'Grilled fish rolled in soft wraps with pickles, greens and creamy garlic sauce. Served with crispy fries.',
    'Grilled Branzino, Rice, Salad':
      'Grilled branzino, rice and salad.',
    'served with French Fries.':
      'Served with French fries.',
    'Fried Or Grilled served with salad and you choice of Fries Or Rice':
      'Fried or grilled, served with salad and your choice of fries or rice.',
    '7 pieces of Shrimp Fried or Grilled':
      '7 pieces of shrimp, fried or grilled.',
    '5 pieces or whiting fish, Fried or Grilled, served with salad and your choice Rice or French Fries.':
      '5 pieces of whiting fish, fried or grilled, served with salad and your choice of rice or French fries.',
    'White sauce a creamy, savory sauce infused with garlic onions butter, and traditional herbs or Red Sauce: a rich tomato-based sauce infused with garlic, onions, olive oil, and traditional herbs.':
      'White sauce: a creamy, savory sauce infused with garlic, onions, butter and traditional herbs. Or red sauce: a rich tomato-based sauce infused with garlic, onions, olive oil and traditional herbs.',
    '2 pieces with sauce and French Fries.':
      '2 pieces with sauce and French fries.',
    'Grilled Octopus, olive oil, Lemon, Herbs':
      'Grilled octopus, olive oil, lemon and herbs.',
    'Tahini, baba ghanoush, moussaka, lemon potato and olives':
      'Tahini, baba ghanoush, moussaka, lemon potato and olives.',
    'Lebanese garden salad with crispy pita':
      'Lebanese garden salad with crispy pita.'
  }
};

// Returns the menu/market data with corrected names and descriptions.
// Works on the { menu, market } object from rimalApplyDashboard (and on
// anything shaped like it); items are copied, never changed in place.
window.rimalCorrect = function(data){
  var C = window.RIMAL_CORRECTIONS;
  function norm(s){ return String(s).replace(/\s+/g, ' ').trim(); }
  function index(map){ var out = {}; Object.keys(map).forEach(function(k){ out[norm(k)] = map[k]; }); return out; }
  var names = index(C.names), descs = index(C.descriptions);
  function fix(it){
    var out = {}; Object.keys(it).forEach(function(k){ out[k] = it[k]; });
    if (typeof it.name === 'string' && names[norm(it.name)]) out.name = names[norm(it.name)];
    if (typeof it.desc === 'string' && descs[norm(it.desc)]) out.desc = descs[norm(it.desc)];
    return out;
  }
  function group(g){
    var out = {}; Object.keys(g).forEach(function(k){ out[k] = g[k]; });
    out.items = (g.items || []).map(fix);
    return out;
  }
  return { menu: (data.menu || []).map(group), market: (data.market || []).map(group) };
};
