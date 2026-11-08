import { products } from './products.js';
import { item, valueOf, ecommerce, search, lead, roundMoney, taxOf } from './datalayer.js';
import { read, write } from './storage.js';
import { language, t, productText } from './i18n.js';
import { setupHeader } from './header.js';
import { setupContacts, contactMarkup } from './contacts.js';

setupHeader();
setupContacts();
const page = document.body.dataset.page;
const content = document.getElementById('content');
const params = new URLSearchParams(location.search);
const money = amount => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 2 }).format(amount);
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const go = path => { location.href = path; };
const nameOf = row => productText(row.item_id).name;
const image = product => product.image || product.emoji;
const getCart = () => {
  const saved = read('cart', []);
  return Array.isArray(saved) ? saved.filter(row => products.some(p => p.id === row.item_id) && Number.isInteger(row.quantity) && row.quantity > 0) : [];
};
let cart = getCart();
function count() { document.getElementById('cart-count').textContent = getCart().reduce((n, row) => n + row.quantity, 0); }
count();
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
window.addEventListener('storage', count);
// Stored choices and event parameters stay canonical in both languages.
const shippingCost = () => read('shipping', '') === 'Kurýr' ? 99 : 0;
const shippingText = choice => choice === 'Kurýr' ? t.courier : t.pickup;
const paymentText = choice => choice === 'Převodem' ? t.transfer : t.card;
function table(items) {
  return `<ul class="cart-items">${items.map(row => `<li><div><strong>${escape(nameOf(row))}</strong><br>${row.quantity} × ${money(row.price)}</div><strong>${money(row.price * row.quantity)}</strong>${page === 'cart' ? `<button data-remove="${escape(row.item_id)}">${t.remove}<span class="sr-only"> ${escape(nameOf(row))}</span></button>` : ''}</li>`).join('')}</ul><p class="total">${t.subtotal} ${money(valueOf(items))}</p>`;
}
function list(found, id, name) {
  const origin = { item_list_id: id, item_list_name: name };
  ecommerce('view_item_list', found.map((p, index) => item(p, 1, { ...origin, index })), origin);
  content.innerHTML += `<div class="grid">${found.map((p, index) => `<a class="product" href="produkt.html?id=${p.id}&amp;list=${id}&amp;index=${index}"><span class="tag">${t.categories[p.category]}</span><span class="fruit" aria-hidden="true">${image(p)}</span><h2>${productText(p.id).name}</h2><p>${productText(p.id).description}</p><div class="price">${money(p.price)} <span aria-hidden="true">↗</span></div></a>`).join('')}</div>`;
  content.querySelectorAll('.product').forEach((link, index) => {
    const select = () => ecommerce('select_item', [item(found[index], 1, { ...origin, index })], origin);
    link.addEventListener('click', select);
    link.addEventListener('auxclick', event => { if (event.button === 1) select(); });
  });
}
const checkout = ['shipping', 'payment', 'summary'];
if (checkout.includes(page) && !cart.length) {
  location.replace('kosik.html');
} else if (page === 'home') {
  content.innerHTML = `<p class="intro">${t.homeIntro}</p><p class="sticker">${t.sticker}</p>`;
  list(products, 'home', 'Domovská stránka');
} else if (page === 'search') {
  const term = (params.get('q') || '').slice(0, 120).trim();
  document.getElementById('query').value = term;
  search(term);
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs');
  const found = term ? products.filter(p => [p.name, productText(p.id).name].some(name => normalize(name).includes(normalize(term)))) : [];
  content.innerHTML = `<p>${t.searchFor} <strong>${escape(term || t.nothing)}</strong></p>${!found.length ? `<p class="empty">${t.noResults}</p><p>${t.noResultsHint}</p>` : ''}`;
  list(found, 'search', 'Výsledky hledání');
} else if (page === 'product') {
  const product = products.find(p => p.id === params.get('id'));
  if (!product) {
    content.innerHTML = `<p>${t.missingProduct}</p><a class="button" href="index.html">${t.backHarvest}</a>`;
  } else {
    document.querySelector('h1').textContent = productText(product.id).name;
    const listId = params.get('list');
    const origin = ['home', 'search'].includes(listId) ? { item_list_id: listId, item_list_name: listId === 'home' ? 'Domovská stránka' : 'Výsledky hledání', index: Math.max(0, Number.parseInt(params.get('index'), 10) || 0) } : {};
    const row = item(product, 1, origin);
    ecommerce('view_item', [row]);
    content.innerHTML = `<div class="detail"><div class="fruit giant" aria-hidden="true">${image(product)}</div><div><span class="tag">${t.categories[product.category]}</span><p class="intro small">${productText(product.id).description}</p><p class="price">${money(product.price)} / ${t.unit}</p><p>${t.excludingTax}</p><button id="add">${t.add}</button><p id="added" role="status"></p><a class="button secondary" href="kosik.html">${t.goCart}</a></div></div>`;
    document.getElementById('add').addEventListener('click', () => {
      cart = getCart();
      const existing = cart.find(r => r.item_id === product.id);
      if (existing) existing.quantity++; else cart.push({ ...row });
      write('cart', cart);
      ecommerce('add_to_cart', [row]);
      count();
      document.getElementById('added').textContent = t.added;
    });
  }
} else if (page === 'cart') {
  ecommerce('view_cart', cart);
  function renderCart() {
    content.innerHTML = cart.length ? `${table(cart)}<a class="button" id="checkout" href="doprava.html">${t.checkout}</a>` : `<p class="empty">${t.emptyCart}</p><p>${t.emptyCartHint}</p><a class="button" href="index.html">${t.firstFruit}</a>`;
    content.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
      cart = getCart();
      const row = cart.find(r => r.item_id === button.dataset.remove);
      if (row) ecommerce('remove_from_cart', [row]);
      cart = cart.filter(r => r.item_id !== button.dataset.remove);
      write('cart', cart); count(); renderCart();
    }));
    document.getElementById('checkout')?.addEventListener('click', () => {
      const current = getCart();
      if (current.length) ecommerce('begin_checkout', current);
    });
  }
  renderCart();
} else if (page === 'shipping' || page === 'payment') {
  const shipping = page === 'shipping';
  const choices = shipping ? ['Osobní odběr', 'Kurýr'] : ['Kartou', 'Převodem'];
  content.innerHTML = `<p class="step">${shipping ? t.shippingStep : t.paymentStep}</p><p>${shipping ? t.shippingHint : t.paymentHint}</p><div class="choices">${choices.map((choice, i) => `<button data-choice="${i}">${shipping ? shippingText(choice) : paymentText(choice)}<span>${shipping ? (i ? t.courierPrice : t.pickupPrice) : t.noPayment}</span></button>`).join('')}</div>`;
  content.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
    const current = getCart();
    if (!current.length) { go('kosik.html'); return; }
    const choice = choices[Number(button.dataset.choice)];
    write(shipping ? 'shipping' : 'payment', choice);
    ecommerce(shipping ? 'add_shipping_info' : 'add_payment_info', current, { [shipping ? 'shipping_tier' : 'payment_type']: choice });
    go(shipping ? 'platba.html' : 'shrnuti.html');
  }));
} else if (page === 'summary') {
  content.innerHTML = `<p class="step">${t.summaryStep}</p>${table(cart)}<p>${t.shipping} ${shippingText(read('shipping', 'Osobní odběr'))} · ${money(shippingCost())}</p><p>${t.payment} ${paymentText(read('payment', 'Kartou'))}</p><p class="total">${t.netTotal} ${money(roundMoney(valueOf(cart) + shippingCost()))}</p><p>${t.taxLabel} ${money(taxOf(valueOf(cart), shippingCost()))}</p><p class="total">${t.total} ${money(roundMoney(valueOf(cart) + shippingCost() + taxOf(valueOf(cart), shippingCost())))}</p><p>${t.summaryHint}</p><button id="pay">${t.pay}</button>`;
  document.getElementById('pay').addEventListener('click', event => {
    const current = getCart();
    if (!current.length) { go('kosik.html'); return; }
    event.currentTarget.disabled = true;
    const id = 'fruit-' + crypto.randomUUID();
    write('order:' + id, { transaction_id: id, items: current, shipping: shippingCost(), tax: taxOf(valueOf(current), shippingCost()) });
    go('dekujeme.html?order=' + encodeURIComponent(id));
  });
} else if (page === 'thanks') {
  const id = params.get('order');
  const order = id ? read('order:' + id, null) : null;
  if (order) {
    const tax = order.tax ?? taxOf(valueOf(order.items), order.shipping);
    if (!read('purchased:' + id, false)) {
      write('purchased:' + id, true);
      ecommerce('purchase', order.items, { transaction_id: order.transaction_id, shipping: order.shipping, tax });
      write('cart', []); count();
    }
    content.innerHTML = `<p class="empty">${t.thanksHero}</p><p>${t.thanksHint}</p><p class="order-id">${t.orderNumber} ${escape(order.transaction_id)}</p><p>${t.fruit} ${money(valueOf(order.items))} · ${t.shipping} ${money(order.shipping)} · ${t.taxLabel} ${money(tax)}</p><a class="button" href="index.html">${t.moreFruit}</a>`;
  } else content.innerHTML = `<p>${t.noOrder}</p><a class="button" href="index.html">${t.backFruit}</a>`;
} else if (page === 'lead') {
  content.innerHTML = `${contactMarkup()}<p>${t.leadHint}</p><form id="lead-form"><label for="email">${t.email}</label><input id="email" type="email" autocomplete="email" required maxlength="254"><label for="message">${t.message}</label><textarea id="message" rows="5" required maxlength="2000"></textarea><p>${t.leadPrivacy}</p><button type="submit">${t.sendLead}</button></form>`;
  let submitted = false;
  document.getElementById('lead-form').addEventListener('submit', event => {
    event.preventDefault();
    if (submitted) return;
    submitted = true;
    event.currentTarget.querySelector('button').disabled = true;
    go('poptavka-odeslano.html?sent=1');
  });
} else if (page === 'lead-thanks') {
  // generate_lead only after a confirmed submission, once: the marker is removed so a reload does not repeat it.
  const url = new URL(location.href);
  if (url.searchParams.get('sent') === '1') {
    url.searchParams.delete('sent');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    lead();
  }
  content.innerHTML = `<p class="empty">${t.leadThanksHero}</p><p>${t.leadThanksHint}</p><a class="button" href="index.html">${t.backFruit}</a>`;
}
