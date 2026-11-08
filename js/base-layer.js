// The first two data layer records, before consent commands and GTM.
window.dataLayer.push({
  page_type: document.documentElement.dataset.pageType,
  language: document.documentElement.lang
});
window.dataLayer.push({ event: 'page_view' });
