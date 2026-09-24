export const STORAGE_VERSION = 1

export function createEmptyProfile(name = 'My Profile') {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : 'profile-' + Date.now(),
    name,
    roblox: {
      userId: null,
      username: '',
      displayName: '',
      avatarUrl: '',
    },
    import: {
      source: 'manual',
      importedAt: null,
      exportVersion: null,
    },
    game: {
      cards: [],
      auras: [],
      currencies: {},
      skillTree: {},
      structures: {},
      depths: {},
      tower: {},
      trials: {},
      bosses: {},
      artifacts: {},
      raw: null,
    },
  }
}

export function createInitialState() {
  const profile = createEmptyProfile()
  return {
    version: STORAGE_VERSION,
    activeProfileId: profile.id,
    profiles: [profile],
    preferences: {
      theme: 'midnight',
      compactSidebar: false,
    },
    toolState: {},
  }
}

export function normalizeImportedJson(input, previousProfile) {
  const root = input && typeof input === 'object' ? input : {}
  const player = root.player || root.Player || root.profile || root.Profile || root
  const next = structuredClone(previousProfile)

  const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '')

  next.roblox.userId = first(player.userId, player.UserId, root.userId, root.UserId, next.roblox.userId)
  next.roblox.username = String(first(player.username, player.Username, player.name, player.Name, root.username, root.Username, next.roblox.username) || '')
  next.roblox.displayName = String(first(player.displayName, player.DisplayName, root.displayName, root.DisplayName, next.roblox.displayName) || '')

  const cards = first(root.cards, root.Cards, root.inventory?.cards, root.Inventory?.Cards, root.inventory, root.Inventory)
  if (Array.isArray(cards)) next.game.cards = cards
  else if (cards && typeof cards === 'object') next.game.cards = cards

  const auras = first(root.auras, root.Auras, root.inventory?.auras, root.Inventory?.Auras)
  if (auras) next.game.auras = auras

  next.game.currencies = first(root.currencies, root.Currencies, root.money, root.Money, next.game.currencies) || {}
  next.game.skillTree = first(root.skillTree, root.SkillTree, root.skilltree, root.Tree, next.game.skillTree) || {}
  next.game.structures = first(root.structures, root.Structures, next.game.structures) || {}
  next.game.depths = first(root.depths, root.Depths, root.dungeon, root.Dungeon, next.game.depths) || {}
  next.game.tower = first(root.tower, root.Tower, next.game.tower) || {}
  next.game.trials = first(root.trials, root.Trials, next.game.trials) || {}
  next.game.bosses = first(root.bosses, root.Bosses, next.game.bosses) || {}
  next.game.artifacts = first(root.artifacts, root.Artifacts, next.game.artifacts) || {}

  next.game.raw = root
  next.import = {
    source: 'json',
    importedAt: new Date().toISOString(),
    exportVersion: first(root.version, root.Version, root.exportVersion, root.ExportVersion, null),
  }

  if (next.roblox.username && previousProfile.name === 'My Profile') next.name = next.roblox.username
  return next
}

export function countOwnedCards(cards) {
  if (Array.isArray(cards)) {
    return cards.reduce((sum, card) => sum + Math.max(1, Number(card?.quantity ?? card?.count ?? 1) || 1), 0)
  }
  if (cards && typeof cards === 'object') {
    return Object.values(cards).reduce((sum, value) => {
      if (typeof value === 'number') return sum + Math.max(0, value)
      if (value && typeof value === 'object') return sum + Math.max(1, Number(value.quantity ?? value.count ?? 1) || 1)
      return sum + 1
    }, 0)
  }
  return 0
}
