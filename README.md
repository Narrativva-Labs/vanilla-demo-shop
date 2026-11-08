# Vanilla Fruit Shop

A small, deliberately playful Czech/English demo shop by **František Bujnovský**. Plain HTML, CSS and JavaScript: no framework, build step or backend. Every navigation loads an HTML document. All links work under a GitHub Pages project path.

Use it to compare regular GA4 through GTM with a separate GA4 property measured by [Vanilla Server-Side](https://github.com/Narrativva-Labs/vanilla-server-side). Nothing is sold, charged or submitted. Lead fields never enter storage, URLs or the data layer.

## Run locally

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/>. There are no dependencies to install for the website. CookieConsent v3.1.0 CSS and UMD JavaScript load from `cdn.jsdelivr.net`; all other default assets are local. If the CDN is unavailable, the shop still works and consent stays denied.

## Languages and mobile layout

Czech uses the root pages; English uses the same filenames under `en/` (for example `en/produkt.html?id=jablko`). Both sets of thin HTML shells load the same scripts. `js/i18n.js` is the shared dictionary for page text, product display names/descriptions and cookie dialogs. Static shell text mirrors the dictionary as a fallback for disabled JavaScript. No build is required. The CZ/EN header links preserve the filename, query parameters and fragment, including list attribution and order IDs, and work under GitHub Pages project subpaths.

Cart, delivery/payment choices, orders, purchase markers and cookie consent are shared across languages. Measurement item names, IDs, categories, list names and shipping/payment values stay canonical in Czech; only the base layer carries the page language (`cs` or `en`). Search matches the current language's product names and canonical Czech names.

Up to 600 px the header uses a smaller logo, a single menu row, and an accessible Search toggle with `aria-expanded` and Escape support. The toggle uses no storage. Without JavaScript the search form remains visible. The home intro is compact so the first fruit fits in the initial Pixel 7 viewport after the cookie dialog is dismissed. Plums use a local inline SVG with a thick outline and solid colours, sized alongside the emoji fruit.

## Enable measurement

Edit `js/config.js` only:

```js
window.SHOP_CONFIG = Object.freeze({
  GTM_ID: 'GTM-EXAMPLE',
  VANILLA_SRC: 'https://your-tracker.example.com/s.js'
});
```

The live demo at https://demoshop.frantisekbujnovsky.com uses its own GTM container and its own Vanilla server, both measuring into GA4 properties used only for this demo. For your own copy, replace both values or leave them empty: an empty field loads no corresponding measurement script. URL parameters never override configuration. Never put server secrets or a Measurement Protocol API secret in this public repository.

In GTM, configure your regular Google tag and GA4 event tags for the events below. Ecommerce tags should read the `ecommerce` data layer object; search and lead tags should read their top-level parameters. Configure the four Google consent purposes appropriately for your container. The demo explicitly pushes `page_view`; trigger your GA4 page-view event from it and disable automatic Google tag page views (`send_page_view: false`) to avoid duplicates. This repository does not provision or publish a container. Vanilla reads the same data layer directly; use a **separate GA4 property** for it. Follow Vanilla's installation and cookie-banner documentation to configure the collector, including any denied-state pings.

`measurement.js` defines `gtag`, sends the four denied Consent Mode v2 defaults, then conditionally loads GTM and Vanilla. CookieConsent categories are `necessary`, `analytics`, and `ads`. A saved decision is restored from the `cc_cookie` cookie before GTM loads, so the first hit on every page already carries it; the banner then handles new decisions (`onConsent`) and changes (`onChange`). Analytics controls `analytics_storage`; ads controls `ad_storage`, `ad_user_data`, and `ad_personalization`. The footer reopens preferences. Ecommerce events are still pushed to the data layer while consent is denied; the configured trackers enforce consent.

## Pages and events

| Page | Events |
| --- | --- |
| Every page, including English | `{ page_type, language }` without an event, then `{ event: "page_view" }`, before consent commands and GTM |
| `index.html` | `view_item_list` (`home`, `Domovská stránka`), `select_item` on product selection |
| `produkt.html?id=jablko` | `view_item`, `add_to_cart` (one unit per click) |
| `hledat.html?q=banán` | `search` with `search_term`, `view_item_list` (`search`, `Výsledky hledání`), `select_item` |
| `kosik.html` | `view_cart`, `remove_from_cart` (whole row), `begin_checkout` |
| `doprava.html` | `add_shipping_info` with `shipping_tier` on selection |
| `platba.html` | `add_payment_info` with `payment_type` on selection |
| `shrnuti.html` | Creates a UUID order on the Pay button, then navigates; no purchase yet |
| `dekujeme.html?order=…` | `purchase` once per transaction, then clears the cart |
| `poptavka.html` | `generate_lead` once after valid local submission (`currency: "CZK"`, `value: 500`, `lead_source: "contact_form"`), then navigates |
| `poptavka-odeslano.html` | Confirmation only; no repeat lead event |

`js/base-layer.js` sends the first two records synchronously in the head, before GTM: the base layer without an event and `page_view`. Page types are `homepage`, `product`, `category` (search), `cart`, `checkout` (delivery/payment/summary), `confirmation` (order and enquiry confirmation), and `contact` (enquiry form). Page ecommerce events follow, then events triggered by user actions.

Every ecommerce event is immediately preceded by `{ ecommerce: null }`. `js/datalayer.js` constructs all events and item records. Catalogue prices and all ecommerce amounts are **exclusive of VAT**, expressed as numbers with at most two decimal places. `value` is the sum of item price × quantity in CZK, **excluding shipping and tax**; `purchase.shipping` is separate (pickup 0 Kč, courier 99 Kč net). `purchase.tax` is 12% of `value + shipping`, rounded to two decimal places. The summary shows fruit, delivery, net total, VAT and the final total. For one banana delivered by courier: value 22, shipping 99, tax 14.52, total 135.52. Items include product ID, name, category, integer unit price and quantity. List IDs, names and zero-based indices follow the item from list links through detail and cart to purchase. Repeated adds merge the quantity and retain the first cart row's list attribution. Direct detail visits have no invented list attribution. Search also emits an empty item list when nothing matches. Empty optional string/null/undefined values are omitted; empty item arrays remain valid for empty lists and carts.

The cart, delivery/payment choice, order snapshots and per-transaction purchase markers use namespaced localStorage. Every access is guarded. When localStorage is blocked, `window.name` provides a same-tab fallback across same-origin full page loads. This fallback cannot share state across independent tabs and is not durable after the tab closes. With all browser persistence blocked, cross-document persistence and permanent deduplication cannot be guaranteed. No personal data enters either fallback. Purchase markers are written before the event; the demo does not retry delivery to any tracker. Orders remain stored so reloads and history visits can show a confirmation without another purchase. Empty checkout pages emit only their base layer and page view, then redirect to the cart without checkout ecommerce events. History restores reload the page to refresh cart state.

A real shop keeps the purchase-sent flag on the server alongside the order.

The demo sends no `user_data` because it does not collect real personal data.

## Browser check

Start the local server first. Use an already installed Playwright package with Chromium available:

```sh
node scripts/check.mjs
```

The default module is `playwright` from `node_modules`. To use an existing absolute package path:

```sh
PLAYWRIGHT_PATH="/path/to/node_modules/playwright" node scripts/check.mjs
```

Optional: `BASE_URL=http://127.0.0.1:8765/` (include a trailing slash; project subpaths work). The check serves an empty measurement configuration itself, so GTM and Vanilla stay off during the run. The script uses `createRequire` and installs nothing. It runs Czech desktop, Pixel 7, 360 px and blocked-localStorage scenarios, English desktop/Pixel 7 scenarios, and language-switch scenarios on desktop, Pixel 7 and with blocked localStorage with real link/button clicks, middle-click new tab, history back and reload. It checks base/page-view records as the first two entries, the exact event sequence, canonical names across languages, shared cart state and preserved parameters on a language switch, purchase tax/shipping, lead value/source, first-screen fruit on Pixel 7, the mobile menu and search toggle (including a separate no-JavaScript check in both languages), ecommerce resets and values, source-list attribution, consent refusal/acceptance, purchase deduplication, empty checkout redirects, search and empty results, lead privacy, no horizontal overflow, and no requests outside the local origin and jsDelivr. It asserts that every request is GET and reports unexpected destinations as failures.

Full data layers per step, request logs and screenshots are written to the ignored `output/playwright/` directory after a successful run. This checks the demo data layer and default network isolation, not delivery into live GA4 properties.

### Verification in the authoring environment

The browser check was attempted, but the execution sandbox blocked the local server socket (`Operation not permitted`) and Chromium's launch (`MachPortRendezvousServer: Permission denied`). Therefore no desktop/Pixel browser pass or visual rendering check is claimed. JavaScript syntax, shell links/language metadata and separate in-process event/storage checks passed for Czech, English and a language switch, each with normal and blocked localStorage. These checks cover base/page-view ordering, canonical items, shared cart, purchase VAT/shipping, deduplication and lead source; they do not verify browser layout. The existing server at 127.0.0.1:8765 was also unreachable from this sandbox during the second round. Run the browser command above in an environment that permits local listening sockets and browser processes before relying on the demo for measurement comparisons.

## License

MIT. Copyright (c) 2026 František Bujnovský.
