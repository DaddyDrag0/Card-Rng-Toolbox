import { store } from './core/store.js'
import { createEmptyProfile, normalizeImportedJson, countOwnedCards } from './core/schema.js'
import { tools, toolById } from './core/tools.js'

const app = document.querySelector('#app')
let route = location.hash.replace(/^#\/?/, '') || 'dashboard'
let cardCatalog = []
let auraCatalog = []
let thumbnails = {}
let libraryQuery = ''
let librarySort = 'rarity-desc'
let libraryWeather = ''
let libraryPack = ''
let libraryOwned = 'all'
let deckInventoryQuery = ''
let deckWorker = null
let deckProgress = null
let deckLastProgressRender = 0
let deckResults = []
let deckError = ''
let towerWorker = null
let towerRequestId = 0
let towerSearchWorkers = []
let towerSearchToken = 0
let towerSearchLastRender = 0
let towerFloor = 105
let towerDifficulty = 'Impossible'
let towerEnemies = ["Heaven's Armor","Hell's Army",'Judgment Day','Sable The Envious']
let towerProgress = null
let towerResult = null
let towerError = ''
let depthsQuery = ''
let depthRequestId = 0
const depthsWorkers = new Map()
const depthsProgress = {}
const depthsLastProgressRender = new Map()
const depthsResults = {}

fetch('./src/data/cards.json?v=2', { cache: 'no-store' })
  .then(response => response.ok ? response.json() : [])
  .then(cards => { cardCatalog = Array.isArray(cards) ? cards : []; if (route === 'library') render() })
  .catch(() => {})

fetch('./src/data/auras.json?v=1', { cache: 'no-store' })
  .then(response => response.ok ? response.json() : [])
  .then(auras => { auraCatalog = Array.isArray(auras) ? auras : []; if (route === 'deck-helper') render() })
  .catch(() => {})

fetch('./src/data/thumbnails.json?v=1', { cache: 'no-store' })
  .then(response => response.ok ? response.json() : {})
  .then(data => { thumbnails = data && typeof data === 'object' ? data : {}; render() })
  .catch(() => {})

try { localStorage.setItem('crx-site-theme', 'slate') } catch {}

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

function cardByName(name) {
  return cardCatalog.find(card => card.name === name) || null
}

function cardImageUrl(nameOrCard) {
  const card = typeof nameOrCard === 'string' ? cardByName(nameOrCard) : nameOrCard
  if (!card) return ''
  return thumbnails[String(card.imageAssetId)] || ''
}

function cardImage(nameOrCard, className = 'card-thumb') {
  const card = typeof nameOrCard === 'string' ? cardByName(nameOrCard) : nameOrCard
  const url = cardImageUrl(card)
  if (!url) return `<span class="${className} card-thumb-fallback">?</span>`
  return `<img class="${className}" src="${esc(url)}" alt="${esc(card?.name || '')}" loading="lazy">`
}

function baseCardStats(card) {
  if (!card) return { power: 0, attack: 0, health: 0 }
  const rarity = Math.max(1, Number(card.rarity) || 1)
  const statMultiplier = Math.max(0, Number(card.statMultiplier) || 1)
  const power = Math.pow(2, Math.log10(rarity)) * 10 * statMultiplier
  return {
    power,
    attack: power / 2,
    health: power * Math.max(0.01, Number(card.hpMultiplier) || 1),
  }
}

function compactNumber(value) {
  const number = Number(value) || 0
  if (Math.abs(number) < 1000) return Math.round(number).toLocaleString()
  const units = [['Qd',1e15],['T',1e12],['B',1e9],['M',1e6],['K',1e3]]
  for (const [unit,size] of units) if (Math.abs(number) >= size) return (number / size).toFixed(number >= size * 10 ? 1 : 2).replace(/\.0+$/,'') + unit
  return Math.round(number).toLocaleString()
}


function activeProfile() {
  return store.activeProfile()
}

function routeTo(id) {
  route = toolById(id).id
  location.hash = '#/' + route
  render()
}

function groupTools() {
  const groups = new Map()
  for (const tool of tools) {
    if (!groups.has(tool.group)) groups.set(tool.group, [])
    groups.get(tool.group).push(tool)
  }
  return groups
}

function sidebar() {
  const profile = activeProfile()
  return `
    <aside class="sidebar">
      <button class="brand" data-route="dashboard">
        <div class="brand-mark">CR</div>
        <div><strong>Card RNG</strong><span>Toolbox</span></div>
      </button>

      <nav class="nav">
        ${[...groupTools()].map(([group, items]) => `
          <section class="nav-group">
            <small>${esc(group)}</small>
            ${items.map(tool => `
              <button class="nav-item ${route === tool.id ? 'active' : ''}" data-route="${tool.id}">
                <i>${tool.icon}</i><span>${esc(tool.name)}</span>
              </button>
            `).join('')}
          </section>
        `).join('')}
      </nav>

      <button class="sidebar-profile" data-action="open-profile">
        <span class="avatar">${esc((profile.roblox.username || profile.name || '?').slice(0, 1).toUpperCase())}</span>
        <span><strong>${esc(profile.roblox.username || profile.name)}</strong><small>${profile.import.importedAt ? 'Data loaded' : 'Local profile'}</small></span>
      </button>
    </aside>
  `
}

function header() {
  if (['deck-helper','depths','tower','library','calculators'].includes(route)) return ''
  const tool = toolById(route)
  return `
    <header class="topbar">
      <div><p class="kicker">CARD RNG EXPANSION</p><h1>${esc(tool.name)}</h1></div>
    </header>
  `
}

function metric(label, value) {
  return `<article class="metric"><span>${esc(label)}</span><b>${esc(value)}</b></article>`
}

function dashboardPage() {
  const profile = activeProfile()
  const cardCount = countOwnedCards(profile.game.cards)

  return `
    <section class="intro">
      <p class="kicker">TOOLBOX</p>
      <h2>Card RNG Toolbox</h2>
      <p>All tools use the same player data.</p>
    </section>

    <section class="metrics">
      ${metric('Profile', profile.roblox.username || profile.name)}
      ${metric('Owned Cards', cardCount || '—')}
      ${metric('Player Data', profile.import.importedAt ? 'Loaded' : 'Not Loaded')}
    </section>

    <section class="panel data-manager">
      <div class="panel-head">
        <div><p class="kicker">PLAYER DATA</p><h3>${profile.import.importedAt ? 'JSON Connected' : 'Import Player JSON'}</h3></div>
        <button class="primary" data-action="import-json">${profile.import.importedAt ? 'Update JSON' : 'Import JSON'}</button>
      </div>
      <div class="panel-body data-manager-body">
        <div>
          <b>${profile.import.importedAt ? 'Saved to this browser' : 'No player data loaded'}</b>
          <span>${profile.import.importedAt ? 'Every tool uses this same saved profile.' : 'Import once here. Inventory and every tool will use the same data.'}</span>
        </div>
        <small>${profile.import.importedAt ? 'Last updated ' + new Date(profile.import.importedAt).toLocaleString() : 'You can replace it later with Update JSON.'}</small>
      </div>
    </section>

    <div class="section-head tools-head"><div><p class="kicker">TOOLS</p><h2>All Tools</h2></div></div>
    <section class="tool-grid">
      ${tools.filter(tool => tool.id !== 'dashboard').map(tool => `
        <button class="tool-card" data-route="${tool.id}">
          <div class="tool-icon">${tool.icon}</div>
          <div><strong>${esc(tool.name)}</strong><p>${esc(tool.description)}</p></div>
          <span>›</span>
        </button>
      `).join('')}
    </section>
  `
}

function playerPage() {
  const profile = activeProfile()
  return `
    <section class="page-intro">
      <p class="kicker">PLAYER</p>
      <h2>Player Data</h2>
      <p>Import once. Every tool uses this profile.</p>
    </section>

    <div class="two-col">
      <section class="panel">
        <div class="panel-head">
          <div><p class="kicker">PROFILE</p><h3>Active Player</h3></div>
          <button class="secondary small" data-action="new-profile">New</button>
        </div>
        <div class="panel-body">
          <div class="profile-card">
            <div class="big-avatar">${esc((profile.roblox.username || profile.name).slice(0,1).toUpperCase())}</div>
            <div>
              <h3>${esc(profile.roblox.displayName || profile.roblox.username || profile.name)}</h3>
              <p>${profile.roblox.username ? '@' + esc(profile.roblox.username) : 'No username loaded'}</p>
              <small>${profile.roblox.userId ? 'ID ' + esc(profile.roblox.userId) : 'No Roblox ID loaded'}</small>
            </div>
          </div>

          <div class="profile-list">
            ${store.get().profiles.map(item => `
              <button class="${item.id === profile.id ? 'active' : ''}" data-profile-id="${item.id}">
                <span class="avatar">${esc((item.roblox.username || item.name).slice(0,1).toUpperCase())}</span>
                <span><strong>${esc(item.roblox.username || item.name)}</strong><small>${item.import.importedAt ? 'Imported' : 'Local'}</small></span>
              </button>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><p class="kicker">PLAYER DATA</p><h3>${profile.import.importedAt ? 'Connected' : 'Not Loaded'}</h3></div></div>
        <div class="panel-body">
          <p class="muted">${profile.import.importedAt ? 'This profile is using the shared JSON saved from the Dashboard.' : 'Import your JSON once from the Dashboard.'}</p>
          <button class="secondary full" data-route="dashboard">Open Dashboard</button>
        </div>
      </section>
    </div>
  `
}

function inventoryRows(cards) {
  if (Array.isArray(cards)) return cards.slice(0, 500).map((card, index) => ({
    name: card?.name || card?.cardName || card?.Name || 'Card ' + (index + 1),
    quantity: card?.quantity ?? card?.count ?? 1,
    detail: card?.border || card?.borders?.join?.(', ') || card?.mutation || card?.mutationWeather || '',
  }))
  if (cards && typeof cards === 'object') return Object.entries(cards).slice(0, 500).map(([name, value]) => ({
    name,
    quantity: typeof value === 'number' ? value : value?.quantity ?? value?.count ?? 1,
    detail: typeof value === 'object' ? value?.border || value?.mutation || value?.mutationWeather || '' : '',
  }))
  return []
}

function inventoryPage() {
  const rows = inventoryRows(activeProfile().game.cards)
  return `
    <section class="page-intro">
      <p class="kicker">PLAYER</p>
      <h2>Inventory</h2>
      <p>${rows.length ? countOwnedCards(activeProfile().game.cards) + ' card copies loaded.' : 'No inventory loaded.'}</p>
    </section>

    <section class="panel">
      <div class="panel-head"><div><p class="kicker">CARDS</p><h3>Owned Cards</h3></div></div>
      <div class="panel-body no-pad">
        ${rows.length ? `
          <div class="inventory-table">
            <div class="inventory-head"><span>Card</span><span>Details</span><span>Qty</span></div>
            ${rows.map(row => `<div class="inventory-row"><div class="inventory-card-name">${cardImage(row.name,'card-thumb-sm')}<strong>${esc(row.name)}</strong></div><span>${esc(row.detail || 'Base')}</span><b>×${esc(row.quantity)}</b></div>`).join('')}
          </div>
        ` : `
          <div class="empty-state"><h3>No card data</h3><p>Import player JSON from the Dashboard to load inventory.</p><button class="secondary" data-route="dashboard">Open Dashboard</button></div>
        `}
      </div>
    </section>
  `
}

function cardLibraryPage() {
  const query = libraryQuery.trim().toLowerCase()
  const ownedNames = ownedCardNames()
  const weathers = [...new Set(cardCatalog.map(card => card.weather).filter(Boolean))].sort()
  const packs = [...new Set(cardCatalog.map(card => card.pack).filter(Boolean))].sort()

  const sorters = {
    'rarity-desc': (a,b) => b.rarity - a.rarity || a.name.localeCompare(b.name),
    'rarity-asc': (a,b) => a.rarity - b.rarity || a.name.localeCompare(b.name),
    'damage-desc': (a,b) => baseCardStats(b).attack - baseCardStats(a).attack || b.rarity - a.rarity,
    'damage-asc': (a,b) => baseCardStats(a).attack - baseCardStats(b).attack || a.rarity - b.rarity,
    'health-desc': (a,b) => baseCardStats(b).health - baseCardStats(a).health || b.rarity - a.rarity,
    'health-asc': (a,b) => baseCardStats(a).health - baseCardStats(b).health || a.rarity - b.rarity,
    'name-asc': (a,b) => a.name.localeCompare(b.name),
  }

  const shown = cardCatalog
    .filter(card => !query || card.name.toLowerCase().includes(query) || String(card.ability || '').toLowerCase().includes(query) || String(card.pack || '').toLowerCase().includes(query) || String(card.weather || '').toLowerCase().includes(query))
    .filter(card => !libraryWeather || card.weather === libraryWeather)
    .filter(card => !libraryPack || card.pack === libraryPack)
    .filter(card => libraryOwned !== 'owned' || ownedNames.has(card.name))
    .sort(sorters[librarySort] || sorters['rarity-desc'])
    .slice(0, 400)

  return `
    <section class="page-intro">
      <p class="kicker">CARDS</p>
      <h2>Card Library</h2>
      <p>${cardCatalog.length ? cardCatalog.length + ' cards loaded.' : 'Loading cards…'}</p>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div><p class="kicker">CATALOG</p><h3>All Cards</h3></div>
        <span class="panel-count">${shown.length} shown</span>
      </div>
      <div class="panel-body">
        <div class="library-controls">
          <input id="librarySearch" class="search-input" value="${esc(libraryQuery)}" placeholder="Search card, ability, pack or weather…" autocomplete="off">
          <select id="librarySort">
            <option value="rarity-desc" ${librarySort==='rarity-desc'?'selected':''}>Rarity · Highest</option>
            <option value="rarity-asc" ${librarySort==='rarity-asc'?'selected':''}>Rarity · Lowest</option>
            <option value="damage-desc" ${librarySort==='damage-desc'?'selected':''}>Damage · Highest</option>
            <option value="damage-asc" ${librarySort==='damage-asc'?'selected':''}>Damage · Lowest</option>
            <option value="health-desc" ${librarySort==='health-desc'?'selected':''}>Health · Highest</option>
            <option value="health-asc" ${librarySort==='health-asc'?'selected':''}>Health · Lowest</option>
            <option value="name-asc" ${librarySort==='name-asc'?'selected':''}>Name · A-Z</option>
          </select>
          <select id="libraryWeather">
            <option value="">All Weathers</option>
            ${weathers.map(weather => `<option value="${esc(weather)}" ${libraryWeather===weather?'selected':''}>${esc(weather)}</option>`).join('')}
          </select>
          <select id="libraryPack">
            <option value="">All Packs</option>
            ${packs.map(pack => `<option value="${esc(pack)}" ${libraryPack===pack?'selected':''}>${esc(pack)}</option>`).join('')}
          </select>
          <select id="libraryOwned">
            <option value="all" ${libraryOwned==='all'?'selected':''}>All Cards</option>
            <option value="owned" ${libraryOwned==='owned'?'selected':''}>Owned Only</option>
          </select>
        </div>

        <div class="card-library-grid">
          ${shown.map(card => {
            const stats = baseCardStats(card)
            return `
              <article class="library-card">
                ${cardImage(card,'library-card-image')}
                <div class="library-card-content">
                  <div class="library-card-top">
                    <strong>${esc(card.name)}</strong>
                    <span>1 / ${Number(card.rarity || 0).toLocaleString()}</span>
                  </div>
                  <p>${esc(card.ability || 'No ability')}</p>
                  <div class="library-stats">
                    <span><b>${compactNumber(stats.attack)}</b> ATK</span>
                    <span><b>${compactNumber(stats.health)}</b> HP</span>
                  </div>
                  <div class="library-tags">
                    ${card.pack ? `<span>${esc(card.pack)}</span>` : ''}
                    ${card.weather ? `<span>${esc(card.weather)}</span>` : ''}
                    ${ownedNames.has(card.name) ? '<span class="owned-tag">Owned</span>' : ''}
                    ${card.unobtainable ? '<span>Unobtainable</span>' : ''}
                  </div>
                </div>
              </article>
            `
          }).join('') || '<div class="empty-state"><h3>No matching cards</h3></div>'}
        </div>
      </div>
    </section>
  `
}

function normalizeOwnedCards(cards) {
  const list = []
  if (Array.isArray(cards)) {
    for (const item of cards) {
      if (!item || typeof item !== 'object') continue
      const name = item.cardName || item.name || item.Name
      if (!name) continue
      list.push({
        cardName: String(name),
        quantity: Math.max(1, Math.floor(Number(item.quantity ?? item.count ?? 1) || 1)),
        borders: Array.isArray(item.borders) ? item.borders.filter(value => ['Platinum','Crystal','Ruby','Galaxy'].includes(value)) : item.border && ['Platinum','Crystal','Ruby','Galaxy'].includes(item.border) ? [item.border] : [],
        mutationWeather: String(item.mutationWeather || item.mutation || ''),
        locked: false,
        lockedPosition: null,
      })
    }
  } else if (cards && typeof cards === 'object') {
    for (const [name, value] of Object.entries(cards)) {
      if (typeof value === 'number') list.push({ cardName: name, quantity: Math.max(1, Math.floor(value)), borders: [], mutationWeather: '', locked: false, lockedPosition: null })
      else if (value && typeof value === 'object') list.push({
        cardName: name,
        quantity: Math.max(1, Math.floor(Number(value.quantity ?? value.count ?? 1) || 1)),
        borders: Array.isArray(value.borders) ? value.borders.filter(border => ['Platinum','Crystal','Ruby','Galaxy'].includes(border)) : value.border && ['Platinum','Crystal','Ruby','Galaxy'].includes(value.border) ? [value.border] : [],
        mutationWeather: String(value.mutationWeather || value.mutation || ''),
        locked: false,
        lockedPosition: null,
      })
    }
  }
  return list
}

function cardVariantKey(card) {
  return [card.cardName, [...(card.borders || [])].sort().join('+'), card.mutationWeather || ''].join('|')
}

function deckToolState() {
  return store.get().toolState?.deckHelper?.[activeProfile().id] || { initialized: false, selected: [], locks: {} }
}

function updateDeckToolState(next) {
  const profileId = activeProfile().id
  store.update(draft => {
    if (!draft.toolState.deckHelper) draft.toolState.deckHelper = {}
    const current = draft.toolState.deckHelper[profileId] || { initialized: false, selected: [], locks: {} }
    draft.toolState.deckHelper[profileId] = { ...current, ...next }
  })
}

function defaultDeckSelection(cards) {
  const byName = new Map(cardCatalog.map(card => [card.name, card]))
  const ordered = [...cards].sort((a, b) => {
    const ar = Number(byName.get(a.cardName)?.rarity || 0)
    const br = Number(byName.get(b.cardName)?.rarity || 0)
    return br - ar || a.cardName.localeCompare(b.cardName)
  })
  const selected = []
  let copies = 0
  for (const card of ordered) {
    const qty = Math.max(1, Math.min(30, Number(card.quantity) || 1))
    if (copies + qty > 30) continue
    selected.push(cardVariantKey(card))
    copies += qty
    if (copies >= 30) break
  }
  return selected
}

function selectedDeckCards() {
  const cards = normalizeOwnedCards(activeProfile().game.cards)
  const state = deckToolState()
  const validKeys = new Set(cards.map(cardVariantKey))
  const selectedKeys = state.initialized
    ? state.selected.filter(key => validKeys.has(key))
    : defaultDeckSelection(cards)
  const selected = new Set(selectedKeys)
  return { cards, selected, state }
}

function normalizeOwnedAuras(value) {
  const auraByName = new Map(auraCatalog.map(aura => [aura.name, aura]))
  const raw = []
  if (Array.isArray(value)) raw.push(...value)
  else if (value && typeof value === 'object') {
    for (const [name, entry] of Object.entries(value)) {
      if (entry === false || entry === 0 || entry == null) continue
      raw.push(typeof entry === 'object' ? { name, ...entry } : { name })
    }
  }
  const statAuras = []
  const abilityAuras = []
  const seen = new Set()
  for (const item of raw) {
    const name = String(item?.auraName || item?.name || item?.Name || '')
    if (!name || seen.has(name) || !auraByName.has(name)) continue
    seen.add(name)
    const definition = auraByName.get(name)
    const borderValues = Array.isArray(item?.borders) ? item.borders : [item?.border].filter(Boolean)
    const allowed = ['Base','Platinum','Crystal','Galaxy']
    const borders = borderValues.filter(border => allowed.includes(border))
    const owned = { auraName: name, borders: borders.length ? borders : ['Base'], locked: false }
    if (definition.type === 'Stat') statAuras.push(owned)
    else if (definition.type === 'Skill') abilityAuras.push(owned)
  }
  return { statAuras, abilityAuras }
}

function deckWorkerInventory() {
  const { cards, selected, state } = selectedDeckCards()
  const locks = state.locks || {}
  const selectedCards = cards.filter(card => selected.has(cardVariantKey(card))).map(card => {
    const key = cardVariantKey(card)
    const position = Number.isInteger(locks[key]) && locks[key] >= 0 && locks[key] <= 3 ? locks[key] : null
    return {
      ...card,
      quantity: Math.max(1, Math.min(30, Number(card.quantity) || 1)),
      locked: position !== null,
      lockedPosition: position,
    }
  })
  const auras = normalizeOwnedAuras(activeProfile().game.auras)
  return { cards: selectedCards, ...auras }
}

function deckHelperPage() {
  const profile = activeProfile()
  const { cards, selected, state } = selectedDeckCards()
  const query = deckInventoryQuery.trim().toLowerCase()
  const visible = cards.filter(card => !query || card.cardName.toLowerCase().includes(query))
  const selectedCards = cards.filter(card => selected.has(cardVariantKey(card)))
  const selectedCopies = selectedCards.reduce((sum, card) => sum + Math.max(1, Number(card.quantity) || 1), 0)
  const importedAuras = normalizeOwnedAuras(profile.game.auras)
  const progress = deckProgress
  return `
    <section class="page-intro">
      <p class="kicker">DECK TOOL</p>
      <h2>Deck Helper</h2>
      <p>Uses your shared Toolbox inventory and the Depths battle engine.</p>
    </section>

    ${!profile.import.importedAt ? `
      <section class="panel tool-warning">
        <div><strong>No player JSON loaded.</strong><span>Import your player data from the Dashboard first.</span></div>
        <button class="secondary" data-route="dashboard">Dashboard</button>
      </section>
    ` : ''}

    <div class="deck-layout">
      <section class="panel">
        <div class="panel-head">
          <div><p class="kicker">INVENTORY</p><h3>Optimizer Pool</h3></div>
          <b class="selection-count">${selectedCopies}/30 copies</b>
        </div>
        <div class="panel-body">
          <input id="deckInventorySearch" class="search-input" value="${esc(deckInventoryQuery)}" placeholder="Search owned cards…" autocomplete="off">
          <div class="deck-owned-list">
            ${visible.length ? visible.map(card => {
              const key = cardVariantKey(card)
              const on = selected.has(key)
              const lock = Number.isInteger(state.locks?.[key]) ? state.locks[key] : -1
              return `
                <div class="deck-owned-row ${on ? 'selected' : ''}">
                  <button class="deck-select" data-deck-toggle="${esc(key)}" title="${on ? 'Remove from optimizer' : 'Add to optimizer'}">
                    <i>${on ? '✓' : '+'}</i>
                    ${cardImage(card.cardName,'card-thumb-sm')}
                    <span><strong>${esc(card.cardName)}</strong><small>${esc((card.borders || []).join(' + ') || card.mutationWeather || 'Base')} · ×${card.quantity}</small></span>
                  </button>
                  ${on ? `
                    <select data-deck-lock="${esc(key)}" title="Lock position">
                      <option value="-1" ${lock < 0 ? 'selected' : ''}>Auto</option>
                      ${[0,1,2,3].map(pos => `<option value="${pos}" ${lock === pos ? 'selected' : ''}>Slot ${pos + 1}</option>`).join('')}
                    </select>
                  ` : ''}
                </div>
              `
            }).join('') : '<div class="empty-state"><h3>No owned cards found</h3></div>'}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><p class="kicker">SEARCH</p><h3>Find Best Deck</h3></div></div>
        <div class="panel-body deck-search-panel">
          <div class="deck-facts">
            <div><span>Selected</span><b>${selectedCopies}</b></div>
            <div><span>Stat Auras</span><b>${importedAuras.statAuras.length}</b></div>
            <div><span>Skill Auras</span><b>${importedAuras.abilityAuras.length}</b></div>
          </div>
          ${deckError ? `<div class="tool-error">${esc(deckError)}</div>` : ''}
          ${progress ? `
            <div class="search-progress">
              <div><strong>${esc(progress.message || progress.phase || 'Searching…')}</strong><span>${Number(progress.simulations || 0).toLocaleString()} simulations</span></div>
              <div class="progress-track"><i style="width:${Math.min(100, Math.round(((progress.fullySimulated || progress.quickTested || 0) / Math.max(1, progress.fullySimulatedTotal || progress.possibleCombinations || 1)) * 100))}%"></i></div>
            </div>
          ` : ''}
          <div class="tool-actions">
            ${deckWorker
              ? '<button class="secondary" data-deck-cancel>Cancel</button>'
              : `<button class="primary" data-deck-search ${selectedCopies < 4 || selectedCopies > 30 ? 'disabled' : ''}>Find Best Deck</button>`}
          </div>
          <small class="tool-note">Choose up to 30 total card copies. Slot locks are optional.</small>
        </div>
      </section>
    </div>

    <section class="panel native-results">
      <div class="panel-head"><div><p class="kicker">RESULTS</p><h3>${deckResults.length ? 'Best Decks' : 'No search yet'}</h3></div></div>
      <div class="panel-body">
        ${deckResults.length ? `
          <div class="result-list">
            ${deckResults.slice(0,10).map((result,index) => `
              <article class="native-result-card">
                <div class="result-rank">#${index + 1}</div>
                <div class="result-main">
                  <div class="result-cards">${result.loadout.cards.map((card,pos) => `<span>${cardImage(card.cardName,'result-card-thumb')}<b>${pos+1}</b><em>${esc(card.cardName)}</em></span>`).join('')}</div>
                  <div class="result-meta">
                    <span>Median <b>${Math.round(result.metrics.medianDepth).toLocaleString()}</b></span>
                    <span>Average <b>${Math.round(result.metrics.averageDepth).toLocaleString()}</b></span>
                    <span>Low <b>${Math.round(result.metrics.minimumDepth).toLocaleString()}</b></span>
                    <span>Aura <b>${esc(result.loadout.abilityAura?.auraName || result.loadout.statAura?.auraName || 'None')}</b></span>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        ` : '<div class="empty-state compact-empty"><h3>Run the optimizer to see results.</h3></div>'}
      </div>
    </section>
  `
}

const TOWER_FIXED = {
  5:['Good Boy','Good Boy','Good Boy','Shining Armor'],
  10:['Sorcerer','Sorcerer','Trainee','Trainee'],
  15:['Chronus The Hoarder','Greedy Belly','Greedy Belly','Arthur of Excalibur'],
  20:['Demon Hunter','Gunslinger','Stone Scientist','Darling'],
  25:['Black Cat','Black Cat','Black Cat','Black Cat'],
  30:['Crown Prince','Three-Legged Golden Crow','Leviathan','Malik The Sovereign'],
  35:['Ice Queen','Kitsune','A0-ON1','AK4-ON1'],
  40:['Zeus','Arcane Avian','Zeus','Arcane Avian'],
  45:['Frankenstein','Phoenix','Phoenix','Gideon The Insatiable'],
  50:['Admiral Ice','Ice Queen','Hoarfrost Phoenix','Ice Queen'],
  55:['Boreas','Wind Spirit','Wind Spirit','Wind Spirit'],
  60:['Bad Boys','Poseidon','Hades','Lilith The Enchantress'],
  65:['Astraeus','Astraeus','Astraeus','Astraeus'],
  70:['Cronus','Ixion','Cronus','Sciron'],
  75:['Deus Ex','Bad Boys','Bad Boys','Morpheus The Slumberer'],
  80:['Mastermind','Domain Master','Kira','Priest'],
  85:['Savior','Lucifer','Lucifer','Lucifer'],
  90:['Gilgamesh','Ragon','Fafnir','Raze The Destroyer'],
  95:['Shu','Sekhmet','Set','Ra'],
  100:['Shuten-dōji','Susanoo','Tsukuyomi','Amaterasu'],
  105:["Heaven's Armor","Hell's Army",'Judgment Day','Sable The Envious']
}
const CHEESE_POOL = ['Judgment Day','Robin Hood','Parallax','Piccolo','Pandora','Kuchisake-onna','Fate Seamstress','Kira',"Hell's Army",'Noveau Riche']

function ownedCardNames() {
  return new Set(normalizeOwnedCards(activeProfile().game.cards).map(card => card.cardName))
}

function ownedAuraNames() {
  const auras = normalizeOwnedAuras(activeProfile().game.auras)
  return new Set([...auras.statAuras, ...auras.abilityAuras].map(aura => aura.auraName))
}

function towerToolState() {
  return store.get().toolState?.tower?.[activeProfile().id] || { poolOverrides: {} }
}

function updateTowerToolState(next) {
  const profileId = activeProfile().id
  store.update(draft => {
    if (!draft.toolState.tower) draft.toolState.tower = {}
    const current = draft.toolState.tower[profileId] || { poolOverrides: {} }
    draft.toolState.tower[profileId] = { ...current, ...next }
  })
}

function towerPoolEnabled(name) {
  const overrides = towerToolState().poolOverrides || {}
  if (Object.prototype.hasOwnProperty.call(overrides, name)) return Boolean(overrides[name])
  if (!activeProfile().import.importedAt) return true
  return ownedCardNames().has(name)
}

function towerPage() {
  const fixed = TOWER_FIXED[towerFloor]
  const hasPlayerData = Boolean(activeProfile().import.importedAt)
  const owned = ownedCardNames()
  const enabledCount = CHEESE_POOL.filter(towerPoolEnabled).length

  return `
    <section class="page-intro">
      <p class="kicker">TOWER</p>
      <h2>Tower Cheese Maker</h2>
      <p>Uses the copied Tower engine inside this Toolbox repo.</p>
    </section>

    <section class="panel tower-native">
      <div class="panel-head">
        <div><p class="kicker">ENEMIES</p><h3>Tower Floor</h3></div>
        <span class="panel-count">${fixed ? 'Preset floor' : 'Custom lineup'}</span>
      </div>
      <div class="panel-body">
        <div class="tower-control-grid">
          <label><span>Floor</span><input id="towerFloorInput" type="number" min="1" value="${towerFloor}"></label>
          <label><span>Difficulty</span><select id="towerDifficultyInput">${['Normal','Hard','Extreme','Hell','Impossible'].map(name => `<option ${towerDifficulty===name?'selected':''}>${name}</option>`).join('')}</select></label>
        </div>

        <datalist id="towerCardNames">${cardCatalog.filter(card => !card.unobtainable).map(card => `<option value="${esc(card.name)}"></option>`).join('')}</datalist>
        <div class="tower-enemy-grid">
          ${towerEnemies.map((name,index) => {
            const card = cardByName(name)
            return `
              <label class="tower-enemy-box">
                <span>Enemy ${index + 1}</span>
                <input data-tower-enemy="${index}" list="towerCardNames" value="${esc(name)}">
                <div class="tower-enemy-preview">${cardImage(card,'card-thumb-sm')}<div><b>${esc(card?.name || name)}</b><small>${esc(card?.ability || 'Unknown ability')}</small></div></div>
              </label>
            `
          }).join('')}
        </div>
      </div>
    </section>

    <section class="panel cheese-pool-panel">
      <div class="panel-head">
        <div><p class="kicker">CHEESE POOL</p><h3>Search Cards</h3></div>
        <span class="panel-count">${enabledCount}/${CHEESE_POOL.length} enabled</span>
      </div>
      <div class="panel-body">
        <div class="cheese-pool-grid">
          ${CHEESE_POOL.map(name => {
            const enabled = towerPoolEnabled(name)
            const isOwned = owned.has(name)
            return `
              <article class="cheese-card ${enabled ? 'on' : ''} ${hasPlayerData && !isOwned ? 'unowned' : ''}">
                <div><strong>${esc(name)}</strong><small>${hasPlayerData ? (isOwned ? 'Owned' : 'Not in JSON') : 'No JSON loaded'}</small></div>
                <button type="button" data-cheese-toggle="${esc(name)}" class="${enabled ? 'on' : ''}">${enabled ? 'ON' : 'OFF'}</button>
              </article>
            `
          }).join('')}
        </div>
        <small class="tool-note">Cards missing from the player JSON start OFF, but you can turn any of them back ON.</small>
      </div>
    </section>

    <section class="panel tower-search-panel">
      <div class="panel-head"><div><p class="kicker">SEARCH</p><h3>Deep Search</h3></div></div>
      <div class="panel-body">
        ${towerError ? `<div class="tool-error">${esc(towerError)}</div>` : ''}
        ${towerProgress ? `
          <div class="search-progress tower-search-progress">
            <div><strong>${esc(towerProgress.phase || 'Searching…')}</strong><span>${Number(towerProgress.battleSimulations || 0).toLocaleString()} battles</span></div>
            <div class="progress-track"><i style="width:${Math.min(100, Math.round((Number(towerProgress.completed || 0) / Math.max(1, Number(towerProgress.total || 1))) * 100))}%"></i></div>
          </div>
        ` : ''}
        <div class="tool-actions right">
          ${towerWorker ? '<button class="secondary" data-tower-cancel>Cancel</button>' : '<button class="primary" data-tower-search>Deep Search</button>'}
        </div>
      </div>
    </section>

    <section class="panel native-results">
      <div class="panel-head"><div><p class="kicker">RESULTS</p><h3>${towerResult?.recommendations?.length ? 'Cheese Results' : 'No search yet'}</h3></div></div>
      <div class="panel-body">
        ${towerResult?.recommendations?.length ? `
          <div class="result-list">
            ${towerResult.recommendations.map((candidate,index) => `
              <article class="native-result-card">
                <div class="result-rank">#${index + 1}</div>
                <div class="result-main">
                  <div class="result-cards">${candidate.loadout.cards.map((card,pos) => `<span>${cardImage(card.cardName,'result-card-thumb')}<b>${pos+1}</b><em>${esc(card.cardName)}</em></span>`).join('')}</div>
                  <div class="result-meta">
                    <span>Win Rate <b>${(candidate.winRate * 100).toFixed(1)}%</b></span>
                    <span>Progress <b>${(candidate.progress * 100).toFixed(1)}%</b></span>
                    <span>Runs <b>${Number(candidate.runs).toLocaleString()}</b></span>
                    <span>Aura <b>${esc(candidate.loadout.abilityAura?.auraName || 'None')}</b></span>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        ` : '<div class="empty-state compact-empty"><h3>Enter the enemy lineup and run Deep Search.</h3></div>'}
      </div>
    </section>
  `
}


const MAX_DEPTH_BANS = 14
const DEPTHS_DEFAULT_BANS = new Set(['Vampire Lord','Parallax','Samurai'])
const DEPTH_MUTATIONS = ['Storm','Snow','Aurora','Shroud','Meteor Shower','Time Storm','Eclipse','Virus','Blood Rain','Armageddon','Manga']
const DEPTH_BORDERS = ['Platinum','Crystal','Ruby','Galaxy']
const AURA_BORDERS = ['','Platinum','Crystal','Galaxy']

function depthBanEligible(card) {
  return Boolean(card && !card.unobtainable && !card.expires && !card.boss && !DEPTHS_DEFAULT_BANS.has(card.name) && card.pack !== 'Christmas' && card.pack !== 'Halloween' && card.pack !== 'Halloween2')
}

function sanitizeDepthBans(values) {
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(values) ? values : []) {
    const name = String(raw || '')
    const card = cardByName(name)
    if (!depthBanEligible(card) || seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= MAX_DEPTH_BANS) break
  }
  return out
}

function encodeDepthTeam(team) {
  const payload = {
    v: 2,
    c: team.cards.map(slot => [slot.cardName, [...(slot.borders || [])], slot.mutationWeather || '']),
    s: [team.statAura || '', team.statAuraBorder || ''],
    a: [team.abilityAura || '', team.abilityAuraBorder || ''],
  }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return 'CRE1-' + btoa(binary).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')
}

function decodeDepthTeam(code) {
  const clean = String(code || '').trim()
  if (!clean.startsWith('CRE1-')) throw new Error('Team code must start with CRE1-')
  let raw = clean.slice(5).replace(/-/g,'+').replace(/_/g,'/')
  while (raw.length % 4) raw += '='
  const binary = atob(raw)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const payload = JSON.parse(new TextDecoder().decode(bytes))
  if (![1,2].includes(payload.v) || !Array.isArray(payload.c) || payload.c.length !== 4) throw new Error('Unsupported team code')
  const team = {
    cards: payload.c.map(slot => ({
      cardName: String(slot?.[0] || ''),
      borders: Array.isArray(slot?.[1]) ? slot[1].filter(border => DEPTH_BORDERS.includes(border)) : [],
      mutationWeather: payload.v >= 2 && DEPTH_MUTATIONS.includes(slot?.[2]) ? slot[2] : '',
    })),
    statAura: String(payload.s?.[0] || ''),
    statAuraBorder: AURA_BORDERS.includes(payload.s?.[1]) ? payload.s[1] : '',
    abilityAura: String(payload.a?.[0] || ''),
    abilityAuraBorder: AURA_BORDERS.includes(payload.a?.[1]) ? payload.a[1] : '',
  }
  for (const slot of team.cards) if (slot.cardName && !cardByName(slot.cardName)) throw new Error('Unknown card: ' + slot.cardName)
  return team
}

function encodeDepthBans(bans) {
  const payload = { v: 2, bans: sanitizeDepthBans(bans) }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return 'CRB1-' + btoa(binary)
}

function decodeDepthBans(code) {
  const raw = String(code || '').trim()
  if (!raw.startsWith('CRB1-')) throw new Error('Ban code must start with CRB1-')
  let payload
  try {
    const binary = atob(raw.slice(5))
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    payload = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('Invalid ban code')
  }
  if (payload?.v === 2 && Array.isArray(payload.bans)) return sanitizeDepthBans(payload.bans)
  if (payload?.v === 1 && Array.isArray(payload.layouts)) {
    const source = Math.max(0, Math.min(3, Math.floor(Number(payload.active) || 0)))
    return sanitizeDepthBans(payload.layouts[source])
  }
  throw new Error('Unsupported ban code')
}

function durationLabel(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  if (total < 60) return total.toFixed(1) + 's'
  if (total < 3600) return Math.floor(total / 60) + 'm ' + Math.round(total % 60) + 's'
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  return hours + 'h ' + minutes + 'm'
}

function defaultDepthsState() {
  return {
    activeTeam: 0,
    activeSlot: 0,
    ownedOnly: Boolean(activeProfile().import.importedAt),
    teams: Array.from({ length: 5 }, () => ({
      cards: Array.from({ length: 4 }, () => ({ cardName: '', borders: [], mutationWeather: '' })),
      statAura: '',
      statAuraBorder: '',
      abilityAura: '',
      abilityAuraBorder: '',
    })),
    runs: 15,
    startFloor: 1,
    battleSpeedStructureLevel: 0,
    skillTreeBattleSpeedLevel: 0,
    chronoShard: true,
    bountifulDepths: false,
    depthBanLayouts: [[],[],[],[]],
    activeDepthBanLayout: 0,
    depthBanQuery: '',
  }
}

function depthsToolState() {
  const saved = store.get().toolState?.depths?.[activeProfile().id]
  if (!saved) return defaultDepthsState()
  const next = { ...defaultDepthsState(), ...saved }
  next.depthBanLayouts = Array.isArray(saved.depthBanLayouts)
    ? Array.from({ length: 4 }, (_,index) => sanitizeDepthBans(saved.depthBanLayouts[index]))
    : [sanitizeDepthBans(saved.depthBans),[],[],[]]
  next.activeDepthBanLayout = Math.max(0, Math.min(3, Number(saved.activeDepthBanLayout) || 0))
  next.depthBanQuery = String(saved.depthBanQuery || '')
  return next
}

function updateDepthsToolState(mutator) {
  const profileId = activeProfile().id
  store.update(draft => {
    if (!draft.toolState.depths) draft.toolState.depths = {}
    const current = draft.toolState.depths[profileId] || defaultDepthsState()
    const next = structuredClone(current)
    mutator(next)
    draft.toolState.depths[profileId] = next
  })
}

function depthsTeamReady(team) {
  return Boolean(team?.cards?.length === 4 && team.cards.every(card => card.cardName))
}

function depthAuraOptions(type) {
  const owned = normalizeOwnedAuras(activeProfile().game.auras)
  const ownedList = type === 'Stat' ? owned.statAuras : owned.abilityAuras
  if (activeProfile().import.importedAt && ownedList.length) {
    const names = new Set(ownedList.map(aura => aura.auraName))
    return auraCatalog.filter(aura => aura.type === type && names.has(aura.name))
  }
  return auraCatalog.filter(aura => aura.type === type && !aura.unobtainable)
}

function depthLoadout(team) {
  return {
    cards: team.cards.map(card => ({
      cardName: card.cardName,
      borders: [...(card.borders || [])],
      mutationWeather: card.mutationWeather || null,
    })),
    statAura: team.statAura ? { auraName: team.statAura, border: team.statAuraBorder || null } : null,
    abilityAura: team.abilityAura ? { auraName: team.abilityAura, border: team.abilityAuraBorder || null } : null,
  }
}


const DEPTH_BORDER_MULT = { Platinum:100, Crystal:10000, Ruby:100000, Galaxy:1000000 }
const DEPTH_MUTATION_MULT = { Storm:1.1, Snow:1.2, Aurora:1.3, Shroud:1.5, 'Meteor Shower':1.8, 'Time Storm':2, Eclipse:2.5, Virus:3, 'Blood Rain':3.5, Armageddon:4, Manga:4.5 }
const DEPTH_AURA_RARITY_MULT = { Platinum:10, Crystal:100, Galaxy:1000 }
const DEPTH_AURA_TIER = { '':0, Platinum:1, Crystal:2, Galaxy:3 }
const DEPTH_AURA_CUSTOM = {
  Berserker:[5,10,15,20],
  'Flame Wizard':[15,25,35,50],
  Shielder:[2,5,7,10],
  'Synth Human':[8,10,12,15],
  'Storm Spirit':[10,15,20,30],
  'Guardian Angel':[10,15,20,30],
  Executioner:[15,25,35,50],
  'Mirror Knight':[10,15,20,30],
  'Final Testament':[5,7.5,10,12.5,15],
}

function depthMutationEligible(card) {
  return Boolean(card && !card.weather && !card.boss && !card.expires && !card.unobtainable)
}

function depthCardPower(card, borders = [], mutationWeather = '') {
  if (!card) return 0
  let rarity = card.name === 'Ouroboros' ? 100000000000000 : Number(card.rarity || 0)
  for (const border of borders) rarity *= DEPTH_BORDER_MULT[border] || 1
  const mutation = DEPTH_MUTATION_MULT[mutationWeather] || 1
  return rarity > 0 ? Math.pow(2, Math.log10(rarity)) * 10 * (Number(card.statMultiplier) || 1) * mutation : 0
}

function depthCardStats(card, slot) {
  const power = depthCardPower(card, slot?.borders || [], slot?.mutationWeather || '')
  return { hp: power * (Number(card?.hpMultiplier) || 1), attack: power / 2 }
}

function depthAuraValue(aura, border) {
  if (!aura) return 0
  if (aura.type === 'Stat') {
    const rarity = (Number(aura.rarity) || 0) * (DEPTH_AURA_RARITY_MULT[border] || 1)
    return rarity > 0 ? Math.floor(Math.pow(2, Math.log10(rarity)) / 2) : 0
  }
  const tier = DEPTH_AURA_TIER[border] || 0
  const custom = DEPTH_AURA_CUSTOM[aura.name]
  return custom ? (custom[tier] ?? custom[0] ?? 0) : (Number(aura.base) || 0) + (Number(aura.perLevel) || 0) * tier
}

function depthAuraBlock(team, type, label, auraKey, borderKey) {
  const choices = depthAuraOptions(type)
  const selected = auraCatalog.find(aura => aura.name === team[auraKey]) || null
  const border = team[borderKey] || ''
  const value = depthAuraValue(selected, border)
  const desc = selected?.description ? String(selected.description).replace(/(\d+(?:\.\d+)?)?STAT/g, (_,coef) => ((coef ? Number(coef) : 1) * value).toFixed(1).replace(/\.0$/,'') + '%') : ''
  return `
    <div class="depth-exact-aura-card">
      <div class="depth-exact-aura-title">
        ${selected ? cardImage(selected,'depth-exact-aura-image') : '<span class="depth-exact-aura-image depth-empty-image">◇</span>'}
        <span><b>${label}</b><small>${esc(selected?.skillName || selected?.type || 'Choose one aura')}</small></span>
      </div>
      <select data-depth-aura-select="${auraKey}">
        <option value="">No ${label.toLowerCase()}</option>
        ${choices.map(aura => `<option value="${esc(aura.name)}" ${aura.name===team[auraKey]?'selected':''}>${esc(aura.name)} · ${esc(aura.skillName || '')}</option>`).join('')}
      </select>
      <div class="depth-exact-aura-pills">
        ${['','Platinum','Crystal','Galaxy'].map(option => `<button type="button" data-depth-aura-border-key="${borderKey}" data-depth-aura-border="${option}" class="${border===option?'on':''}">${option || 'Base'}</button>`).join('')}
      </div>
      ${selected ? `<div class="depth-exact-aura-summary">${selected.type==='Stat' ? `<div><span>All allied cards</span><b>+${value}%</b><small>HP & ATK</small></div>` : `<p>${esc(desc || selected.description || '')}</p>`}</div>` : ''}
    </div>
  `
}

function depthsProgressText(progress, teamIndex, fallbackRuns, startFloor) {
  if (!progress) return null
  const done = Number(progress.completedRuns) || 0
  const total = Number(progress.totalRuns) || fallbackRuns || 1
  const active = Number(progress.activeRuns) || Math.max(1, total - done)
  const currentFloor = Number(progress.floor) || startFloor || 1
  const minFloor = Number(progress.minActiveFloor) || currentFloor
  const maxFloor = Number(progress.maxActiveFloor) || minFloor
  const range = minFloor === maxFloor
    ? 'Floor ' + Number(minFloor).toLocaleString()
    : 'Floors ' + Number(minFloor).toLocaleString() + '–' + Number(maxFloor).toLocaleString()
  const turn = Number(progress.battleTurn) || 0
  const enemies = Array.isArray(progress.enemies) ? progress.enemies : []
  const matchup = turn >= 150 && enemies.length ? ' · vs ' + enemies.join(' / ') : ''
  return {
    title: 'Team ' + (teamIndex + 1) + ' · ' + done + '/' + total + ' runs done · ' + active + ' active',
    detail: range + (turn ? ' · current T' + turn : '') + matchup,
    pct: Math.min(100, Math.max(0, Math.round((done / Math.max(1,total)) * 100))),
  }
}
function depthsPage() {
  const state = depthsToolState()
  const team = state.teams[state.activeTeam]
  const owned = ownedCardNames()
  const query = depthsQuery.trim().toLowerCase()
  const selectable = cardCatalog
    .filter(card => !card.unobtainable || card.name === 'Conqueror')
    .filter(card => !state.ownedOnly || !activeProfile().import.importedAt || owned.has(card.name))
    .filter(card => !query || card.name.toLowerCase().includes(query) || String(card.ability || '').toLowerCase().includes(query))
    .sort((a,b) => b.rarity - a.rarity)
    .slice(0,100)

  const ready = state.teams.filter(depthsTeamReady).length
  const activeBans = state.depthBanLayouts[state.activeDepthBanLayout] || []
  const banQuery = state.depthBanQuery.trim().toLowerCase()
  const banCandidates = banQuery
    ? cardCatalog.filter(depthBanEligible).filter(card => !activeBans.includes(card.name))
        .filter(card => card.name.toLowerCase().includes(banQuery) || String(card.ability || '').toLowerCase().includes(banQuery))
        .sort((a,b) => a.name.localeCompare(b.name)).slice(0,8)
    : []
  const running = depthsWorkers.size > 0

  return `
    <div class="depths-exact">
      <header class="depths-exact-topbar">
        <div><p class="kicker">CARD RNG EXPANSION</p><h1>Depths Calculator</h1></div>
      </header>

      <div class="depths-exact-tabs">
        ${state.teams.map((item,index) => {
          const result = depthsResults[index]
          return `<button data-depth-team="${index}" class="${state.activeTeam===index?'on':''}"><span>Team ${index+1}</span><i>${result ? (result.error ? 'Error' : 'Range ' + compactNumber(result.estimatedFloorLow) + '–' + compactNumber(result.estimatedFloorHigh)) : depthsTeamReady(item) ? 'Ready' : 'Empty'}</i></button>`
        }).join('')}
        <button class="depths-exact-tab-action" data-depth-duplicate>Duplicate</button>
      </div>

      <section class="depths-exact-workspace">
        <article class="panel depths-exact-loadout">
          <div class="panel-head">
            <div><span class="kicker">LOADOUT</span><h3>Team ${state.activeTeam+1}</h3></div>
            <div class="panel-head-actions">
              <button class="text-mini" data-depth-copy-team>Copy code</button>
              <button class="text-mini" data-depth-import-team>Import code</button>
              <button class="text-mini danger" data-depth-clear-team>Clear team</button>
            </div>
          </div>

          <div class="depths-exact-team-list">
            ${team.cards.map((slot,index) => {
              const card = cardByName(slot.cardName)
              if (!card) return `
                <div class="depths-exact-team-row empty ${state.activeSlot===index?'active':''}" data-depth-slot="${index}" draggable="true">
                  <span class="depths-exact-slot">0${index+1}</span>
                  <span class="depths-exact-portrait depth-empty-image">+</span>
                  <span class="depths-exact-card-copy"><span class="depths-exact-name-line"><b>Select a card</b></span><span class="depths-exact-numbers">Choose from the library</span></span>
                </div>`

              const mutation = depthMutationEligible(card) ? (slot.mutationWeather || '') : ''
              const stats = depthCardStats(card, slot)
              return `
                <div class="depths-exact-team-row ${state.activeSlot===index?'active':''}" data-depth-slot="${index}" draggable="true">
                  <span class="depths-exact-slot">0${index+1}</span>
                  ${cardImage(card,'depths-exact-portrait')}
                  <span class="depths-exact-card-copy">
                    <span class="depths-exact-name-line"><b>${esc(card.name)}</b><em>${esc(card.ability || 'No ability')}</em></span>
                    <span class="depths-exact-numbers"><i><b>${compactNumber(stats.hp)}</b> HP</i><i><b>${compactNumber(stats.attack)}</b> ATK</i>${mutation ? `<i><b>${esc(mutation)}</b> ×${DEPTH_MUTATION_MULT[mutation]} Mutation</i>` : ''}</span>
                    <span class="depths-exact-border-pills">
                      ${DEPTH_BORDERS.map(border => `<label class="${slot.borders.includes(border)?'on':''}" data-depth-border-slot="${index}" data-depth-border-name="${border}">${border}</label>`).join('')}
                    </span>
                    ${depthMutationEligible(card) ? `<label class="depths-exact-mutation">Mutation <select data-depth-mutation-slot="${index}"><option value="">None</option>${DEPTH_MUTATIONS.map(weather => `<option value="${weather}" ${mutation===weather?'selected':''}>${weather} · ×${DEPTH_MUTATION_MULT[weather]}</option>`).join('')}</select></label>` : ''}
                  </span>
                </div>`
            }).join('')}
          </div>

          <div class="depths-exact-aura-grid">
            ${depthAuraBlock(team,'Stat','Stat Aura','statAura','statAuraBorder')}
            ${depthAuraBlock(team,'Skill','Ability Aura','abilityAura','abilityAuraBorder')}
          </div>
        </article>

        <article class="panel depths-exact-library">
          <div class="panel-head">
            <div><span class="kicker">Cards</span><h3>Team ${state.activeSlot+1}</h3></div>
            <small>${selectable.length} shown</small>
          </div>
          <div class="depth-library-toolbar">
            <input id="depthSearch" class="depths-exact-search" value="${esc(depthsQuery)}" placeholder="Search card or ability…" autocomplete="off">
            <button class="secondary small" data-depth-owned-toggle>${state.ownedOnly && activeProfile().import.importedAt ? 'Owned Only' : 'All Cards'}</button>
          </div>
          <div class="depths-exact-library-list">
            ${selectable.length ? selectable.map(card => `
              <button data-depth-card="${esc(card.name)}" class="${team.cards[state.activeSlot]?.cardName===card.name?'selected':''}">
                ${cardImage(card,'depths-exact-mini-portrait')}
                <span><b>${esc(card.name)}</b><small>${esc(card.ability || 'No ability')}</small></span>
                <em>1 / ${compactNumber(card.rarity)}</em>
              </button>
            `).join('') : '<div class="empty-state">No matching cards.</div>'}
          </div>
        </article>

        <article class="panel depths-exact-simulation">
          <div class="panel-head">
            <div><span class="kicker">DEPTHS TEST</span><h3>Run simulator</h3></div>
            <small>${ready}/5 teams ready</small>
          </div>
          <div class="depths-exact-sim-body">
            <div class="depths-exact-sim-field">
              <span>Runs per team</span>
              <div class="depths-exact-run-options">${[1,3,8,15,30,50].map(value => `<button data-depth-runs="${value}" class="${state.runs===value?'on':''}">${value}</button>`).join('')}</div>
            </div>

            <label class="depths-exact-sim-field"><span>Start floor</span><input id="depthStartFloor" type="number" min="1" max="40000" value="${state.startFloor}"><small>Skips floors below this during simulation. Max 40,000.</small></label>
            <label class="depths-exact-sim-field"><span>Floor cap</span><input value="100000" readonly></label>
            <label class="depths-exact-sim-field"><span>Battle Speed Structure</span><select id="depthStructureLevel">${Array.from({length:8},(_,value)=>`<option value="${value}" ${state.battleSpeedStructureLevel===value?'selected':''}>Level ${value} · +${(value*.25).toFixed(2)} Battle Speed</option>`).join('')}</select></label>
            <label class="depths-exact-sim-field"><span>Skill Tree Battle Speed</span><select id="depthSkillLevel">${[0,.5,1,1.5,2.5].map((bonus,value)=>`<option value="${value}" ${state.skillTreeBattleSpeedLevel===value?'selected':''}>Level ${value} · +${bonus.toFixed(2)} Battle Speed</option>`).join('')}</select><small>Skill Tree values: +0.50, +0.50, +0.50, then +1.00 at level 4.</small></label>

            <div class="depths-exact-relic ${state.chronoShard?'on':''}"><div><span>Chrono Shard</span><small>Relic · +1 Battle Speed. Turn this off if you do not own/use the relic.</small></div><button type="button" data-depth-chrono>${state.chronoShard?'ON':'OFF'}</button></div>
            <div class="depths-exact-relic ${state.bountifulDepths?'on':''}"><div><span>Bountiful Depths</span><small>Relic · +25% potion drop chance. This changes reward estimates only, not combat.</small></div><button type="button" data-depth-bountiful>${state.bountifulDepths?'ON':'OFF'}</button></div>

            <div class="depths-exact-ban-box">
              <div class="depths-exact-ban-layouts">
                <div class="depths-exact-ban-tabs">${state.depthBanLayouts.map((bans,index) => `<button type="button" data-depth-ban-layout="${index}" class="${state.activeDepthBanLayout===index?'on':''}"><span>Ban ${index+1}</span><small>${bans.length}/${MAX_DEPTH_BANS}</small></button>`).join('')}</div>
                <div class="depths-exact-ban-actions"><button type="button" data-depth-ban-export>Export Bans</button><button type="button" data-depth-ban-import>Import Bans</button></div>
              </div>
              <div class="depths-exact-ban-head"><span>Depth bans · Ban ${state.activeDepthBanLayout+1}</span><div>${activeBans.length?'<button type="button" data-depth-ban-clear>Clear</button>':''}<b>${activeBans.length}/${MAX_DEPTH_BANS}</b></div></div>
              <small>Optional player ban slots. Vampire Lord, Parallax, and Samurai are permanently banned and do not use these slots.</small>
              ${activeBans.length ? `<div class="depths-exact-ban-chips">${activeBans.map((name,index)=>`<button type="button" data-depth-ban-remove="${index}">${esc(name)} ×</button>`).join('')}</div>` : ''}
              <div class="depths-exact-ban-search">
                <input id="depthBanSearch" value="${esc(state.depthBanQuery)}" placeholder="${activeBans.length>=MAX_DEPTH_BANS?'14/14 bans selected':'Search a card to ban…'}" ${activeBans.length>=MAX_DEPTH_BANS?'disabled':''}>
                ${banQuery && activeBans.length<MAX_DEPTH_BANS ? `<div class="depths-exact-ban-suggestions">${banCandidates.length ? banCandidates.map(card=>`<button type="button" data-depth-ban-add="${esc(card.name)}"><span>${esc(card.name)}</span><small>${esc(card.ability || 'No ability')}</small></button>`).join('') : '<small>No eligible Depth enemies found.</small>'}</div>` : ''}
              </div>
            </div>

            ${depthsProgress[state.activeTeam] ? (() => {
              const progress = depthsProgressText(depthsProgress[state.activeTeam], state.activeTeam, state.runs, state.startFloor)
              return `<div class="search-progress depths-live-progress"><div><strong>${esc(progress.title)}</strong><span>${esc(progress.detail)}</span></div><div class="progress-track"><i style="width:${progress.pct}%"></i></div></div>`
            })() : ''}

            <div class="depths-exact-sim-actions">
              ${running ? '<button class="secondary-run" disabled>Simulation running…</button><button class="sim-run" data-depth-cancel>Cancel simulation</button>' : `<button class="secondary-run" data-depth-run-active ${!depthsTeamReady(team)?'disabled':''}>Test Team ${state.activeTeam+1}</button><button class="sim-run" data-depth-run-ready ${ready===0?'disabled':''}>Test ${ready} Ready Team${ready===1?'':'s'}</button>`}
            </div>
          </div>
        </article>
      </section>

      <section class="depths-exact-results">
        <div class="depths-exact-results-title"><div><span class="kicker">DEPTHS TEST RESULTS</span><h3>${Object.keys(depthsResults).length ? 'Team comparison' : 'No simulations yet'}</h3></div>${Object.keys(depthsResults).length?'<button class="text-mini" data-depth-clear-results>Clear results</button>':''}</div>
        ${Object.entries(depthsResults).length ? `
          <div class="depths-exact-result-grid">
            ${Object.entries(depthsResults).sort((a,b)=>Number(a[0])-Number(b[0])).map(([index,result]) => {
              if (result.error) return `<article class="depths-exact-result-card"><div class="tool-error">Team ${Number(index)+1}: ${esc(result.error)}</div></article>`
              const avgTurns = result.runs?.length ? result.runs.reduce((sum,run)=>sum + (Number(run.totalTurns)||0),0)/result.runs.length : 0
              return `
                <article class="depths-exact-result-card">
                  <div class="depths-exact-result-head"><span class="kicker">TEAM ${Number(index)+1}</span></div>
                  <div class="depths-exact-result-metrics">
                    <div><span>Estimated Depth range</span><b>${compactNumber(result.estimatedFloorLow)} – ${compactNumber(result.estimatedFloorHigh)}</b></div>
                    <div><span>Median Depth</span><b>${compactNumber(result.medianFloor)}</b></div>
                    <div><span>Aura Pack reward</span><b>${compactNumber(result.auraPackLow)} – ${compactNumber(result.auraPackHigh)}</b><small>Median: ${compactNumber(result.auraPackMedian)}</small></div>
                    <div><span>Estimated clear time</span><b>${durationLabel(result.estimatedSecondsMedian)}</b><small>${durationLabel(result.estimatedSecondsLow)}–${durationLabel(result.estimatedSecondsHigh)}</small></div>
                    <div><span>Aura cards / hour</span><b>${compactNumber(result.auraCardsPerHour)}</b></div>
                  </div>
                  <div class="result-meta"><span>${result.runs?.length || 0} runs</span><span>${avgTurns.toFixed(1)} avg turns</span></div>
                  ${result.runs?.length ? `<div class="depth-floor-strip">${result.runs.map((run,runIndex)=>`<button type="button" data-depth-run-detail="${index}:${runIndex}">${compactNumber(run.deathFloor)}</button>`).join('')}</div>` : ''}
                </article>`
            }).join('')}
          </div>
        ` : '<div class="depths-exact-results-empty">Build a complete four-card team, choose any auras you use, then run a test.</div>'}
      </section>
    </div>
  `
}


function towerPower(floor, difficulty) {
  const ids = { Normal: 1, Hard: 2, Extreme: 3, Hell: 5, Impossible: 6 }
  const stage = Math.max(1, Math.floor(Number(floor) || 1))
  const stageValue = 6000 + Math.pow(stage, 3) * 50
  const difficultyId = ids[difficulty] || 1
  return Math.ceil(2 * Math.sqrt(stageValue / 2) * Math.pow(4, difficultyId - 1))
}

function calculatorsPage() {
  return `
    <section class="page-intro">
      <p class="kicker">UTILITIES</p>
      <h2>Calculators</h2>
      <p>Quick Card RNG calculators.</p>
    </section>
    <div class="calc-grid">
      <section class="panel">
        <div class="panel-head"><div><p class="kicker">ROLLS</p><h3>Roll Speed</h3></div></div>
        <div class="panel-body calc-body">
          <label><span>Roll speed bonus %</span><input id="rollSpeedBonus" type="number" min="0" step="1" value="0"></label>
          <div class="calc-result"><span>Seconds per roll</span><b id="rollSeconds">1.500s</b><small id="rollRps">0.667 rolls/sec</small></div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><p class="kicker">TOWER</p><h3>Enemy Stats</h3></div></div>
        <div class="panel-body calc-body">
          <label><span>Floor</span><input id="towerCalcFloor" type="number" min="1" value="59"></label>
          <label><span>Difficulty</span><select id="towerCalcDifficulty"><option>Normal</option><option>Hard</option><option>Extreme</option><option selected>Hell</option><option>Impossible</option></select></label>
          <div class="calc-result"><span>HP / ATK</span><b id="towerCalcHp">—</b><small id="towerCalcAtk">—</small></div>
        </div>
      </section>
    </div>
  `
}

function page() {
  if (route === 'dashboard') return dashboardPage()
  if (route === 'player') return playerPage()
  if (route === 'inventory') return inventoryPage()
  if (route === 'library') return cardLibraryPage()
  if (route === 'deck-helper') return deckHelperPage()
  if (route === 'depths') return depthsPage()
  if (route === 'tower') return towerPage()
  if (route === 'calculators') return calculatorsPage()
  return ''
}

function modal() {
  const updating = Boolean(activeProfile().import.importedAt)
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${updating ? 'Update' : 'Import'} player JSON" onclick="event.stopPropagation()">
        <div class="modal-head"><div><p class="kicker">PLAYER DATA</p><h2>${updating ? 'Update JSON' : 'Import JSON'}</h2></div><button class="icon-btn" data-action="close-modal">×</button></div>
        <textarea id="jsonInput" spellcheck="false" placeholder='{"username":"Player","cards":[...]}'></textarea>
        <div id="importError" class="form-error"></div>
        <div class="modal-actions"><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="save-json">${updating ? 'Update' : 'Import'}</button></div>
      </div>
    </div>
  `
}

function render() {
  app.innerHTML = `
    <div class="app-shell">
      ${sidebar()}
      <main class="workspace">
        ${header()}
        <div class="content">${page()}</div>
      </main>
    </div>
    <div id="modalRoot"></div>
  `
  bind()
}

function openImport() {
  document.querySelector('#modalRoot').innerHTML = modal()
  requestAnimationFrame(() => document.querySelector('#jsonInput')?.focus())
  bind()
}

function closeModal() {
  const root = document.querySelector('#modalRoot')
  if (root) root.innerHTML = ''
}

function saveJson() {
  const input = document.querySelector('#jsonInput')
  const error = document.querySelector('#importError')
  try {
    const parsed = JSON.parse(input.value)
    const profile = normalizeImportedJson(parsed, activeProfile())
    store.replaceProfile(profile)
    closeModal()
    routeTo('dashboard')
  } catch (err) {
    if (error) error.textContent = err instanceof Error ? err.message : 'Invalid JSON'
  }
}

function showDepthsRunDebug(teamIndex,runIndex){
    const run=depthsResults[teamIndex]?.runs?.[runIndex],d=run?.debug;if(!run)return;
    const fmt=n=>Number.isFinite(Number(n))?Math.round(Number(n)).toLocaleString('en-US'):'?';
    const compactDbg=n=>Number.isFinite(Number(n))?Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(Number(n)).replace(/\s/g,'').toLowerCase():'?';
    const compactText=value=>String(value??'').replace(/-?\b\d{4,}(?:\.\d+)?\b/g,raw=>compactDbg(Number(raw)));
    const side=t=>t==='Allies'?'PLAYER':'ENEMY';
    const visibleEvents=()=>d?.events||[];
    const matchCard=c=>`<div class="dbg-match-card"><div><b>${esc(c.name)}</b><small>${esc(c.ability||'No ability')}</small></div><span>${compactDbg(c.hp)} HP · ${compactDbg(c.damage)} ATK</span></div>`;
    const matchTeam=(list,label,kind)=>`<section class="dbg-match-team ${kind}"><div class="dbg-match-team-title">${label}</div><div class="dbg-match-cards">${list?.length?list.map(matchCard).join(''):'<div class="dbg-match-empty">No cards</div>'}</div></section>`;
    const auraLine=()=>{const parts=[];if(d?.statAura)parts.push(`Stat Aura: ${esc(d.statAura.name)} · ${esc(d.statAura.border||'Base')}`);if(d?.abilityAura)parts.push(`Ability Aura: ${esc(d.abilityAura.name)} · ${esc(d.abilityAura.border||'Base')}`);return parts.length?`<div class="dbg-aura-line">${parts.join('<span>•</span>')}</div>`:''};
    const parseTurn=e=>{
      const m=String(e.detail||'').match(/^vs (.*?) \| attacker ([\d.-]+)\/([\d.-]+) HP ([\d.-]+) ATK \| defender ([\d.-]+)\/([\d.-]+) HP ([\d.-]+) ATK$/);
      if(!m)return null;
      return {target:m[1],aHp:Number(m[2]),aMax:Number(m[3]),aAtk:Number(m[4]),dHp:Number(m[5]),dMax:Number(m[6]),dAtk:Number(m[7])};
    };
    const hpPct=(hp,max)=>Math.max(0,Math.min(100,max>0?hp/max*100:0));
    const fightCard=(name,hp,max,atk,align='left')=>`<div class="dbg-fighter ${align}"><div class="dbg-fighter-top"><b>${esc(name)}</b><span>${compactDbg(hp)} / ${compactDbg(max)} HP</span></div><div class="dbg-hp"><i style="width:${hpPct(hp,max)}%"></i></div><div class="dbg-fighter-atk">${compactDbg(atk)} ATK</div></div>`;
    const eventLine=e=>{
      if(e.type==='ability')return `<div class="dbg-interaction ability"><span>ABILITY</span><b>${esc(e.card)}</b><p>${esc(compactText(e.detail||''))}</p></div>`;
      if(e.type==='death')return `<div class="dbg-interaction death"><span>DEATH</span><b>${esc(e.card)}</b><p>${esc(compactText(e.detail||'Card defeated'))}</p></div>`;
      if(e.type==='revive')return `<div class="dbg-interaction revive"><span>REVIVE</span><b>${esc(e.card)}</b><p>${esc(compactText(e.detail||''))}</p></div>`;
      if(e.type==='spawn')return `<div class="dbg-interaction spawn"><span>SPAWN</span><b>${esc(e.card)}</b><p>${esc(compactText(e.detail||''))}</p></div>`;
      if(e.type==='stall')return `<div class="dbg-interaction stall"><span>STALL</span><b>${esc(e.card)}</b><p>${esc(compactText(e.detail||''))}</p></div>`;
      return '';
    };
    const buildTimeline=()=>{
      const groups=[];
      for(const e of visibleEvents()){
        let group=groups[groups.length-1];
        if(!group||group.turn!==e.turn){group={turn:e.turn,events:[]};groups.push(group)}
        group.events.push(e);
      }
      return groups.map(group=>{
        const turnEvent=group.events.find(e=>e.type==='turn');
        const parsed=turnEvent?parseTurn(turnEvent):null;
        const extras=group.events.filter(e=>e.type!=='turn').map(eventLine).join('');
        let fight='';
        if(turnEvent&&parsed){
          const playerAttacking=turnEvent.team==='Allies';
          fight=playerAttacking
            ?`<div class="dbg-fight player-attack">${fightCard(turnEvent.card,parsed.aHp,parsed.aMax,parsed.aAtk,'player')}<div class="dbg-vs"><i>→</i></div>${fightCard(parsed.target,parsed.dHp,parsed.dMax,parsed.dAtk,'enemy')}</div>`
            :`<div class="dbg-fight enemy-attack">${fightCard(parsed.target,parsed.dHp,parsed.dMax,parsed.dAtk,'player')}<div class="dbg-vs"><i>←</i></div>${fightCard(turnEvent.card,parsed.aHp,parsed.aMax,parsed.aAtk,'enemy')}</div>`;
        }else if(turnEvent){
          fight=`<div class="dbg-fight-simple"><b>${esc(turnEvent.card)}</b><span>${esc(compactText(turnEvent.detail||''))}</span></div>`;
        }
        return `<section class="dbg-turn"><div class="dbg-turn-head"><b>TURN ${group.turn}</b>${turnEvent?`<span class="${turnEvent.team==='Allies'?'player':'enemy'}">${side(turnEvent.team)} TURN</span>`:'<span></span>'}<i></i></div>${fight}${extras?`<div class="dbg-interactions">${extras}</div>`:''}</section>`;
      }).join('')||'<div class="dbg-empty">No battle events captured.</div>';
    };
    const plainText=()=>{
      const lines=[];
      lines.push(`TEAM ${teamIndex+1} · RUN ${runIndex+1} · DEATH FLOOR ${fmt(run.deathFloor)}`);
      let last=null;
      for(const e of visibleEvents()){
        if(e.turn!==last){last=e.turn;lines.push('',`TURN ${e.turn}`)}
        const parsed=e.type==='turn'?parseTurn(e):null;
        if(parsed){
          lines.push(`  ${side(e.team)} · ${e.card} → ${parsed.target}`);
          lines.push(`    ${e.card}: ${compactDbg(parsed.aHp)}/${compactDbg(parsed.aMax)} HP · ${compactDbg(parsed.aAtk)} ATK`);
          lines.push(`    ${parsed.target}: ${compactDbg(parsed.dHp)}/${compactDbg(parsed.dMax)} HP · ${compactDbg(parsed.dAtk)} ATK`);
        }else if(e.type!=='turn'){
          lines.push(`  [${e.type.toUpperCase()}] ${e.card}: ${compactText(e.detail||'')}`);
        }
      }
      return lines.join('\n');
    };
    const dialog=document.createElement('dialog');dialog.className='dbg-dialog';
    dialog.innerHTML=`<div class="dbg-shell"><div class="dbg-head"><div><span class="dbg-kicker">BATTLE DEBUG</span><h3>Team ${teamIndex+1} · Run ${runIndex+1}</h3><div class="dbg-sub">Death floor ${fmt(run.deathFloor)}</div></div><div class="dbg-actions"><button data-dbg-copy>Copy debug</button><button data-dbg-close>Close</button></div></div><div class="dbg-scroll"><div class="dbg-matchup">${matchTeam(d?.initialAllies,'YOUR TEAM','player')}<div class="dbg-match-vs">VS</div>${matchTeam(d?.initialEnemies,'ENEMY TEAM','enemy')}</div>${auraLine()}<div data-dbg-timeline></div></div></div>`;
    document.body.appendChild(dialog);
    const timeline=dialog.querySelector('[data-dbg-timeline]'),copy=dialog.querySelector('[data-dbg-copy]'),close=dialog.querySelector('[data-dbg-close]');
    timeline.innerHTML=buildTimeline();
    dialog.showModal();
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(plainText());copy.textContent='Copied!';setTimeout(()=>{if(copy.isConnected)copy.textContent='Copy debug'},900)}catch(_){}});
    close.addEventListener('click',()=>{dialog.close();dialog.remove()});
    dialog.addEventListener('cancel',()=>dialog.remove());
  }

function clearDepthResult(index) {
  delete depthsResults[index]
}

function cancelDepthsRuns() {
  for (const worker of depthsWorkers.values()) worker.terminate()
  depthsWorkers.clear()
  for (const key of Object.keys(depthsProgress)) delete depthsProgress[key]
  depthsLastProgressRender.clear()
  render()
}

function startDepthsRuns(indices) {
  const state = depthsToolState()
  for (const index of indices) {
    if (!depthsTeamReady(state.teams[index])) continue
    depthsWorkers.get(index)?.terminate()
    const worker = new Worker('./assets/depths-worker.js?v=2')
    depthsWorkers.set(index, worker)
    const id = ++depthRequestId
    depthsProgress[index] = { completedRuns: 0, totalRuns: state.runs }

    worker.onmessage = event => {
      const message = event.data || {}
      if (message.id !== id) return
      if (message.kind === 'progress') {
        depthsProgress[index] = message
        const now = performance.now()
        const last = depthsLastProgressRender.get(index) || 0
        if (route === 'depths' && now - last > 250) {
          depthsLastProgressRender.set(index, now)
          render()
        }
        return
      }
      if (message.ok) depthsResults[index] = message.result
      else depthsResults[index] = { error: message.error || 'Simulation failed' }
      delete depthsProgress[index]
      depthsLastProgressRender.delete(index)
      worker.terminate()
      depthsWorkers.delete(index)
      if (route === 'depths') render()
    }
    worker.onerror = event => {
      depthsResults[index] = { error: event.message || 'Simulation failed' }
      delete depthsProgress[index]
      worker.terminate()
      depthsWorkers.delete(index)
      if (route === 'depths') render()
    }

    worker.postMessage({
      id,
      loadout: depthLoadout(state.teams[index]),
      runs: state.runs,
      startFloor: state.startFloor,
      floorCap: 100000,
      seed: ((Date.now() + index * 7919) >>> 0) || 1,
      bountifulDepths: state.bountifulDepths,
      battleSpeedStructureLevel: state.battleSpeedStructureLevel,
      skillTreeBattleSpeedLevel: state.skillTreeBattleSpeedLevel,
      chronoShard: state.chronoShard,
      bannedCardNames: sanitizeDepthBans(state.depthBanLayouts[state.activeDepthBanLayout] || []),
    })
  }
  render()
}

function cancelDeckSearch() {
  if (deckWorker) deckWorker.terminate()
  deckWorker = null
  deckProgress = null
  render()
}

function startDeckSearch() {
  const inventory = deckWorkerInventory()
  const copies = inventory.cards.reduce((sum, card) => sum + card.quantity, 0)
  if (copies < 4) {
    deckError = 'Select at least 4 card copies.'
    render()
    return
  }
  deckError = ''
  deckResults = []
  deckLastProgressRender = 0
  deckProgress = { phase: 'prepare', message: 'Starting search…', simulations: 0, possibleCombinations: 1 }
  deckWorker = new Worker('./assets/optimizer-worker.js?v=2')
  deckWorker.onmessage = event => {
    const message = event.data || {}
    if (message.type === 'progress') {
      deckProgress = message.progress
      const now = performance.now()
      if (route === 'deck-helper' && now - deckLastProgressRender > 180) {
        deckLastProgressRender = now
        render()
      }
      return
    }
    if (message.type === 'search-result') {
      deckResults = Array.isArray(message.results) ? message.results : []
      deckProgress = null
      deckWorker?.terminate()
      deckWorker = null
      if (route === 'deck-helper') render()
      return
    }
    if (message.type === 'error') {
      deckError = message.message || 'Deck search failed.'
      deckProgress = null
      deckWorker?.terminate()
      deckWorker = null
      if (route === 'deck-helper') render()
    }
  }
  deckWorker.onerror = event => {
    deckError = event.message || 'Deck search worker failed.'
    deckProgress = null
    deckWorker?.terminate()
    deckWorker = null
    if (route === 'deck-helper') render()
  }
  deckWorker.postMessage({
    type: 'run',
    request: {
      kind: 'search',
      inventory,
      bannedCardNames: [],
      settings: { mode: 'full', maxFloor: 100000 },
    },
  })
  render()
}

function combineTowerSearchResults(results) {
  const recommendations = []
  const candidatePool = new Set()
  let combinations = 0
  let battleSimulations = 0

  for (const result of results) {
    if (!result) continue
    combinations += Number(result.combinations) || 0
    battleSimulations += Number(result.battleSimulations) || 0
    for (const name of result.candidatePool || []) candidatePool.add(name)
    for (const rec of result.recommendations || []) recommendations.push(rec)
  }

  recommendations.sort((a,b) =>
    (Number(b.winRate)||0) - (Number(a.winRate)||0) ||
    (Number(b.progress)||0) - (Number(a.progress)||0) ||
    (Number(a.averageTurns)||0) - (Number(b.averageTurns)||0)
  )

  const seen = new Set()
  const unique = []
  for (const rec of recommendations) {
    const key = JSON.stringify({
      cards: rec.loadout?.cards?.map(card => [card.cardName, card.borders || [], card.mutationWeather || null]),
      aura: rec.loadout?.abilityAura || null,
    })
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(rec)
    if (unique.length >= 10) break
  }

  return {
    recommendations: unique,
    anchorCards: [],
    candidatePool: [...candidatePool],
    combinations,
    battleSimulations,
  }
}

function cancelTowerSearch() {
  towerSearchToken += 1
  for (const worker of towerSearchWorkers) worker.terminate()
  towerSearchWorkers = []
  if (towerWorker) towerWorker.terminate()
  towerWorker = null
  towerProgress = null
  render()
}

function startTowerSearch() {
  const known = new Set(cardCatalog.map(card => card.name))
  if (towerEnemies.length !== 4 || towerEnemies.some(name => !known.has(name))) {
    towerError = 'Choose four valid Tower enemies.'
    render()
    return
  }

  const excludedCards = CHEESE_POOL.filter(name => !towerPoolEnabled(name))
  if (excludedCards.length === CHEESE_POOL.length) {
    towerError = 'Turn on at least one cheese card.'
    render()
    return
  }

  towerError = ''
  towerResult = null
  const token = ++towerSearchToken
  const workerCount = Math.min(8, Math.max(2, Number(navigator.hardwareConcurrency) || 4))
  const results = Array(workerCount).fill(null)
  const progress = Array.from({length: workerCount}, () => ({completed:0,total:0,battleSimulations:0}))
  let finished = 0
  let failed = false
  towerSearchLastRender = 0
  towerProgress = { phase:'exhaustive', completed:0, total:0, battleSimulations:0, workers:workerCount }

  for (const worker of towerSearchWorkers) worker.terminate()
  towerSearchWorkers = []

  const refreshProgress = phase => {
    const completed = progress.reduce((sum,item)=>sum+(Number(item.completed)||0),0)
    const total = progress.reduce((sum,item)=>sum+(Number(item.total)||0),0)
    const battles = progress.reduce((sum,item)=>sum+(Number(item.battleSimulations)||0),0)
    towerProgress = { phase:phase || 'exhaustive', completed, total, battleSimulations:battles, workers:workerCount }
    const now = performance.now()
    if (route === 'tower' && now - towerSearchLastRender > 120) {
      towerSearchLastRender = now
      render()
    }
  }

  const fail = message => {
    if (failed || token !== towerSearchToken) return
    failed = true
    for (const worker of towerSearchWorkers) worker.terminate()
    towerSearchWorkers = []
    towerWorker = null
    towerProgress = null
    towerError = message || 'Parallel Tower cheese search failed.'
    if (route === 'tower') render()
  }

  for (let shardIndex=0; shardIndex<workerCount; shardIndex++) {
    const worker = new Worker('./assets/tower-worker.js?v=2')
    towerSearchWorkers.push(worker)

    worker.onmessage = event => {
      if (failed || token !== towerSearchToken) return
      const message = event.data || {}
      if (message.kind === 'tower-cheese-progress') {
        progress[shardIndex] = {
          completed: message.completed || 0,
          total: message.total || 0,
          battleSimulations: message.battleSimulations || 0,
        }
        refreshProgress(message.phase)
        return
      }
      if (message.kind !== 'tower-cheese-result') return
      if (!message.ok) {
        fail(message.error)
        return
      }

      results[shardIndex] = message.result
      finished += 1
      worker.terminate()

      if (finished < workerCount) {
        refreshProgress('verify')
        return
      }

      towerSearchWorkers = []
      towerProgress = null
      towerResult = combineTowerSearchResults(results)
      if (route === 'tower') render()
    }

    worker.onerror = event => fail(event.message || 'Parallel Tower cheese search worker failed.')

    const shardSeed = ((Date.now() >>> 0) ^ Math.imul(shardIndex + 1, 0x9e3779b1)) >>> 0
    worker.postMessage({
      id: token,
      kind: 'tower-cheese-search',
      enemyNames: [...towerEnemies],
      floor: towerFloor,
      difficulty: towerDifficulty,
      seed: shardSeed || 1,
      intensive: true,
      excludedCards,
      addedCards: [],
      hasEndTimes: true,
      shardIndex,
      shardCount: workerCount,
    })
  }

  refreshProgress('exhaustive')
  render()
}


function updateRollCalculator() {
  const input = document.querySelector('#rollSpeedBonus')
  const seconds = document.querySelector('#rollSeconds')
  const rps = document.querySelector('#rollRps')
  if (!input || !seconds || !rps) return
  const bonus = Math.max(0, Number(input.value) || 0)
  const time = Math.max(0.3, 1.5 / (1 + bonus / 100))
  seconds.textContent = time.toFixed(3) + 's'
  rps.textContent = (1 / time).toFixed(3) + ' rolls/sec'
}

function updateTowerCalculator() {
  const floor = document.querySelector('#towerCalcFloor')
  const difficulty = document.querySelector('#towerCalcDifficulty')
  const hp = document.querySelector('#towerCalcHp')
  const atk = document.querySelector('#towerCalcAtk')
  if (!floor || !difficulty || !hp || !atk) return
  const power = towerPower(floor.value, difficulty.value)
  hp.textContent = power.toLocaleString() + ' HP'
  atk.textContent = Math.ceil(power / 2).toLocaleString() + ' ATK'
}

function bind() {
  document.querySelectorAll('[data-route]').forEach(button => button.onclick = () => routeTo(button.dataset.route))
  document.querySelectorAll('[data-action="import-json"]').forEach(button => button.onclick = openImport)
  document.querySelectorAll('[data-action="open-profile"]').forEach(button => button.onclick = () => routeTo('player'))
  document.querySelectorAll('[data-action="close-modal"]').forEach(button => button.onclick = closeModal)
  document.querySelectorAll('[data-action="save-json"]').forEach(button => button.onclick = saveJson)
  document.querySelectorAll('[data-profile-id]').forEach(button => button.onclick = () => {
    deckResults = []
    deckError = ''
    towerResult = null
    towerError = ''
    for (const key of Object.keys(depthsResults)) delete depthsResults[key]
    store.setActiveProfile(button.dataset.profileId)
    render()
  })
  document.querySelectorAll('[data-action="new-profile"]').forEach(button => button.onclick = () => {
    store.replaceProfile(createEmptyProfile('Profile ' + (store.get().profiles.length + 1)))
    render()
  })

  const search = document.querySelector('#librarySearch')
  if (search) search.oninput = () => {
    libraryQuery = search.value
    render()
    requestAnimationFrame(() => {
      const next = document.querySelector('#librarySearch')
      next?.focus()
      next?.setSelectionRange(next.value.length, next.value.length)
    })
  }
  document.querySelector('#librarySort')?.addEventListener('change', event => { librarySort = event.target.value; render() })
  document.querySelector('#libraryWeather')?.addEventListener('change', event => { libraryWeather = event.target.value; render() })
  document.querySelector('#libraryPack')?.addEventListener('change', event => { libraryPack = event.target.value; render() })
  document.querySelector('#libraryOwned')?.addEventListener('change', event => { libraryOwned = event.target.value; render() })

  const deckSearch = document.querySelector('#deckInventorySearch')
  if (deckSearch) deckSearch.oninput = () => {
    deckInventoryQuery = deckSearch.value
    render()
    requestAnimationFrame(() => {
      const next = document.querySelector('#deckInventorySearch')
      next?.focus()
      next?.setSelectionRange(next.value.length, next.value.length)
    })
  }
  document.querySelectorAll('[data-deck-toggle]').forEach(button => button.onclick = () => {
    if (deckWorker) return
    const { cards, selected, state } = selectedDeckCards()
    const key = button.dataset.deckToggle
    const card = cards.find(item => cardVariantKey(item) === key)
    if (!card) return
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else {
      const currentCopies = cards.filter(item => next.has(cardVariantKey(item))).reduce((sum,item) => sum + Math.max(1, Number(item.quantity)||1), 0)
      const addCopies = Math.max(1, Number(card.quantity)||1)
      if (currentCopies + addCopies > 30) {
        deckError = 'Deck Helper supports up to 30 selected card copies.'
        render()
        return
      }
      next.add(key)
    }
    deckError = ''
    updateDeckToolState({ initialized: true, selected: [...next], locks: state.locks || {} })
  })
  document.querySelectorAll('[data-deck-lock]').forEach(select => select.onchange = () => {
    const state = deckToolState()
    const locks = { ...(state.locks || {}) }
    const value = Number(select.value)
    if (value >= 0 && value <= 3) {
      for (const key of Object.keys(locks)) if (locks[key] === value) delete locks[key]
      locks[select.dataset.deckLock] = value
    } else delete locks[select.dataset.deckLock]
    updateDeckToolState({ initialized: true, selected: [...selectedDeckCards().selected], locks })
  })
  document.querySelector('[data-deck-search]')?.addEventListener('click', startDeckSearch)
  document.querySelector('[data-deck-cancel]')?.addEventListener('click', cancelDeckSearch)

  const floorInput = document.querySelector('#towerFloorInput')
  floorInput?.addEventListener('change', () => {
    towerFloor = Math.max(1, Math.floor(Number(floorInput.value) || 1))
    if (TOWER_FIXED[towerFloor]) towerEnemies = [...TOWER_FIXED[towerFloor]]
    towerResult = null
    towerError = ''
    render()
  })
  document.querySelector('#towerDifficultyInput')?.addEventListener('change', event => {
    towerDifficulty = event.target.value
    towerResult = null
  })
  document.querySelectorAll('[data-tower-enemy]').forEach(input => input.addEventListener('change', () => {
    towerEnemies[Number(input.dataset.towerEnemy)] = input.value.trim()
    towerResult = null
    towerError = ''
    render()
  }))
  document.querySelectorAll('[data-cheese-toggle]').forEach(button => button.addEventListener('click', () => {
    const name = button.dataset.cheeseToggle
    const current = towerToolState()
    const poolOverrides = { ...(current.poolOverrides || {}) }
    poolOverrides[name] = !towerPoolEnabled(name)
    towerResult = null
    updateTowerToolState({ poolOverrides })
  }))
  document.querySelector('[data-tower-search]')?.addEventListener('click', startTowerSearch)
  document.querySelector('[data-tower-cancel]')?.addEventListener('click', cancelTowerSearch)

  document.querySelectorAll('[data-depth-team]').forEach(button => button.addEventListener('click', () => {
    updateDepthsToolState(state => { state.activeTeam = Number(button.dataset.depthTeam); state.activeSlot = 0 })
  }))
  document.querySelector('[data-depth-duplicate]')?.addEventListener('click', () => {
    const current = depthsToolState()
    const sourceIndex = current.activeTeam
    const destination = (sourceIndex + 1) % 5
    clearDepthResult(destination)
    updateDepthsToolState(state => {
      const source = state.teams[sourceIndex]
      state.teams[destination] = structuredClone(source)
      state.activeTeam = destination
      state.activeSlot = 0
    })
  })

  document.querySelector('[data-depth-copy-team]')?.addEventListener('click', async () => {
    const code = encodeDepthTeam(depthsToolState().teams[depthsToolState().activeTeam])
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      prompt('Copy this team code:', code)
    }
  })

  document.querySelector('[data-depth-import-team]')?.addEventListener('click', () => {
    const code = prompt('Paste a CRE1 team code:')
    if (!code) return
    try {
      const imported = decodeDepthTeam(code)
      const index = depthsToolState().activeTeam
      clearDepthResult(index)
      updateDepthsToolState(state => {
        state.teams[index] = imported
        state.activeSlot = 0
      })
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    }
  })

  document.querySelector('[data-depth-clear-team]')?.addEventListener('click', () => {
    const index = depthsToolState().activeTeam
    clearDepthResult(index)
    updateDepthsToolState(state => {
      state.teams[index] = {
        cards: Array.from({ length: 4 }, () => ({ cardName: '', borders: [], mutationWeather: '' })),
        statAura: '', statAuraBorder: '', abilityAura: '', abilityAuraBorder: '',
      }
      state.activeSlot = 0
    })
  })

  document.querySelector('[data-depth-clear-results]')?.addEventListener('click', () => {
    for (const key of Object.keys(depthsResults)) delete depthsResults[key]
    render()
  })

  document.querySelectorAll('[data-depth-ban-layout]').forEach(button => button.addEventListener('click', () => {
    updateDepthsToolState(state => {
      state.activeDepthBanLayout = Number(button.dataset.depthBanLayout)
      state.depthBanQuery = ''
    })
  }))

  document.querySelector('[data-depth-ban-clear]')?.addEventListener('click', () => {
    updateDepthsToolState(state => {
      state.depthBanLayouts[state.activeDepthBanLayout] = []
      state.depthBanQuery = ''
    })
    for (const key of Object.keys(depthsResults)) delete depthsResults[key]
  })

  document.querySelectorAll('[data-depth-ban-remove]').forEach(button => button.addEventListener('click', () => {
    updateDepthsToolState(state => {
      const list = [...state.depthBanLayouts[state.activeDepthBanLayout]]
      list.splice(Number(button.dataset.depthBanRemove), 1)
      state.depthBanLayouts[state.activeDepthBanLayout] = list
    })
    for (const key of Object.keys(depthsResults)) delete depthsResults[key]
  }))

  document.querySelectorAll('[data-depth-ban-add]').forEach(button => button.addEventListener('click', () => {
    updateDepthsToolState(state => {
      const list = sanitizeDepthBans(state.depthBanLayouts[state.activeDepthBanLayout] || [])
      if (list.length < MAX_DEPTH_BANS && !list.includes(button.dataset.depthBanAdd)) list.push(button.dataset.depthBanAdd)
      state.depthBanLayouts[state.activeDepthBanLayout] = sanitizeDepthBans(list)
      state.depthBanQuery = ''
    })
    for (const key of Object.keys(depthsResults)) delete depthsResults[key]
  }))

  document.querySelector('[data-depth-ban-export]')?.addEventListener('click', async () => {
    const state = depthsToolState()
    const code = encodeDepthBans(state.depthBanLayouts[state.activeDepthBanLayout] || [])
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      prompt('Copy this ban code:', code)
    }
  })

  document.querySelector('[data-depth-ban-import]')?.addEventListener('click', () => {
    const code = prompt('Paste a CRB1 ban code:')
    if (!code) return
    try {
      const bans = decodeDepthBans(code)
      updateDepthsToolState(state => {
        state.depthBanLayouts[state.activeDepthBanLayout] = bans
        state.depthBanQuery = ''
      })
      for (const key of Object.keys(depthsResults)) delete depthsResults[key]
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    }
  })

  const depthBanSearch = document.querySelector('#depthBanSearch')
  if (depthBanSearch) depthBanSearch.oninput = () => {
    updateDepthsToolState(state => { state.depthBanQuery = depthBanSearch.value })
    requestAnimationFrame(() => {
      const next = document.querySelector('#depthBanSearch')
      next?.focus()
      next?.setSelectionRange(next.value.length, next.value.length)
    })
  }

  document.querySelector('[data-depth-cancel]')?.addEventListener('click', cancelDepthsRuns)

  document.querySelectorAll('[data-depth-run-detail]').forEach(button => button.addEventListener('click', () => {
    const [teamIndex, runIndex] = String(button.dataset.depthRunDetail).split(':').map(Number)
    showDepthsRunDebug(teamIndex, runIndex)
  }))

  let draggedDepthSlot = null
  document.querySelectorAll('[data-depth-slot]').forEach(button => {
    button.addEventListener('dragstart', event => {
      if (event.target.closest('[data-depth-border-slot],[data-depth-mutation-slot]')) { event.preventDefault(); return }
      draggedDepthSlot = Number(button.dataset.depthSlot)
      button.classList.add('dragging')
      event.dataTransfer?.setData('text/plain', String(draggedDepthSlot))
    })
    button.addEventListener('dragover', event => {
      if (draggedDepthSlot === null) return
      event.preventDefault()
      button.classList.add('drop-target')
    })
    button.addEventListener('dragleave', () => button.classList.remove('drop-target'))
    button.addEventListener('drop', event => {
      event.preventDefault()
      const to = Number(button.dataset.depthSlot)
      const from = draggedDepthSlot
      draggedDepthSlot = null
      document.querySelectorAll('[data-depth-slot]').forEach(el => el.classList.remove('dragging','drop-target'))
      if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return
      clearDepthResult(depthsToolState().activeTeam)
      updateDepthsToolState(state => {
        const cards = state.teams[state.activeTeam].cards
        ;[cards[from], cards[to]] = [cards[to], cards[from]]
        state.activeSlot = to
      })
    })
    button.addEventListener('dragend', () => {
      draggedDepthSlot = null
      document.querySelectorAll('[data-depth-slot]').forEach(el => el.classList.remove('dragging','drop-target'))
    })
  })

  document.querySelectorAll('[data-depth-slot]').forEach(button => button.addEventListener('click', event => {
    if (event.target.closest('[data-depth-border-slot],[data-depth-mutation-slot]')) return
    updateDepthsToolState(state => { state.activeSlot = Number(button.dataset.depthSlot) })
  }))
  document.querySelectorAll('[data-depth-card]').forEach(button => button.addEventListener('click', () => {
    clearDepthResult(depthsToolState().activeTeam)
    updateDepthsToolState(state => {
      const slot = state.teams[state.activeTeam].cards[state.activeSlot]
      slot.cardName = button.dataset.depthCard
      slot.mutationWeather = ''
    })
  }))
  document.querySelectorAll('[data-depth-border-slot]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    const teamIndex = depthsToolState().activeTeam
    clearDepthResult(teamIndex)
    updateDepthsToolState(state => {
      const slotIndex = Number(button.dataset.depthBorderSlot)
      const border = button.dataset.depthBorderName
      const slot = state.teams[state.activeTeam].cards[slotIndex]
      slot.borders = slot.borders.includes(border) ? slot.borders.filter(value => value !== border) : [...slot.borders, border]
    })
  }))
  document.querySelectorAll('[data-depth-mutation-slot]').forEach(select => select.addEventListener('change', event => {
    event.stopPropagation()
    clearDepthResult(depthsToolState().activeTeam)
    updateDepthsToolState(state => {
      const slotIndex = Number(select.dataset.depthMutationSlot)
      state.teams[state.activeTeam].cards[slotIndex].mutationWeather = DEPTH_MUTATIONS.includes(select.value) ? select.value : ''
    })
  }))
  document.querySelectorAll('[data-depth-aura-select]').forEach(select => select.addEventListener('change', () => {
    clearDepthResult(depthsToolState().activeTeam)
    updateDepthsToolState(state => { state.teams[state.activeTeam][select.dataset.depthAuraSelect] = select.value })
  }))
  document.querySelectorAll('[data-depth-aura-border-key]').forEach(button => button.addEventListener('click', () => {
    clearDepthResult(depthsToolState().activeTeam)
    updateDepthsToolState(state => { state.teams[state.activeTeam][button.dataset.depthAuraBorderKey] = button.dataset.depthAuraBorder })
  }))
  document.querySelector('[data-depth-owned-toggle]')?.addEventListener('click', () => updateDepthsToolState(state => { state.ownedOnly = !state.ownedOnly }))
  const depthSearch = document.querySelector('#depthSearch')
  if (depthSearch) depthSearch.oninput = () => {
    depthsQuery = depthSearch.value
    render()
    requestAnimationFrame(() => {
      const next = document.querySelector('#depthSearch')
      next?.focus()
      next?.setSelectionRange(next.value.length, next.value.length)
    })
  }
  document.querySelectorAll('[data-depth-runs]').forEach(button => button.addEventListener('click', () => updateDepthsToolState(state => { state.runs = Number(button.dataset.depthRuns) })))
  document.querySelector('#depthStartFloor')?.addEventListener('change', event => { for (const key of Object.keys(depthsResults)) delete depthsResults[key]; updateDepthsToolState(state => { state.startFloor = Math.min(40000, Math.max(1, Math.floor(Number(event.target.value)||1))) }) })
  document.querySelector('#depthStructureLevel')?.addEventListener('change', event => { for (const key of Object.keys(depthsResults)) delete depthsResults[key]; updateDepthsToolState(state => { state.battleSpeedStructureLevel = Number(event.target.value)||0 }) })
  document.querySelector('#depthSkillLevel')?.addEventListener('change', event => { for (const key of Object.keys(depthsResults)) delete depthsResults[key]; updateDepthsToolState(state => { state.skillTreeBattleSpeedLevel = Number(event.target.value)||0 }) })
  document.querySelector('[data-depth-chrono]')?.addEventListener('click', () => { for (const key of Object.keys(depthsResults)) delete depthsResults[key]; updateDepthsToolState(state => { state.chronoShard = !state.chronoShard }) })
  document.querySelector('[data-depth-bountiful]')?.addEventListener('click', () => { for (const key of Object.keys(depthsResults)) delete depthsResults[key]; updateDepthsToolState(state => { state.bountifulDepths = !state.bountifulDepths }) })
  document.querySelector('[data-depth-run-active]')?.addEventListener('click', () => startDepthsRuns([depthsToolState().activeTeam]))
  document.querySelector('[data-depth-run-ready]')?.addEventListener('click', () => {
    const state = depthsToolState()
    startDepthsRuns(state.teams.map((team,index) => depthsTeamReady(team) ? index : -1).filter(index => index >= 0))
  })

  document.querySelector('#rollSpeedBonus')?.addEventListener('input', updateRollCalculator)
  document.querySelector('#towerCalcFloor')?.addEventListener('input', updateTowerCalculator)
  document.querySelector('#towerCalcDifficulty')?.addEventListener('change', updateTowerCalculator)
  updateRollCalculator()
  updateTowerCalculator()
}

window.addEventListener('hashchange', () => {
  route = location.hash.replace(/^#\/?/, '') || 'dashboard'
  render()
})

store.subscribe(() => render())
render()
