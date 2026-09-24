import { store } from './core/store.js'
import { createEmptyProfile, normalizeImportedJson, countOwnedCards } from './core/schema.js'
import { tools, toolById } from './core/tools.js'

const app = document.querySelector('#app')
let route = location.hash.replace(/^#\/?/, '') || 'dashboard'
let cardCatalog = []
let libraryQuery = ''

fetch('./src/data/cards.json?v=1', { cache: 'no-store' })
  .then(response => response.ok ? response.json() : [])
  .then(cards => { cardCatalog = Array.isArray(cards) ? cards : []; if (route === 'library') render() })
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

function syncExternalTools(profile) {
  if (!profile?.import?.importedAt) return
  try {
    const existing = JSON.parse(localStorage.getItem('deckhelper.state.v1') || 'null') || {}
    existing.inventory = existing.inventory || { cards: [], statAuras: [], abilityAuras: [] }
    existing.inventory.cards = normalizeOwnedCards(profile.game.cards)
    if (!Array.isArray(existing.inventory.statAuras)) existing.inventory.statAuras = []
    if (!Array.isArray(existing.inventory.abilityAuras)) existing.inventory.abilityAuras = []
    if (!Array.isArray(existing.depthBans)) existing.depthBans = []
    if (!Array.isArray(existing.favorites)) existing.favorites = []
    if (!existing.currentDeck) existing.currentDeck = { cards: [], statAura: null, abilityAura: null }
    localStorage.setItem('deckhelper.state.v1', JSON.stringify(existing))
  } catch {}
  try { localStorage.setItem('crx-site-theme', 'slate') } catch {}
}

function embeddedToolPage(tool) {
  syncExternalTools(activeProfile())
  const src = tool.id === 'deck-helper'
    ? '/DeckHelper/'
    : tool.id === 'tower'
      ? '/CardRngExpansionDepths/?view=tower'
      : '/CardRngExpansionDepths/'
  return `
    <section class="embedded-wrap">
      <div class="embedded-bar">
        <div><p class="kicker">${tool.id === 'deck-helper' ? 'DECK TOOL' : 'SIMULATOR'}</p><strong>${esc(tool.name)}</strong></div>
        <a class="secondary small" href="${src}" target="_blank" rel="noopener">Open Full Screen</a>
      </div>
      <iframe class="tool-frame" src="${src}" title="${esc(tool.name)}" allow="clipboard-read; clipboard-write"></iframe>
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
  if (['deck-helper','depths','tower'].includes(route)) return embeddedToolPage(toolById(route))
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
        <div class="content ${['deck-helper','depths','tower'].includes(route) ? 'content-embedded' : ''}">${page()}</div>
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
    syncExternalTools(profile)
    closeModal()
    routeTo('dashboard')
  } catch (err) {
    if (error) error.textContent = err instanceof Error ? err.message : 'Invalid JSON'
  }
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
    syncExternalTools(activeProfile())
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
syncExternalTools(activeProfile())
render()
