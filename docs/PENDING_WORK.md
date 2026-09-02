# Kissan Rehnuma — Pending Work & Roadmap

> **Complete review of all services, frontend, infrastructure, and gaps.**
> Tasks are prioritised: 🔴 Critical → 🟡 Medium → 🟢 Low.
> Mark `[x]` when done.

---

## 🔴 Critical — App Incomplete

| # | Area | What's Missing | Status |
|---|------|---------------|--------|
| 1 | **voice-helpline-service** | Completely empty — only directory skeleton exists. No `main.py`, no endpoints, no agents, no code at all | 🔲 |
| 2 | **Gateway → Helpline route** | No `helpline.py` route file in gateway. Config + circuit breaker exist but no proxy routes | 🔲 |
| 3 | **MarketRatesScreen ↔ API** | ~~Static/hardcoded UI~~ ✅ **DONE** — fetches real data from `GET /api/v1/rates`, search, category filters | ✅ |
| 4 | **HomeDashboard ↔ API** | Static UI — no API calls. Weather card, greeting, etc. are all hardcoded. Should fetch real data | 🔲 |
| 5 | **HelplineScreen ↔ API** | Static UI — no API calls to any helpline backend. Just hardcoded FAQ and phone numbers | 🔲 |
| 6 | **Refresh Token Flow** | No refresh tokens. Access token expires in 24h → user must re-login. Need refresh token mechanism | 🔲 |
| 7 | **Git push** | Repository URL `github.com/muzaffar401/Kissan_Rehnuma` not found — needs correct remote URL | 🔲 |

---

## 🟡 Medium — Infrastructure & Gaps

| # | Area | What's Missing | Status |
|---|------|---------------|--------|
| 8 | **Docker Compose** | No `docker-compose.yml` exists. Can't spin up all 6 services + gateway + DB with one command | 🔲 |
| 9 | **Dockerfiles missing** | Only 3 services have Dockerfiles (crop, animal, voice-agent). Missing: user-auth, weather-alert, market-rate | 🔲 |
| 10 | **Automated Tests** | Zero test files across all services. `tests/` directories are empty. No unit tests, no integration tests | 🔲 |
| 11 | **CI/CD Pipeline** | `infra/ci-cd/github-actions/` is empty (`.gitkeep` only). No GitHub Actions workflows | 🔲 |
| 12 | **K8s manifests** | `infra/k8s/base/` has only 1 file, overlays are empty. Not production-deployable | 🔲 |
| 13 | **Push Notifications** | Weather service has `push.py` and `device_token` model but FCM/APNs keys not configured, no actual push delivery tested | 🔲 |
| 14 | **Market Rate Data Ingestion** | ~~Needs real API keys/scraper config~~ ✅ **DONE** — AMIS + IRFarm scrapers working, 112 records from 4 cities, 56 crops | ✅ |
| 15 | **Email Service** | `core/email.py` exists in auth service but SMTP credentials not configured for production | 🔲 |
| 16 | **Production URL** | `config.ts` has `https://api.kissanrehnuma.com` as TODO placeholder | 🔲 |

---

## 🟢 Low — Scale & Polish

| # | Area | What's Missing | Status |
|---|------|---------------|--------|
| 17 | **Profile Screen** | No dedicated profile/edit profile screen. Settings is static | 🔲 |
| 18 | **Offline Mode** | No offline data sync. If network drops, app shows error | 🔲 |
| 19 | **i18n / Urdu Localization** | Language selection exists but actual Urdu translations not implemented — all strings are English | 🔲 |
| 20 | **Image Storage** | `cloud_storage.py` exists in crop/animal services but no S3/GCS bucket configured | 🔲 |
| 21 | **Rate Limiting Tuning** | Gateway has rate limits but no per-user rate limiting (only global per-IP) | 🔲 |
| 22 | **Logging / Monitoring** | Structured logging exists but no log aggregation (ELK/Datadog), no alerting, no Prometheus metrics | 🔲 |
| 23 | **API Documentation** | No Swagger/OpenAPI spec published. FastAPI auto-docs exist but not accessible in production (`docs_url=None` when `debug=False`) | 🔲 |
| 24 | **Database Backups** | No backup scripts, no cron jobs for PostgreSQL dumps | 🔲 |
| 25 | **Shared Lib** | `shared/shared_lib/` has auth, logging, exceptions, observability — but most services don't import it yet | 🔲 |

---

## Market Rate Service — Detailed Sub-Tasks

> These are sub-items under the market-rate-service that can be tackled incrementally.

### ✅ Done
- [x] AMIS Punjab scraper rewritten — `ViewPrices.aspx` for all commodities with Min/Max/FQP
- [x] **Multi-city support** — scraper fetches from all 36 district markets (city IDs mapped)
- [x] **IRFarm scraper** — second data source added, 4 cities (Lahore, Karachi, Multan, Islamabad), 41 crops
- [x] Crop synonyms expanded — 7 → 160+ mappings (Punjabi/Urdu/English → standard names)
- [x] DB migration — `min_price`, `max_price`, `fqp_price` columns added
- [x] 36 Punjab mandis seeded in database
- [x] `GET /api/v1/rates` endpoint — all latest rates with `?q=` search
- [x] Frontend MarketRatesScreen — real API data, search, category filters, loading/error states
- [x] Gateway proxy route for `/market/rates`
- [x] Unit conversion — AMIS Rs/100kg (quintal) → PKR/kg
- [x] APScheduler daily cron at 7am for automated ingestion
- [x] **Duplicate prevention** — `create()` updates existing records instead of creating duplicates
- [x] **Duplicate cleanup** — removed 47 duplicate records from DB

### 🔲 Remaining
- [ ] Unique constraint on `(mandi_id, crop_id, recorded_date)` — prevent duplicates at DB level
- [ ] Data validation — reject prices outside reasonable range
- [ ] Historical price chart on frontend (line chart per crop)
- [ ] Per-mandi price comparison — same crop across different mandis
- [ ] Multiple data sources — Zarai Mandi, manual entry, PARC (IRFarm ✅ done, AMIS ✅ done)
- [ ] Price alerts — farmer sets target price, notification when reached
- [ ] Price forecasting — ARIMA/Prophet for next 7/30 day prediction
- [ ] "Best time to sell" advisory — based on trend analysis
- [ ] Arrival quantity tracking — AMIS provides arrival data

---

## Summary

| Status | Count |
|--------|-------|
| 🔴 Critical | **5** remaining (2 done) |
| 🟡 Medium | **7** remaining (2 done) |
| 🟢 Low | **9** remaining |
| **Total pending** | **21 items** |
| **Total completed** | **4 items** |

---

## Suggested Execution Order

1. **HomeDashboard ↔ API** — connect weather card + greeting to real data (backend ready)
2. **voice-helpline-service** — write core service code or integrate voice-agent-service
3. **Gateway → Helpline route** — add proxy routes once service exists
4. **Refresh Token Flow** — seamless UX without 24h re-login
5. **Docker Compose** — one command to start entire stack
6. **Git push** — fix remote URL and push all committed work
7. **Tests + CI/CD** — unit tests, integration tests, GitHub Actions
8. **Remaining market features** — multi-city, charts, comparison
9. **Polish** — profile screen, i18n, offline mode, monitoring

---

*Last updated: September 3, 2026*
