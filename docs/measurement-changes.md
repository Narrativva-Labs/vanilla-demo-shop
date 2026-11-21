# Measurement changes

Changes to the demo's GTM container (GTM-W4FBF2CV) and anything else that changes the data collected. Use this log to explain breaks in reports. Older versions are listed in GTM under **Versions**; each entry below matches a published version name.

| Date (CET) | GTM version | Change | Effect on data |
|---|---|---|---|
| 2026-11-21 | 20 "VV page_view s třídou (readiness 1.0.1)" | `GA4 - page_view` fires on the first Visitor Verdict `traffic_class` initial publication or after a 1 s timer, Once per page (previously on the `page_view` data-layer event, which is pushed before GTM loads). | `page_view` carries `traffic_class`, including for visitors who leave quickly. It is sent about 0.5–1 s later and can arrive after `view_item_list`. If the timer fires first, `page_view` may have no class. Rollback: trigger `event - page_view`, Once per event. |
| 2026-11-20 | 19 "VV 1.0.1 – traffic_class hned v initial fázi + traffic_phase" | `GA4 - traffic_class` also fires on the initial phase for `automated` and `declared_agent`; new parameter `traffic_phase`; explicit Once per event. | Hard classes appear in GA4 for shorter visits. A page can send two `traffic_class` events (initial and final). Count sessions with any matching hit, not events. Before this version `traffic_phase` was empty. |
