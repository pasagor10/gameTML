// Each character owns its save, equipment, profile and run history. Legacy keys stay intact.
export const CHARACTER_LIMIT = 6;
const INDEX = 'tilmo-characters-v1';
const FIELDS = ['tilmo-save', 'tilmo-stash', 'tilmo-profile', 'tilmo-runs'];
export function createCharacterStore(storage) {
  let state;
  const raw = storage.getItem(INDEX);
  if (raw) {
    state = JSON.parse(raw);
    if (state.v !== 1 || !Array.isArray(state.slots) || !state.slots.length || !state.slots.some(s => s.id === state.active)) throw Error('อ่านรายชื่อตัวละครไม่ได้');
  } else {
    const id = 'hero-1';
    for (const key of FIELDS) {
      const value = storage.getItem(key);
      if (value !== null) storage.setItem(`${id}:${key}`, value);
    }
    state = {v: 1, active: id, slots: [{id}]};
    storage.setItem(INDEX, JSON.stringify(state));
  }
  const commit = next => { storage.setItem(INDEX, JSON.stringify(next)); state = next; };
  return {
    get active() { return state.active; },
    list() { return state.slots.map(s => ({...s})); },
    getItem(key, id = state.active) { return storage.getItem(`${id}:${key}`); },
    setItem(key, value) { storage.setItem(`${state.active}:${key}`, value); },
    removeItem(key) { storage.removeItem(`${state.active}:${key}`); },
    select(id) {
      if (!state.slots.some(s => s.id === id)) throw Error('ไม่พบตัวละคร');
      commit({...state, active: id});
    },
    create(profile) {
      if (state.slots.length >= CHARACTER_LIMIT) throw Error('ครบ 6 ตัวละครแล้ว');
      if (!['a','b'].includes(profile.appearance)) throw Error('ข้อมูลตัวละครไม่ถูกต้อง');
      const id = `hero-${Date.now()}-${state.slots.length + 1}`;
      storage.setItem(`${id}:tilmo-profile`, JSON.stringify({...profile,job:'novice'}));
      commit({...state, active: id, slots: [...state.slots, {id}]});
      return id;
    }
  };
}
