export const tools = [
  {
    id: 'dashboard',
    group: 'Overview',
    name: 'Dashboard',
    icon: '◆',
    description: 'Your shared account summary and shortcuts.',
    status: 'ready',
  },
  {
    id: 'player',
    group: 'Player',
    name: 'Player Data',
    icon: '◎',
    description: 'Import and manage the player JSON used by every tool.',
    status: 'framework',
  },
  {
    id: 'inventory',
    group: 'Player',
    name: 'Inventory',
    icon: '▦',
    description: 'Browse every owned card, quantity, border and mutation.',
    status: 'framework',
  },
  {
    id: 'library',
    group: 'Cards',
    name: 'Card Library',
    icon: '◇',
    description: 'Search the full Card RNG Expansion card catalog.',
    status: 'planned',
  },
  {
    id: 'deck-helper',
    group: 'Deck Tools',
    name: 'Deck Helper',
    icon: '▤',
    description: 'Build and optimize decks from the same saved inventory.',
    status: 'port',
  },
  {
    id: 'depths',
    group: 'Deck Tools',
    name: 'Depths',
    icon: '▼',
    description: 'Depths calculator, optimizer and progression tools.',
    status: 'port',
  },
  {
    id: 'tower',
    group: 'Deck Tools',
    name: 'Tower',
    icon: '▲',
    description: 'Tower simulator and Cheese Maker.',
    status: 'port',
  },
  {
    id: 'calculators',
    group: 'Utilities',
    name: 'Calculators',
    icon: '∑',
    description: 'Luck, roll speed, rarity and progression calculators.',
    status: 'planned',
  },
]

export function toolById(id) {
  return tools.find(tool => tool.id === id) || tools[0]
}
