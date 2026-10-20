# Project Progress Tracker

## Status Legend
- [x] Completed
- [/] In Progress
- [ ] Planned

---

## Phase 1: Environment & Foundation
- [x] Folder structure setup (`src/{config,controllers,middleware,models,routes,services,utils}`, `uploads/`)
- [x] `package.json` verification and dependency audit
- [x] Environment file setup (`.env.example` and `.env`)
- [x] MongoDB connection setup (`src/config/db.js`)
- [x] Standard API response wrapper (`src/utils/apiResponse.js`)
- [x] Central error handling middleware (`src/middleware/errorHandler.js`)
- [x] Express app configuration (`src/app.js`) and entry point (`src/server.js`)

## Phase 2: Media & Upload Pipelines
- [x] File upload middleware via Multer memory storage (`src/middleware/upload.js`)
- [x] Image optimization pipeline using Sharp

## Phase 3: Gemini AI Integration
- [x] Gemini client initialization (`src/config/gemini.js` with `@google/genai`)
- [x] Vision service for Math and Reasoning step-by-step solutions (`src/services/geminiService.js`)
- [x] Multilingual support handler (Hindi, English, regional)
- [x] Live Current Affairs quiz generator with Google Search tool calling

## Phase 4: Document & PDF Services
- [x] Text extraction from student PDFs (`pdf-parse`)
- [x] Word and text document extraction (`mammoth`, `word-extractor`, UTF-8)
- [x] Watermark removal & clean PDF generation service (`pdfkit` / `pdf-lib`)

## Phase 5: Routes & Controllers
- [x] Image solve controller & route (`/api/v1/solve/image`)
- [x] PDF solve controller & route (`/api/v1/solve/pdf`)
- [x] Clean PDF generation route (`/api/v1/pdf/clean-generate`)
- [x] Dynamic quiz generation & evaluation routes (`/api/v1/quiz`)
- [x] Canonical quiz evaluation contract: `POST /api/v1/quiz/evaluate`

## Phase 6: Authentication, Device Security & Universal Solver
- [x] Student registration/login with bcrypt password hashes and JWT authentication
- [x] Permanent first-login device binding and per-request device validation
- [x] Admin-only device reset endpoint (`POST /api/admin/reset-device`)
- [x] MongoDB-persisted guest limit of three successful scans per device; failed validation, uploads, or AI requests do not consume quota
- [x] Ten-scan rolling ten-minute scan rate limit counts successful scans
- [x] Universal Gemini image, text, and document solver with a strict subject response schema

---

## Change Log & Notes
- Setup: Folder structure created. `agent.md` and `progress.md` initialized with strict approval rules.
- Phase 1: Foundation files and configuration completed. Installed `sharp`, `pdf-parse`, `jsonwebtoken`, and `bcrypt`; npm strict SSL verification was restored after installation.
- Phase 2: Added validated image/PDF upload middleware and Sharp image optimization before Gemini image solving.
- Phase 3: Added schema-constrained multilingual vision solutions and structured quiz generation, with a Google Search fact-gathering step for current-affairs quizzes.
- Phase 4: Added PDF text/metadata extraction, schema-constrained PDF question solving, and fresh branded PDF generation. Optional Unicode font location planned at `assets/fonts/`; PDF generation falls back to Helvetica when no compatible font is available.
- Phase 5: Wired image/PDF solving, clean PDF download, quiz generation, and quiz evaluation controllers and routes.
- Feature extension: Added image/PDF-to-custom-PDF exports with solution and practice modes, optional target-language translation, and source-language detection when target language is omitted.
- Font asset: `assets/fonts/NotoSansDevanagari-Regular.ttf` is installed (221,084 bytes), and `node --check src/services/pdfService.js` passes. The `assets/fonts/OFL.txt` license file is still pending.
- Session wrap-up: Camera image and PDF uploads se clean PDF export `/api/v1/pdf/from-image` aur `/api/v1/pdf/from-pdf` par ready hai. `with_solution` (Solution Mode) aur `without_solution` (Practice Mode) available hain. Devanagari font asset installed hai; `cleanLatexForPdf` PDFKit output ke liye LaTeX markers ko strip/normalize karta hai. Current Gemini model: `gemini-3.8-flash`. Changed JavaScript files `node --check` se verified hain. `assets/fonts/OFL.txt` abhi pending hai.
- Feature verification: `mammoth` and `word-extractor` installed and verified with `require()`; `npm install` completed successfully using the workspace npm cache. Universal PDF/Word/text upload and bilingual English-Hindi prompt support are implemented.
- Next step: Flutter app integration aur screens wire up karna.
- Implementation note: Guest quota counts persist in MongoDB (`DeviceUsage`) across restarts. Scan rate-window timestamps remain process-local and reset on restart. Admin accounts must be provisioned with the `admin` role outside public registration. Set `JWT_SECRET` in the runtime environment.
- Edge-case fixes: Quota and rate-limit consumption now occurs only when a scan/PDF endpoint sends a successful response; malformed input, invalid/missing uploads, extraction failures, Gemini errors, and PDF generation errors do not consume a scan. Quiz evaluation is documented at `POST /api/v1/quiz/evaluate`; this is the single canonical endpoint.
