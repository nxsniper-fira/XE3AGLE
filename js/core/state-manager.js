export const StateManager={
  get(){return window.state},
  update(patch){Object.assign(window.state,patch);window.saveState?.();return window.state},
  snapshot(){return structuredClone(window.state)},
  restore(snapshot){window.state=structuredClone(snapshot);window.saveState?.();return window.state}
};
window.XE3AGLE_STATE=StateManager;
