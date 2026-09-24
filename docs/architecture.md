# Card RNG Toolbox architecture

## Goal

One website, one player profile, one canonical game-data layer.

Existing tools should keep their tested battle/calculation engines where possible. The part we replace is duplicated inventory, profile, settings, card-data and import logic.

## Shared profile

All tools read from the active Toolbox profile.

```text
Toolbox state
├─ activeProfileId
├─ profiles[]
│  ├─ roblox
│  ├─ import metadata
│  └─ game
│     ├─ cards
│     ├─ auras
│     ├─ currencies
│     ├─ skillTree
│     ├─ structures
│     ├─ depths
│     ├─ tower
│     ├─ trials
│     ├─ bosses
│     ├─ artifacts
│     └─ raw export
├─ preferences
└─ toolState
```

The raw JSON export is preserved even before we know its final shape. A normalization adapter maps the real game export into the canonical fields after a sample export is available.

## Account / profile plan

### Phase 1 — now
Local browser profiles. Player JSON is pasted manually.

### Phase 2 — game export exists
Exact parser for the PlayerStats JSON. Inventory, borders, mutations, skill tree, progression and currencies are normalized.

### Phase 3 — Discord bridge
A webhook/bot receives exports. A small backend validates and stores the latest export by Roblox user ID. The website can then load/sync a player profile.

The frontend tools do not change between phases because they read the same canonical profile shape.

## Migration order

1. Deck Helper
   - reuse optimizer and card logic
   - replace its 30-card local inventory with Toolbox inventory
   - keep optional temporary/manual inventory overrides

2. Depths
   - reuse battle engine, workers and Depths UI
   - load cards/auras/skill-tree values from the active Toolbox profile

3. Tower Cheese Maker
   - reuse Tower engine and Deep Search worker
   - use the same player inventory/aura ownership where useful

4. Card Library + calculators
   - centralize card/ability/aura/catalog data
   - remove duplicate copies from individual tools

## Data rule

There should be one canonical copy of cards, abilities, auras, mutations and player-owned data in this repository. Tools import from that shared layer instead of maintaining their own versions.
