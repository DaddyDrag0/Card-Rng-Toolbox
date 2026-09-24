import { createInitialState, STORAGE_VERSION } from './schema.js'

const KEY = 'card-rng-toolbox:state'
const listeners = new Set()

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (parsed && parsed.version === STORAGE_VERSION && Array.isArray(parsed.profiles)) return parsed
  } catch {}
  return createInitialState()
}

let state = load()

function save() {
  localStorage.setItem(KEY, JSON.stringify(state))
  for (const listener of listeners) listener(state)
}

export const store = {
  get() {
    return state
  },
  activeProfile() {
    return state.profiles.find(profile => profile.id === state.activeProfileId) || state.profiles[0]
  },
  update(mutator) {
    const draft = structuredClone(state)
    mutator(draft)
    state = draft
    save()
  },
  setActiveProfile(id) {
    if (!state.profiles.some(profile => profile.id === id)) return
    this.update(draft => { draft.activeProfileId = id })
  },
  replaceProfile(profile) {
    this.update(draft => {
      const index = draft.profiles.findIndex(item => item.id === profile.id)
      if (index >= 0) draft.profiles[index] = profile
      else draft.profiles.push(profile)
      draft.activeProfileId = profile.id
    })
  },
  deleteProfile(id) {
    this.update(draft => {
      if (draft.profiles.length <= 1) return
      draft.profiles = draft.profiles.filter(profile => profile.id !== id)
      if (draft.activeProfileId === id) draft.activeProfileId = draft.profiles[0].id
    })
  },
  setToolState(toolId, value) {
    this.update(draft => {
      draft.toolState[toolId] = value
    })
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  exportAll() {
    return JSON.stringify(state, null, 2)
  },
  reset() {
    state = createInitialState()
    save()
  },
}
