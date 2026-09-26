export const SCHEMA_VERSION = 19;
export const STATE_LIMIT_BYTES = 5_000_000;
export function isValidState(state) {
  return !!state && typeof state === 'object' && !Array.isArray(state) && !!state.settings && Array.isArray(state.trades);
}
export function sanitizeState(state) {
  if (!isValidState(state)) throw new Error('Invalid XE3AGLE state');
  return structuredClone(state);
}
