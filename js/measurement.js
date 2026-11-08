window.gtag = function () { window.dataLayer.push(arguments); };
window.gtag('consent', 'default', {
  ad_storage: 'denied', analytics_storage: 'denied',
  ad_user_data: 'denied', ad_personalization: 'denied'
});
// Restore a stored choice before any tag runs, so the first hit of every page already has the right consent.
// The banner script loads later and keeps handling new choices and changes.
(() => {
  try {
    const raw = document.cookie.split('; ').find(c => c.startsWith('cc_cookie='));
    if (!raw) return;
    const categories = JSON.parse(decodeURIComponent(raw.slice('cc_cookie='.length))).categories || [];
    const analytics = categories.includes('analytics') ? 'granted' : 'denied';
    const ads = categories.includes('ads') ? 'granted' : 'denied';
    window.gtag('consent', 'update', { analytics_storage: analytics, ad_storage: ads, ad_user_data: ads, ad_personalization: ads });
  } catch { /* An unreadable cookie leaves everything denied until the banner decides. */ }
})();
(() => {
  const { GTM_ID, VANILLA_SRC } = window.SHOP_CONFIG;
  if (GTM_ID) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    document.head.append(script);
  }
  if (VANILLA_SRC) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = VANILLA_SRC;
    document.head.append(script);
  }
})();
