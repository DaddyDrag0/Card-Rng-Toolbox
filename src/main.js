import { store } from './core/store.js'
import { createEmptyProfile, normalizeImportedJson, countOwnedCards } from './core/schema.js'
import { tools, toolById } from './core/tools.js'

const app = document.querySelector('#app')
let route = location.hash.replace(/^#\/?/, '') || 'dashboard'
let cardCatalog = []
let auraCatalog = []
let libraryQuery = ''
let deckInventoryQuery = ''
let deckWorker = null
let deckProgress = null
let deckResults = []
let deckError = ''
let towerWorker = null
let towerRequestId = 0
let towerFloor = 105
let towerDifficulty = 'Impossible'
let towerEnemies = ["Heaven's Armor","Hell's Army",'Judgment Day','Sable The Envious']
let towerOwnedOnly = true
let towerProgress = null
let towerResult = null
let towerError = ''

fetch('./src/data/cards.json?v=2', { cache: 'no-store' })
  .then(response => response.ok ? response.json() : [])
  .then(cards => { cardCatalog = Array.isArray(cards) ? cards : []; if (route === 'library') render() })
  .catch(() => {})

fetch('./src/data/auras.json?v=1', { cache: 'no-store' })
  .then(response => response.ok ? response.json() : [])
  .then(auras => { auraCatalog = Array.isArray(auras) ? auras : []; if (route === 'deck-helper') render() })
  .catch(() => {})

try { localStorage.setItem('crx-site-theme', 'slate') } catch {}

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

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
            ${rows.map(row => `<div class="inventory-row"><strong>${esc(row.name)}</strong><span>${esc(row.detail || 'Base')}</span><b>×${esc(row.quantity)}</b></div>`).join('')}
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
  const shown = cardCatalog
    .filter(card => !query || card.name.toLowerCase().includes(query) || String(card.ability || '').toLowerCase().includes(query) || String(card.pack || '').toLowerCase().includes(query) || String(card.weather || '').toLowerCase().includes(query))
    .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
    .slice(0, 250)

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
        <input id="librarySearch" class="search-input" value="${esc(libraryQuery)}" placeholder="Search card, ability, pack or weather…" autocomplete="off">
        <div class="card-library-grid">
          ${shown.map(card => `
            <article class="library-card">
              <div class="library-card-top">
                <strong>${esc(card.name)}</strong>
                <span>1 / ${Number(card.rarity || 0).toLocaleString()}</span>
              </div>
              <p>${esc(card.ability || 'No ability')}</p>
              <div class="library-tags">
                ${card.pack ? `<span>${esc(card.pack)}</span>` : ''}
                ${card.weather ? `<span>${esc(card.weather)}</span>` : ''}
                ${card.unobtainable ? '<span>Unobtainable</span>' : ''}
              </div>
            </article>
          `).join('') || '<div class="empty-state"><h3>No matching cards</h3></div>'}
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
                  <div class="result-cards">${result.loadout.cards.map((card,pos) => `<span><b>${pos+1}</b>${esc(card.cardName)}</span>`).join('')}</div>
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

function towerPage() {
  const fixed = TOWER_FIXED[towerFloor]
  const hasPlayerData = Boolean(activeProfile().import.importedAt)
  const owned = ownedCardNames()
  return `
    <section class="page-intro">
      <p class="kicker">TOWER</p>
      <h2>Tower Cheese Maker</h2>
      <p>Native Tower search using the shared battle engine.</p>
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
          <label class="tower-owned-toggle"><span>Player Inventory</span><button type="button" data-tower-owned class="${towerOwnedOnly ? 'on' : ''}" ${!hasPlayerData ? 'disabled' : ''}>${hasPlayerData ? (towerOwnedOnly ? 'OWNED ONLY' : 'ALL CHEESE CARDS') : 'NO JSON'}</button></label>
        </div>
        <datalist id="towerCardNames">${cardCatalog.filter(card => !card.unobtainable).map(card => `<option value="${esc(card.name)}"></option>`).join('')}</datalist>
        <div class="tower-enemy-grid">
          ${towerEnemies.map((name,index) => {
            const card = cardCatalog.find(item => item.name === name)
            return `
              <label class="tower-enemy-box">
                <span>Enemy ${index + 1}</span>
                <input data-tower-enemy="${index}" list="towerCardNames" value="${esc(name)}">
                <small>${esc(card?.ability || 'Unknown ability')}</small>
              </label>
            `
          }).join('')}
        </div>
        ${towerError ? `<div class="tool-error">${esc(towerError)}</div>` : ''}
        ${towerProgress ? `
          <div class="search-progress tower-search-progress">
            <div><strong>${esc(towerProgress.phase || 'Searching…')}</strong><span>${Number(towerProgress.battleSimulations || 0).toLocaleString()} battles</span></div>
            <div class="progress-track"><i style="width:${Math.min(100, Math.round((Number(towerProgress.completed || 0) / Math.max(1, Number(towerProgress.total || 1))) * 100))}%"></i></div>
          </div>
        ` : ''}
        <div class="tool-actions right">
          ${towerWorker
            ? '<button class="secondary" data-tower-cancel>Cancel</button>'
            : '<button class="primary" data-tower-search>Deep Search</button>'}
        </div>
        ${hasPlayerData && towerOwnedOnly ? `<small class="tool-note">Search pool is limited to cheese cards found in the active player JSON. ${[...owned].length} unique owned cards detected.</small>` : ''}
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
                  <div class="result-cards">${candidate.loadout.cards.map((card,pos) => `<span><b>${pos+1}</b>${esc(card.cardName)}</span>`).join('')}</div>
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

function depthsPage() {
  return `
    <section class="embedded-wrap">
      <div class="embedded-bar">
        <div><p class="kicker">DEPTHS</p><strong>Depths Calculator</strong></div>
        <a class="secondary small" href="/CardRngExpansionDepths/" target="_blank" rel="noopener">Open Full Screen</a>
      </div>
      <iframe class="tool-frame" src="/CardRngExpansionDepths/" title="Depths Calculator" allow="clipboard-read; clipboard-write"></iframe>
    </section>
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
        <div class="content ${route === 'depths' ? 'content-embedded' : ''}">${page()}</div>
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
  deckProgress = { phase: 'prepare', message: 'Starting search…', simulations: 0, possibleCombinations: 1 }
  deckWorker = new Worker('./assets/optimizer-worker.js?v=1')
  deckWorker.onmessage = event => {
    const message = event.data || {}
    if (message.type === 'progress') {
      deckProgress = message.progress
      if (route === 'deck-helper') render()
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

function cancelTowerSearch() {
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

  const owned = ownedCardNames()
  let excludedCards = []
  if (activeProfile().import.importedAt && towerOwnedOnly) {
    excludedCards = CHEESE_POOL.filter(name => !owned.has(name))
    if (excludedCards.length === CHEESE_POOL.length) {
      towerError = 'None of the standard cheese cards were found in this player JSON.'
      render()
      return
    }
  }

  const hasEndTimes = !activeProfile().import.importedAt || !towerOwnedOnly || ownedAuraNames().has('End Times')
  towerError = ''
  towerResult = null
  towerProgress = { phase: 'exhaustive', completed: 0, total: 1, battleSimulations: 0 }
  const requestId = ++towerRequestId
  towerWorker = new Worker('./assets/tower-worker.js?v=1')
  towerWorker.onmessage = event => {
    const message = event.data || {}
    if (message.id !== requestId) return
    if (message.kind === 'tower-cheese-progress') {
      towerProgress = message
      if (route === 'tower') render()
      return
    }
    if (message.kind === 'tower-cheese-result') {
      if (message.ok) towerResult = message.result
      else towerError = message.error || 'Tower search failed.'
      towerProgress = null
      towerWorker?.terminate()
      towerWorker = null
      if (route === 'tower') render()
    }
  }
  towerWorker.onerror = event => {
    towerError = event.message || 'Tower search worker failed.'
    towerProgress = null
    towerWorker?.terminate()
    towerWorker = null
    if (route === 'tower') render()
  }
  towerWorker.postMessage({
    id: requestId,
    kind: 'tower-cheese-search',
    enemyNames: [...towerEnemies],
    floor: towerFloor,
    difficulty: towerDifficulty,
    seed: Date.now() >>> 0,
    intensive: true,
    excludedCards,
    addedCards: [],
    hasEndTimes,
  })
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
  document.querySelector('[data-tower-owned]')?.addEventListener('click', () => {
    towerOwnedOnly = !towerOwnedOnly
    towerResult = null
    render()
  })
  document.querySelector('[data-tower-search]')?.addEventListener('click', startTowerSearch)
  document.querySelector('[data-tower-cancel]')?.addEventListener('click', cancelTowerSearch)

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
