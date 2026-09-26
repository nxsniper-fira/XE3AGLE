/* XE3AGLE — dark, muted light, blue themes */
const THEMES = {
  dark:  { label: 'Dark',  key: 'dark'  },
  light: { label: 'White', key: 'light' },
  blue:  { label: 'Blue',  key: 'blue'  },
};

const STORAGE_KEY = 'xe3agle_theme';

function get() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t && THEMES[t]) return t;
  } catch {}
  return 'dark';
}

function apply(name) {
  const key = THEMES[name] ? name : 'dark';
  const root = document.documentElement;
  root.dataset.theme = key;
  root.classList.toggle('xe-light', key === 'light');
  root.classList.toggle('xe-blue', key === 'blue');
  if (key !== 'light') root.classList.remove('xe-light');
  if (key !== 'blue')  root.classList.remove('xe-blue');
  try { localStorage.setItem(STORAGE_KEY, key); } catch {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const colors = { dark: '#050506', light: '#171a22', blue: '#060a12' };
    meta.setAttribute('content', colors[key] || colors.dark);
  }
  document.querySelectorAll('[data-theme-option]').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-theme-option') === key);
  });
  return key;
}

function set(name) {
  return apply(name);
}

function init() {
  const current = get();
  apply(current);
  document.querySelectorAll('[data-theme-option]').forEach((el) => {
    el.addEventListener('click', () => set(el.getAttribute('data-theme-option')));
  });
  return current;
}

export const ThemeManager = {
  THEMES,
  init,
  apply,
  set,
  get,
};

window.XE3AGLE_THEMES = ThemeManager;
window.setTheme = (name) => ThemeManager.set(name);
