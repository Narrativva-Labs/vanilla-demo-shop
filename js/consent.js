import { language, messages, t } from './i18n.js';

const cc = window.CookieConsent;
if (!cc) {
  document.getElementById('consent-status').textContent = t.consentUnavailable;
} else {
  const update = () => {
    const analytics = cc.acceptedCategory('analytics') ? 'granted' : 'denied';
    const ads = cc.acceptedCategory('ads') ? 'granted' : 'denied';
    window.gtag('consent', 'update', { analytics_storage: analytics, ad_storage: ads, ad_user_data: ads, ad_personalization: ads });
  };
  cc.run({
    hideFromBots: false,
    onConsent: update, onChange: update,
    categories: { necessary: { enabled: true, readOnly: true }, analytics: {}, ads: {} },
    language: {
      default: language,
      translations: { cs: messages.cs.cookies, en: messages.en.cookies }
    }
  });
}
