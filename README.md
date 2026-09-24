# Card RNG Toolbox

Unified toolbox for **Card RNG Expansion**.

The goal is to bring the existing Deck Helper, Depths calculator, Tower Cheese Maker, card library, calculators, and future player-data viewer into one website with **one shared player profile and one shared data layer**.

## Current framework

- Toolbox dashboard + sidebar navigation
- Shared local player profiles
- JSON player-data importer
- Shared inventory preview
- Placeholder modules for Deck Helper, Depths, Tower, Card Library, and calculators
- Architecture ready for a future Discord/webhook player-data bridge
- GitHub Pages deployment workflow

See [docs/architecture.md](docs/architecture.md) for the shared-data and migration plan.

## Core rule

Existing tools keep their tested calculation/battle engines where possible. Their duplicate inventory/profile/settings layers get replaced by the shared Toolbox profile.
