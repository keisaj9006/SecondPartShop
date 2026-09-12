# Deferred manual marketplace RC checks

Run in one scheduled RC batch on a documented commit/deployment. Automated and Preview browser checks must already pass. Record device/OS/network, expected and actual behavior, issue IDs and safe evidence. Never record passwords, payment details or tokens.

- [ ] Android installation/signature/package/app links and supported hosted frontend.
- [ ] Login, email confirmation/recovery and session expiry on device.
- [ ] Home/Garage new vehicle, removal, same-model engine switch, Back/Forward.
- [ ] Search, filter, sort, next page, product and return to exact results.
- [ ] Zero-results Find My Part including sign-in interruption.
- [ ] Seller mode plus purchases; own-listing purchase prohibited.
- [ ] Camera/photo picker, low-memory compression, interrupted upload, validation retry.
- [ ] Photo security provider batch: two independent DB sessions, authenticated Storage mutation rejection, controlled Storage outage/retry and disposable identity deletion. See the photo cleanup runbook; no automatic Vercel Preview cron is assumed.
- [ ] Long inventory/CSV review on phone and desktop; no duplicate publication.
- [ ] Keyboard/screen reader/focus, 200% zoom, contrast and reduced motion.
- [ ] Narrow/landscape layouts, safe areas, touch targets and hardware Back.
- [ ] Slow/offline/reconnected navigation and recovery without lost input.
- [ ] Existing commerce runbook B–H as separately configured provider batch; no Live money.
- [ ] Notifications foreground/background/cold-start and real FCM routing.
- [ ] Actual seller dispatch/support/returns process and buyer fit outcome; no synthetic Verified Fit.
- [ ] Final legal/support/contact/store declarations and production release evidence.

Current status: deferred; not PASS. Physical checks are grouped near RC, not requested after each coding batch.
