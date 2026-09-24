import { store } from './core/store.js'
import { createEmptyProfile, normalizeImportedJson, countOwnedCards } from './core/schema.js'
import { tools, toolById } from './core/tools.js'

const app = document.querySelector('#app')
let route = location.hash.replace(/^#\/?/, '') || 'dashboard'

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
      <div class="brand">
        <div class="brand-mark">CR</div>
        <div>
          <strong>Card RNG</strong>
          <span>Toolbox</span>
        </div>
      </div>

      <nav class="nav">
        ${[...groupTools()].map(([group, items]) => `
          <section class="nav-group">
            <small>${esc(group)}</small>
            ${items.map(tool => `
              <button class="nav-item ${route === tool.id ? 'active' : ''}" data-route="${tool.id}">
                <i>${tool.icon}</i>
                <span>${esc(tool.name)}</span>
                ${tool.status === 'port' ? '<b>PORT</b>' : ''}
              </button>
            `).join('')}
          </section>
        `).join('')}
      </nav>

      <div class="sidebar-profile">
        <button data-action="open-profile">
          <span class="avatar">${esc((profile.roblox.username || profile.name || '?').slice(0, 1).toUpperCase())}</span>
          <span>
            <strong>${esc(profile.roblox.username || profile.name)}</strong>
            <small>${profile.import.importedAt ? 'Player data loaded' : 'Local profile'}</small>
          </span>
          <i>›</i>
        </button>
      </div>
    </aside>
  `
}

function header() {
  const tool = toolById(route)
  return `
    <header class="topbar">
      <div>
        <small>CARD RNG EXPANSION</small>
        <h1>${esc(tool.name)}</h1>
      </div>
      <div class="top-actions">
        <span class="data-pill"><i></i>${activeProfile().import.importedAt ? 'Player data connected' : 'Waiting for player export'}</span>
        <button class="ghost" data-action="import-json">Import JSON</button>
      </div>
    </header>
  `
}

function metric(label, value, sub = '') {
  return `<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></article>`
}

function dashboardPage() {
  const profile = activeProfile()
  const cardCount = countOwnedCards(profile.game.cards)
  const imported = profile.import.importedAt ? new Date(profile.import.importedAt).toLocaleString() : 'Not imported yet'
  const portTools = tools.filter(tool => tool.status === 'port')

  return `
    <section class="hero panel">
      <div>
        <span class="eyebrow">ONE PROFILE · EVERY TOOL</span>
        <h2>Everything for Card RNG Expansion in one place.</h2>
        <p>Import player data once. Inventory, Deck Helper, Depths, Tower and future calculators will all read from the same shared profile.</p>
        <div class="hero-actions">
          <button class="primary" data-action="import-json">Import Player JSON</button>
          <button class="secondary" data-route="player">Open Player Data</button>
        </div>
      </div>
      <div class="hero-orb"><span>CR</span></div>
    </section>

    <section class="metrics">
      ${metric('Active profile', profile.roblox.username || profile.name, profile.roblox.displayName || 'Local toolbox profile')}
      ${metric('Owned cards', cardCount || '—', cardCount ? 'From shared inventory' : 'Import JSON to populate')}
      ${metric('Last import', imported, profile.import.source === 'json' ? 'JSON player export' : 'No game export yet')}
      ${metric('Tool data', Object.keys(profile.game).filter(key => key !== 'raw' && profile.game[key] && Object.keys(profile.game[key]).length).length, 'Shared categories detected')}
    </section>

    <div class="section-head"><div><span class="eyebrow">TOOLBOX</span><h2>Tools</h2></div><small>We will port these into this shell instead of keeping separate data stores.</small></div>
    <section class="tool-grid">
      ${tools.filter(tool => tool.id !== 'dashboard').map(tool => `
        <button class="tool-card" data-route="${tool.id}">
          <div class="tool-icon">${tool.icon}</div>
          <div>
            <div class="tool-title"><strong>${esc(tool.name)}</strong><span class="status ${tool.status}">${tool.status === 'port' ? 'Ready to port' : tool.status}</span></div>
            <p>${esc(tool.description)}</p>
          </div>
          <b class="arrow">→</b>
        </button>
      `).join('')}
    </section>

    <section class="panel roadmap">
      <div class="section-head compact"><div><span class="eyebrow">MIGRATION</span><h2>What gets moved next</h2></div></div>
      <div class="roadmap-list">
        ${portTools.map((tool, index) => `
          <div><span>${index + 1}</span><strong>${esc(tool.name)}</strong><small>Keep its battle/calculation engine, replace its separate inventory/settings with Toolbox shared data.</small></div>
        `).join('')}
      </div>
    </section>
  `
}

function playerPage() {
  const profile = activeProfile()
  return `
    <section class="page-intro">
      <span class="eyebrow">SHARED ACCOUNT LAYER</span>
      <h2>Player Data</h2>
      <p>This is the data source every Toolbox feature will use. For now profiles live in this browser. Later the Discord/webhook pipeline can update the exact same profile format automatically.</p>
    </section>

    <div class="two-col">
      <section class="panel">
        <div class="section-head compact"><div><h2>Active profile</h2></div><button class="secondary small" data-action="new-profile">New profile</button></div>
        <div class="profile-card">
          <div class="big-avatar">${esc((profile.roblox.username || profile.name).slice(0,1).toUpperCase())}</div>
          <div>
            <h3>${esc(profile.roblox.displayName || profile.roblox.username || profile.name)}</h3>
            <p>${profile.roblox.username ? '@' + esc(profile.roblox.username) : 'No Roblox username imported yet'}</p>
            <small>${profile.roblox.userId ? 'Roblox ID: ' + esc(profile.roblox.userId) : 'Roblox ID waiting for export'}</small>
          </div>
        </div>

        <div class="profile-list">
          ${store.get().profiles.map(item => `
            <button class="${item.id === profile.id ? 'active' : ''}" data-profile-id="${item.id}">
              <span class="avatar">${esc((item.roblox.username || item.name).slice(0,1).toUpperCase())}</span>
              <span><strong>${esc(item.roblox.username || item.name)}</strong><small>${item.import.importedAt ? 'Imported player data' : 'Local profile'}</small></span>
            </button>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <span class="eyebrow">IMPORT PIPELINE</span>
        <h2>How accounts will work</h2>
        <div class="flow">
          <div><b>1</b><span><strong>Game export</strong><small>PlayerStats gets converted to JSON.</small></span></div>
          <i>→</i>
          <div><b>2</b><span><strong>Discord bridge</strong><small>Your webhook/bot gets the export outside the game.</small></span></div>
          <i>→</i>
          <div><b>3</b><span><strong>Toolbox profile</strong><small>JSON maps into one shared player profile.</small></span></div>
        </div>
        <p class="muted">Until the automatic bridge exists, you can paste the JSON manually. The tools will not care where it came from.</p>
        <button class="primary full" data-action="import-json">Paste Player JSON</button>
      </section>
    </div>

    <section class="panel">
      <div class="section-head compact"><div><span class="eyebrow">DATA MODEL</span><h2>Shared categories</h2></div></div>
      <div class="data-categories">
        ${['Cards / Inventory','Auras','Currencies','Skill Tree','Structures','Depths','Tower','Trials','Bosses','Artifacts'].map(name => `<div><i>✓</i><span>${name}</span></div>`).join('')}
      </div>
    </section>
  `
}

function inventoryRows(cards) {
  if (Array.isArray(cards)) return cards.slice(0, 100).map((card, index) => ({
    name: card?.name || card?.cardName || card?.Name || 'Card ' + (index + 1),
    quantity: card?.quantity ?? card?.count ?? 1,
    detail: card?.border || card?.borders?.join?.(', ') || card?.mutation || '',
  }))
  if (cards && typeof cards === 'object') return Object.entries(cards).slice(0, 100).map(([name, value]) => ({
    name,
    quantity: typeof value === 'number' ? value : value?.quantity ?? value?.count ?? 1,
    detail: typeof value === 'object' ? value?.border || value?.mutation || '' : '',
  }))
  return []
}

function inventoryPage() {
  const rows = inventoryRows(activeProfile().game.cards)
  return `
    <section class="page-intro"><span class="eyebrow">SHARED INVENTORY</span><h2>Inventory</h2><p>This page already reads from the same profile the future Deck Helper, Tower and Depths tools will use.</p></section>
    <section class="panel">
      <div class="section-head compact"><div><h2>Owned cards</h2><small>${rows.length ? countOwnedCards(activeProfile().game.cards) + ' total copies detected' : 'No inventory imported yet'}</small></div><button class="secondary small" data-action="import-json">Import JSON</button></div>
      ${rows.length ? `
        <div class="inventory-table">
          <div class="inventory-head"><span>Card</span><span>Details</span><span>Qty</span></div>
          ${rows.map(row => `<div class="inventory-row"><strong>${esc(row.name)}</strong><span>${esc(row.detail || 'Base')}</span><b>×${esc(row.quantity)}</b></div>`).join('')}
        </div>
      ` : `
        <div class="empty-state"><div>▦</div><h3>No card data yet</h3><p>Once you send me a real PlayerStats JSON, I can map its exact card/border/mutation format here.</p><button class="primary" data-action="import-json">Try a JSON export</button></div>
      `}
    </section>
  `
}

function placeholderPage(tool) {
  const copy = tool.status === 'port'
    ? 'This existing tool will be moved here next. We can reuse most of its current engine/UI, then replace its separate storage with the shared Toolbox profile.'
    : 'The shared shell is ready for this tool. It can be built without creating another separate inventory or settings system.'
  return `
    <section class="page-intro"><span class="eyebrow">${tool.status === 'port' ? 'READY TO PORT' : 'TOOLBOX MODULE'}</span><h2>${esc(tool.name)}</h2><p>${esc(copy)}</p></section>
    <section class="panel placeholder">
      <div class="placeholder-icon">${tool.icon}</div>
      <h2>${esc(tool.name)} module</h2>
      <p>${esc(tool.description)}</p>
      <div class="shared-chip">Uses active Toolbox profile: <b>${esc(activeProfile().roblox.username || activeProfile().name)}</b></div>
    </section>
  `
}

function page() {
  if (route === 'dashboard') return dashboardPage()
  if (route === 'player') return playerPage()
  if (route === 'inventory') return inventoryPage()
  return placeholderPage(toolById(route))
}

function modal() {
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Import player JSON" onclick="event.stopPropagation()">
        <div class="modal-head"><div><span class="eyebrow">PLAYER IMPORT</span><h2>Paste JSON</h2></div><button class="icon-btn" data-action="close-modal">×</button></div>
        <p>Paste the PlayerStats JSON here. Right now the importer recognizes common field names and also preserves the complete raw export. Once you have the real format, we will make the mapping exact.</p>
        <textarea id="jsonInput" spellcheck="false" placeholder='{"username":"Player","cards":[...]}'></textarea>
        <div id="importError" class="form-error"></div>
        <div class="modal-actions"><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="save-json">Import to active profile</button></div>
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
    const normalized = normalizeImportedJson(parsed, activeProfile())
    store.replaceProfile(normalized)
    closeModal()
    routeTo('inventory')
  } catch (err) {
    if (error) error.textContent = err instanceof Error ? err.message : 'Invalid JSON'
  }
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
    const profile = createEmptyProfile('Profile ' + (store.get().profiles.length + 1))
    store.replaceProfile(profile)
    render()
  })
}

window.addEventListener('hashchange', () => {
  route = location.hash.replace(/^#\/?/, '') || 'dashboard'
  render()
})

store.subscribe(() => render())
render()
