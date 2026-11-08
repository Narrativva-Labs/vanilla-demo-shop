import { language, t } from './i18n.js';

export function setupHeader() {
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t[node.dataset.i18n];
  });
  document.querySelector('h1').textContent = t.titles[document.body.dataset.page];
  document.title = t.titles[document.body.dataset.page] + ' | Vanilla Fruit Shop';
  document.getElementById('query').placeholder = t.searchPlaceholder;
  document.querySelector('nav').setAttribute('aria-label', t.navLabel);
  const file = location.pathname.split('/').pop() || 'index.html';
  const root = new URL(language === 'en' ? '../' : './', location.href);
  for (const code of ['cs', 'en']) {
    const link = document.getElementById('language-' + code);
    link.href = new URL((code === 'en' ? 'en/' : '') + file + location.search + location.hash, root).href;
    if (code === language) link.setAttribute('aria-current', 'page');
  }
  const header = document.querySelector('header');
  const toggle = document.getElementById('search-toggle');
  const form = document.getElementById('search-form');
  function show(open) {
    toggle.setAttribute('aria-expanded', String(open));
    form.classList.toggle('is-open', open);
    if (open) document.getElementById('query').focus();
  }
  toggle.addEventListener('click', () => show(toggle.getAttribute('aria-expanded') !== 'true'));
  form.addEventListener('keydown', event => {
    if (event.key === 'Escape') { show(false); toggle.focus(); }
  });
  // The search is visible without JavaScript. Only a working toggle enables collapse.
  header.classList.add('search-ready');
}
