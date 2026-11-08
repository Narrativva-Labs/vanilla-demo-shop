import { t } from './i18n.js';
import { contact } from './datalayer.js';

export const contactDetails = Object.freeze({
  email: 'ovoce@demoshop.frantisekbujnovsky.com',
  phone: '+420000000000',
  displayPhone: '+420 000 000 000'
});

export function contactMarkup() {
  return `<section class="contacts"><h2>${t.contactsTitle}</h2><p>${t.contactsHint}</p><div class="contact-links"><a data-contact="email" href="mailto:${contactDetails.email}">${contactDetails.email}</a><a data-contact="phone" href="tel:${contactDetails.phone}">${contactDetails.displayPhone}</a></div></section>`;
}

export function setupContacts() {
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-contact]');
    if (link?.dataset.contact === 'email') contact('click_mail');
    if (link?.dataset.contact === 'phone') contact('click_tel');
    // Keep the browser's native mailto/tel action.
  });

  const lastCopied = new Map();
  const normalize = text => text.replace(/\s/g, '').toLowerCase();
  document.addEventListener('copy', () => {
    const selected = normalize(window.getSelection()?.toString() || '');
    if (!selected) return;
    const now = performance.now();
    for (const [value, event] of [[contactDetails.email, 'copy_email'], [contactDetails.phone, 'copy_phone']]) {
      if (!selected.includes(normalize(value))) continue;
      const last = lastCopied.get(event);
      if (last !== undefined && now - last < 2000) continue;
      lastCopied.set(event, now);
      contact(event);
    }
  });
}
