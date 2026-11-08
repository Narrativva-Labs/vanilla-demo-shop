// window.name keeps the demo usable across same-tab page loads when storage is blocked.
const prefix = 'vanilla-fruit:';
let memory = {};
try { if (window.name.startsWith(prefix)) memory = JSON.parse(window.name.slice(prefix.length)); } catch { /* Use empty fallback. */ }
export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* Storage may be unavailable. */ }
  return memory[key] ?? fallback;
}
export function write(key, value) {
  memory[key] = value;
  try { window.name = prefix + JSON.stringify(memory); } catch { /* In-memory fallback remains. */ }
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* Same-tab fallback remains. */ }
}
