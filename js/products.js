import { messages } from './i18n.js';

const plum = '<svg class="plum" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false"><path d="M61 38C58 24 64 13 74 8" stroke="#111" stroke-width="7" stroke-linecap="square"/><path d="M64 27C72 9 93 12 104 18C96 35 77 39 64 27Z" fill="#b6ef16" stroke="#111" stroke-width="6" stroke-linejoin="miter"/><path d="M61 38C35 23 13 44 16 72C18 98 40 115 61 109C82 115 104 98 106 72C109 44 87 23 61 38Z" fill="#873cce" stroke="#111" stroke-width="7"/><path d="M63 39C51 55 51 86 61 106" stroke="#111" stroke-width="5"/><path d="M34 48L28 62" stroke="#e6b6ff" stroke-width="7" stroke-linecap="square"/></svg>';

// Names and categories are canonical measurement values in every language.
export const products = [
  { id: 'jablko', category: 'Domácí', price: 19, emoji: '🍎' },
  { id: 'hruska', category: 'Domácí', price: 25, emoji: '🍐' },
  { id: 'svestky', category: 'Domácí', price: 39, image: plum },
  { id: 'mandarinka', category: 'Exotické', price: 15, emoji: '🍊' },
  { id: 'banan', category: 'Exotické', price: 22, emoji: '🍌' },
  { id: 'hrozny', category: 'Exotické', price: 59, emoji: '🍇' }
].map(product => ({ ...product, ...messages.cs.products[product.id] }));
