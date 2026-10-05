// Key-value storage backed by chrome.storage.local (device-only, never synced).
// Falls back to localStorage so the page also runs outside the extension, e.g. on a dev server.

const chromeArea = globalThis.chrome?.storage?.local;

function createChromeBackend(area) {
  return {
    async get(key) {
      const result = await area.get(key);
      return result[key];
    },
    async set(key, value) {
      await area.set({ [key]: value });
    },
    async remove(key) {
      await area.remove(key);
    },
    async getAll(prefix) {
      const all = await area.get(null);
      return Object.entries(all)
        .filter(([key]) => key.startsWith(prefix))
        .map(([, value]) => value);
    },
    onChange(listener) {
      globalThis.chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        for (const [key, { newValue }] of Object.entries(changes)) listener(key, newValue);
      });
    },
  };
}

export function createLocalBackend(store = globalThis.localStorage, target = globalThis) {
  const parse = (raw) => (raw == null ? undefined : JSON.parse(raw));
  return {
    async get(key) {
      return parse(store.getItem(key));
    },
    async set(key, value) {
      store.setItem(key, JSON.stringify(value));
    },
    async remove(key) {
      store.removeItem(key);
    },
    async getAll(prefix) {
      const values = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key.startsWith(prefix)) values.push(parse(store.getItem(key)));
      }
      return values;
    },
    onChange(listener) {
      // The `storage` event only fires in *other* tabs, which is exactly what we want.
      target.addEventListener?.('storage', (event) => {
        if (event.key) listener(event.key, parse(event.newValue));
      });
    },
  };
}

export const storage = chromeArea ? createChromeBackend(chromeArea) : createLocalBackend();
