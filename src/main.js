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
  if (Array.isArray(cards)) return cards.slice(0, 250).map((card, index) => ({
    name: card?.name || card?.cardName || card?.Name || 'Card ' + (index + 1),
    quantity: card?.quantity ?? card?.count ?? 1,
    detail: card?.border || card?.borders?.join?.(', ') || card?.mutation || '',
  }))
  if (cards && typeof cards === 'object') return Object.entries(cards).slice(0, 250).map(([name, value]) => ({
    name,
    quantity: typeof value === 'number' ? value : value?.quantity ?? value?.count ?? 1,
    detail: typeof value === 'object' ? value?.border || value?.mutation || '' : '',
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
      <div class="panel-head">
        <div><p class="kicker">CARDS</p><h3>Owned Cards</h3></div>

      </div>
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

function placeholderPage(tool) {
  return `
    <section class="page-intro">
      <p class="kicker">TOOL</p>
      <h2>${esc(tool.name)}</h2>
      <p>${esc(tool.description)}</p>
    </section>
    <section class="panel placeholder">
      <div class="tool-icon large">${tool.icon}</div>
      <h3>Coming soon</h3>
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
    store.replaceProfile(normalizeImportedJson(parsed, activeProfile()))
    closeModal()
    routeTo('dashboard')
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
    store.replaceProfile(createEmptyProfile('Profile ' + (store.get().profiles.length + 1)))
    render()
  })
}

window.addEventListener('hashchange', () => {
  route = location.hash.replace(/^#\/?/, '') || 'dashboard'
  render()
})

store.subscribe(() => render())
render()
