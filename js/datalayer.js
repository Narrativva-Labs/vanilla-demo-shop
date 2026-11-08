export function item(product, quantity = 1, origin = {}) {
  return {
    item_id: product.id, item_name: product.name, item_category: product.category,
    price: product.price, quantity,
    ...(Number.isInteger(origin.index) ? { index: origin.index } : {}),
    ...(origin.item_list_id && origin.item_list_name ? { item_list_id: origin.item_list_id, item_list_name: origin.item_list_name } : {})
  };
}
export const roundMoney = amount => Math.round((amount + Number.EPSILON) * 100) / 100;
export const valueOf = items => roundMoney(items.reduce((total, row) => total + row.price * row.quantity, 0));
export const taxOf = (value, shipping) => roundMoney((value + shipping) * 0.12);
export function ecommerce(event, items, extra = {}) {
  window.dataLayer.push({ ecommerce: null });
  const parameters = Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== '' && value !== null && value !== undefined));
  window.dataLayer.push({ event, ecommerce: { currency: 'CZK', value: valueOf(items), items, ...parameters } });
}
export function search(search_term) { window.dataLayer.push({ event: 'search', ...(search_term ? { search_term } : {}) }); }
export function lead() { window.dataLayer.push({ event: 'generate_lead', currency: 'CZK', value: 500, lead_source: 'contact_form' }); }
