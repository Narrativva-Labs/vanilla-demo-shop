/* Local-only laboratory recorder. No field values, clipboard contents or resource URLs. */
(() => {
  'use strict';
  const KEY = 'lab-agent-zaznam-v1', LIMIT = 2000;
  const boot = window.__agentRecorderBoot, page = location.pathname.split('/').pop();
  const now = () => performance.timeOrigin + performance.now();
  const fresh = () => ({ epoch: boot.epoch, lines: [], dropped: 0, counts: {}, trusted: {}, clicks: 0,
    centered: 0, withoutMove: 0, insertions: {}, globals: [], foreign: 0, verdict: null });
  let state = fresh(), storageOK = true, dirty = true, timerDone;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY));
    if (saved && saved.epoch > 0 && Array.isArray(saved.lines) && saved.counts && saved.trusted) state = saved;
  } catch (_) { storageOK = false; }
  const logEl = document.getElementById('log'), status = document.getElementById('status');
  const round = n => Math.round(n * 100) / 100;
  const target = el => ({ tag: el && el.tagName ? el.tagName.toLowerCase() : 'document',
    id: el && el.id ? el.id.slice(0, 60) : null });
  function record(type, data = {}, count = 1) {
    const row = { t: round(now() - state.epoch), page, type, ...data };
    state.lines.push(row);
    if (state.lines.length > LIMIT) { state.dropped += state.lines.length - LIMIT; state.lines.splice(0, state.lines.length - LIMIT); }
    state.counts[type] = (state.counts[type] || 0) + count;
    if (typeof data.isTrusted === 'boolean') {
      const key = type + ':' + data.isTrusted;
      state.trusted[key] = (state.trusted[key] || 0) + count;
    }
    dirty = true;
    return row;
  }
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); storageOK = true; }
    catch (_) { storageOK = false; status.textContent = 'SessionStorage není dostupné nebo je plné; přechod nemusí uchovat log. Zkopíruj jej nyní.'; }
  }
  function render() {
    if (!dirty) return;
    dirty = false;
    const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 30;
    logEl.textContent = state.lines.map(row => JSON.stringify(row)).join('\n');
    if (atBottom) logEl.scrollTop = logEl.scrollHeight;
    save();
  }
  const safe = fn => { try { return fn(); } catch (_) { return null; } };
  const origin = url => safe(() => new URL(url, location.href).origin);
  function environment() {
    const canvas = document.createElement('canvas');
    const gl = safe(() => canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    const ext = gl && safe(() => gl.getExtension('WEBGL_debug_renderer_info'));
    const webgl = ext ? { vendor: safe(() => gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)), renderer: safe(() => gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) } : null;
    if (gl) { const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
    const ua = navigator.userAgentData;
    record('environment', { webdriver: navigator.webdriver ?? null, userAgent: navigator.userAgent,
      userAgentData: ua ? { brands: ua.brands, mobile: ua.mobile, platform: ua.platform } : null,
      languages: Array.from(navigator.languages || []), hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemory: navigator.deviceMemory ?? null, maxTouchPoints: navigator.maxTouchPoints,
      plugins: navigator.plugins?.length ?? null, mimeTypes: navigator.mimeTypes?.length ?? null,
      screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight, colorDepth: screen.colorDepth },
      window: { outerWidth, outerHeight, innerWidth, innerHeight }, devicePixelRatio,
      hasFocus: document.hasFocus(), visibilityState: document.visibilityState,
      notificationPermission: safe(() => Notification.permission), webgl,
      chromeKeys: safe(() => Object.getOwnPropertyNames(window.chrome)), chromeRuntime: safe(() => !!window.chrome.runtime),
      media: Object.fromEntries(['display-mode: standalone', 'display-mode: fullscreen', 'prefers-reduced-motion: reduce'].map(q => [q, matchMedia('(' + q + ')').matches])),
      navigation: performance.getEntriesByType('navigation')[0]?.type ?? null,
      legacyNavigation: performance.navigation?.type ?? null, referrerOrigin: document.referrer ? origin(document.referrer) : null });
  }
  let globals = new Set(boot.globals);
  const automationPattern = /cdc_|__playwright|__pw|puppeteer|selenium|webdriver|domAutomation|callPhantom/i;
  record('automation_globals', { names: [...globals].filter(k => automationPattern.test(k)) });
  function checkGlobals() {
    const current = new Set(Object.getOwnPropertyNames(window));
    const added = [...current].filter(k => !globals.has(k)), removed = [...globals].filter(k => !current.has(k));
    if (added.length || removed.length) {
      record('globals_diff', { added, removed });
      state.globals = [...new Set(state.globals.concat(added))];
    }
    globals = current;
  }
  setInterval(checkGlobals, 500);
  const probe = { experimental: true, getterCalled: false, note: 'Experiment CDP Runtime; DevTools mohou ovlivnit výsledek. Nic nerozhoduje.' };
  const error = new Error('Laboratorní experiment CDP Runtime');
  Object.defineProperty(error, 'stack', { get() {
    if (!probe.getterCalled) { probe.getterCalled = true; record('cdp_runtime', { ...probe }); }
    return '';
  } });
  console.debug(error);
  record('cdp_runtime', { ...probe });

  // Only the form and output are excluded. Elsewhere observe the entire light DOM.
  const task = document.getElementById('task'), output = document.getElementById('recorder-output');
  const owned = new WeakSet(document.querySelectorAll('[data-lab-owned]'));
  let seen = new WeakMap(); let nodeNumber = 0, replayingEarly = true;
  const excluded = el => el === task || el === output || task.contains(el) || output.contains(el);
  function describe(el) {
    const cs = safe(() => getComputedStyle(el)), r = el.getBoundingClientRect();
    const data = { ...target(el), attrs: Array.from(el.attributes, a => ({ name: a.name,
      ...(['id', 'class'].includes(a.name) ? { value: a.value.slice(0, 60) } : {}) })),
      display: cs?.display ?? null, position: cs?.position ?? null, zIndex: cs?.zIndex ?? null,
      rect: { width: round(r.width), height: round(r.height) }, openShadow: !!el.shadowRoot,
      customElement: el.localName.includes('-') };
    if (['style', 'link', 'script', 'iframe'].includes(el.localName)) {
      const src = el.getAttribute(el.localName === 'link' ? 'href' : 'src');
      data.resource = { origin: src ? origin(src) : null, urlLength: src?.length || 0,
        inlineLength: ['style', 'script'].includes(el.localName) ? el.textContent.length : 0 };
    }
    return data;
  }
  function domNode(el, action, parent) {
    if (el.nodeType !== 1 || excluded(el) || owned.has(el)) return;
    let info = seen.get(el);
    if (replayingEarly && action === 'added' && info?.present) return;
    if (!info) { info = { node: page + ':n' + (++nodeNumber), addedAt: null }; seen.set(el, info); }
    if (action === 'added' || action === 'initial') { info.addedAt = now(); info.present = true; if (!info.counted) { state.foreign++; info.counted = true; } }
    if (action === 'removed') info.present = false;
    record('dom_' + action, { node: info.node, parent: target(parent), ...describe(el),
      ...(action === 'removed' && info.addedAt !== null ? { appearedAndDisappeared: true, lifetimeMs: round(now() - info.addedAt) } : {}) });
  }
  function tree(el, action, parent) {
    if (el.nodeType !== 1 || excluded(el)) return;
    domNode(el, action, parent);
    el.querySelectorAll('*').forEach(child => domNode(child, action, child.parentElement));
  }
  function onMutations(records) {
    records.forEach(r => {
      if (excluded(r.target)) return;
      if (r.type === 'attributes') {
        if (r.target === document.documentElement || r.target === document.body || !owned.has(r.target)) {
          record('dom_attribute', { attribute: r.attributeName, ...describe(r.target) });
        }
      } else {
        r.addedNodes.forEach(el => tree(el, 'added', r.target));
        r.removedNodes.forEach(el => tree(el, 'removed', r.target));
      }
    });
  }
  const pendingDOM = boot.pendingDOM.concat(boot.observer.takeRecords());
  boot.observer.disconnect();
  // Include removed early injected nodes, but avoid counting connected nodes twice.
  pendingDOM.forEach(r => {
    for (const node of [...r.addedNodes, ...r.removedNodes]) {
      if (node.nodeType === 1) {
        if (node.hasAttribute('data-lab-owned')) owned.add(node);
        node.querySelectorAll('[data-lab-owned]').forEach(el => owned.add(el));
      }
    }
  });
  onMutations(pendingDOM);
  replayingEarly = false;
  document.querySelectorAll('*').forEach(el => { if (!seen.has(el)) domNode(el, 'initial', el.parentElement); });
  boot.pendingDOM = [];
  const observer = new MutationObserver(onMutations);
  observer.observe(document, { subtree: true, childList: true, attributes: true });

  let lastMove = null, lastKey = null, lastInput = null;
  let motion = {}, scrolls = new Map(), selections = { count: 0, trusted: 0, untrusted: 0 };
  const previousMotion = {};
  ['pointermove', 'mousemove'].forEach(type => document.addEventListener(type, e => {
    const key = type + ':' + e.isTrusted;
    const group = motion[key] ||= { eventType: type, isTrusted: e.isTrusted, count: 0, pathPx: 0, maxJumpPx: 0 };
    const prev = previousMotion[type], distance = prev ? Math.hypot(e.clientX - prev.x, e.clientY - prev.y) : 0;
    group.count++; group.pathPx += distance; group.maxJumpPx = Math.max(group.maxJumpPx, distance);
    previousMotion[type] = { x: e.clientX, y: e.clientY }; lastMove = now();
  }, { capture: true, passive: true }));
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'].forEach(type => document.addEventListener(type, e => {
    const r = e.target.getBoundingClientRect?.();
    const dx = r ? e.clientX - (r.left + r.width / 2) : null, dy = r ? e.clientY - (r.top + r.height / 2) : null;
    const distance = r ? Math.hypot(dx, dy) : null;
    if (type === 'click') { state.clicks++; if (distance !== null && distance < 2) state.centered++; if (lastMove === null) state.withoutMove++; }
    record(type, { isTrusted: e.isTrusted, pointerType: e.pointerType ?? null, button: e.button, buttons: e.buttons,
      detail: e.detail, pressure: e.pressure ?? null, width: e.width ?? null, height: e.height ?? null,
      clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY, screenX: e.screenX, screenY: e.screenY,
      centerDx: dx === null ? null : round(dx), centerDy: dy === null ? null : round(dy), centerDistancePx: distance === null ? null : round(distance),
      sinceMoveMs: lastMove === null ? null : round(now() - lastMove), target: target(e.target) });
  }, true));
  ['keydown', 'keyup'].forEach(type => document.addEventListener(type, e => {
    const keyType = /^\p{L}$/u.test(e.key) ? 'letter' : /^\p{N}$/u.test(e.key) ? 'number' : 'special';
    record(type, { isTrusted: e.isTrusted, keyType, repeat: e.repeat, intervalMs: lastKey === null ? null : round(now() - lastKey), target: target(e.target) });
    lastKey = now();
  }, true));
  ['beforeinput', 'input'].forEach(type => document.addEventListener(type, e => {
    const inputType = e.inputType || 'unknown';
    if (type === 'input') state.insertions[inputType] = (state.insertions[inputType] || 0) + 1;
    record(type, { isTrusted: e.isTrusted, inputType, insertedLength: typeof e.data === 'string' ? e.data.length : e.dataTransfer ? e.dataTransfer.getData('text/plain').length : null,
      valueLength: typeof e.target.value === 'string' ? e.target.value.length : null,
      intervalMs: lastInput === null ? null : round(now() - lastInput), target: target(e.target) });
    lastInput = now();
  }, true));
  ['change', 'focus', 'blur', 'focusin', 'copy', 'paste', 'wheel', 'touchstart'].forEach(type => document.addEventListener(type, e => {
    record(type, { isTrusted: e.isTrusted, target: target(e.target),
      ...(type === 'wheel' ? { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode } : {}),
      ...(type === 'touchstart' ? { touches: e.touches.length } : {}) });
  }, { capture: true, passive: true }));
  const scrollPositions = new WeakMap();
  scrollPositions.set(document, { x: scrollX, y: scrollY });
  document.addEventListener('scroll', e => {
    // Do not let our own log autoscroll pollute the measured page scrolling.
    if (output.contains(e.target)) return;
    const el = e.target, x = el === document ? scrollX : el.scrollLeft, y = el === document ? scrollY : el.scrollTop;
    const prev = scrollPositions.get(el) || { x: 0, y: 0 };
    scrollPositions.set(el, { x, y });
    let byTrust = scrolls.get(el); if (!byTrust) { byTrust = {}; scrolls.set(el, byTrust); }
    const g = byTrust[e.isTrusted] ||= { count: 0, pathPx: 0, isTrusted: e.isTrusted, target: target(el) };
    g.count++; g.pathPx += Math.hypot(x - prev.x, y - prev.y);
  }, { capture: true, passive: true });
  document.addEventListener('selectionchange', e => { selections.count++; selections[e.isTrusted ? 'trusted' : 'untrusted']++; });
  let windowStart = now();
  function flush() {
    const elapsed = Math.max(1, now() - windowStart);
    Object.values(motion).forEach(g => record(g.eventType + '_summary', { ...g, pathPx: round(g.pathPx), maxJumpPx: round(g.maxJumpPx), windowMs: round(elapsed) }, g.count));
    motion = {};
    scrolls.forEach(groups => Object.values(groups).forEach(g => record('scroll_summary', { ...g, pathPx: round(g.pathPx), speedPxPerSecond: round(g.pathPx * 1000 / elapsed), windowMs: round(elapsed) }, g.count)));
    scrolls = new Map();
    if (selections.count) {
      for (const isTrusted of [true, false]) {
        const count = selections[isTrusted ? 'trusted' : 'untrusted'];
        if (count) record('selectionchange_summary', { count, isTrusted, windowMs: round(elapsed) }, count);
      }
      selections = { count: 0, trusted: 0, untrusted: 0 };
    }
    windowStart = now();
  }
  setInterval(() => { flush(); render(); }, 250);
  document.addEventListener('visibilitychange', e => { record('visibilitychange', { isTrusted: e.isTrusted, visibilityState: document.visibilityState }); flush(); render(); });
  ['pagehide', 'pageshow'].forEach(type => window.addEventListener(type, e => {
    record(type, { isTrusted: e.isTrusted, persisted: e.persisted }); flush(); render();
    // The detector may publish its final verdict in a later pagehide listener.
    if (type === 'pagehide') save();
  }));
  function verdict(event) {
    if (!event || event.event !== 'traffic_class') return;
    const data = {};
    for (const name of ['traffic_class', 'traffic_phase', 'traffic_score', 'traffic_version', 'traffic_agent', 'traffic_agent_claim', 'traffic_webmcp', 'traffic_replay']) {
      if (['string', 'number', 'boolean'].includes(typeof event[name])) data[name] = event[name];
    }
    data.traffic_signals = Array.isArray(event.traffic_signals) ? event.traffic_signals.filter(s => typeof s === 'string') : [];
    state.verdict = data; record('traffic_class', data); save();
  }
  const layer = window.labLayer, push = layer.push;
  layer.push = function (...events) { const result = push.apply(this, events); events.forEach(verdict); return result; };
  layer.forEach(verdict);
  document.getElementById('verdict-script').addEventListener('error', () => { record('detector_error', { reason: 'Načtení detektoru selhalo (síť, CSP nebo SRI).' }); render(); });
  function summary(reason) {
    flush(); checkGlobals();
    const data = { reason, counts: { ...state.counts }, byTrust: { ...state.trusted }, clicks: state.clicks,
      centeredClicks: state.centered, centeredClickRatio: state.clicks ? round(state.centered / state.clicks) : null,
      clicksWithoutPriorMovement: state.withoutMove, inputTypes: { ...state.insertions },
      newGlobals: [...state.globals], foreignDOMElements: state.foreign, verdict: state.verdict,
      retainedRows: state.lines.length, droppedRows: state.dropped, storageAvailable: storageOK };
    record('summary', data);
    document.getElementById('summary').textContent = `Události: ${Object.values(data.counts).reduce((a, b) => a + b, 0)}; kliky: ${data.clicks}; uprostřed (< 2 px): ${data.centeredClicks}; bez předchozího pohybu: ${data.clicksWithoutPriorMovement}; cizí DOM prvky: ${data.foreignDOMElements}; nové globály: ${data.newGlobals.length}; verdikt: ${data.verdict?.traffic_class || 'zatím nedostupný'}. Podrobnosti jsou v JSON řádku summary.`;
    render();
  }
  document.getElementById('start')?.addEventListener('click', () => { record('task_start'); status.textContent = 'Začátek zaznamenán. Pokračuj formulářem.'; });
  document.getElementById('done')?.addEventListener('click', () => {
    summary('done'); status.textContent = 'Hotovo zaznamenáno. Počkej 10 sekund na závěrečný souhrn.';
    clearTimeout(timerDone);
    timerDone = setTimeout(() => { summary('done_plus_10s'); status.textContent = 'Závěrečný souhrn je připraven. Zkopíruj celý Log do odpovědi.'; }, 10000);
  });
  if (document.body.dataset.step === '2') setTimeout(() => summary('step2_plus_10s'), 10000);
  document.getElementById('next')?.addEventListener('click', () => { flush(); render(); });
  function exportLog() { flush(); render(); return logEl.textContent; }
  document.getElementById('copy').addEventListener('click', async () => {
    const text = exportLog();
    try { await navigator.clipboard.writeText(text); status.textContent = 'Celý log zkopírován.'; }
    catch (_) {
      const range = document.createRange(); range.selectNodeContents(logEl);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      status.textContent = document.execCommand('copy') ? 'Celý log zkopírován.' : 'Log je označený. Zkopíruj ho ručně (Ctrl/Cmd+C).';
    }
  });
  document.getElementById('download').addEventListener('click', () => {
    exportLog();
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.lines, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'agent-zaznam.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('clear').addEventListener('click', () => {
    state = fresh(); state.epoch = now(); seen = new WeakMap(); lastMove = lastKey = lastInput = null;
    motion = {}; scrolls = new Map(); selections = { count: 0, trusted: 0, untrusted: 0 };
    for (const key of Object.keys(previousMotion)) delete previousMotion[key];
    globals = new Set(Object.getOwnPropertyNames(window));
    dirty = true; document.getElementById('summary').textContent = 'Log i souhrn byly vymazány; záznam pokračuje.';
    status.textContent = 'Vymazáno. Záznam běží.'; render();
  });
  environment();
  record('recorder_ready', { limit: LIMIT, moveWindowMs: 250, globalsWindowMs: 500, noFieldValues: true });
  render();
})();
