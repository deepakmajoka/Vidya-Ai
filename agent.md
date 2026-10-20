# Project: Vidya AI - Student Solver & Exam Prep Backend

## Architecture & Overview
Multilingual educational backend service for a Flutter mobile client. The application solves math and reasoning questions from camera photos or uploaded PDFs, strips watermarks via OCR re-generation, provides step-by-step multilingual explanations, and generates dynamic daily quizzes (including live Current Affairs via Gemini Search Grounding).

## Tech Stack
- **Runtime & Framework:** Node.js (v20+ LTS), Express.js
- **Database:** MongoDB (Mongoose ODM)
- **AI Engine:** Google Gemini API (`@google/genai`) using `gemini-2.5-flash`
- **File & Media Handling:** Multer (memory storage), Sharp (image optimization)
- **Document & PDF Processing:** PDF-lib, PDFKit, pdf-parse
- **Authentication:** JWT with bcrypt password hashing

---

## ⚠️ STRICT OPERATING RULES FOR CODEX / AI ASSISTANT

1. **NO DIRECT FILE MODIFICATIONS WITHOUT APPROVAL:**
   - DO NOT automatically edit, overwrite, or delete any code files.
   - Before modifying or creating any file, you must first explain:
     * Which file you plan to touch.
     * Why this change is needed (bug fix, missing logic, new feature).
     * The exact code/diff you propose.
   - Wait for explicit user confirmation ("Yes" / "Proceed") before making the change.

2. **AUDIT FIRST, THEN PROCEED:**
   - Review all existing files in the project.
   - Check for syntax errors, missing exports/imports, package version mismatches, and environment variable issues.
   - Report findings clearly without applying auto-fixes immediately.

3. **PROGRESS TRACKING:**
   - Always check and sync with `progress.md` before starting any task to prevent redundant or duplicate code.

---

## Current Status (Already Implemented)
- [x] Project initialized in directory `D:\vidya-ai-backend`.
- [x] Folder structure created:
  - `uploads/`
  - `src/config/`, `src/controllers/`, `src/middleware/`, `src/models/`, `src/routes/`, `src/services/`, `src/utils/`
- [x] Base packages planned/installed: `express`, `dotenv`, `cors`, `helmet`, `mongoose`, `multer`, `@google/genai`, `pdfkit`, `pdf-lib`.

---

## Key Features & Target Endpoints
1. `POST /api/v1/solve/image`: Accepts an image file (Math/Reasoning). Optimizes image via Sharp, sends to Gemini Vision with structured JSON output, returns step-by-step solution in the user's selected language.
2. `POST /api/v1/solve/pdf`: Parses student PDF question papers, extracts problems, and provides solutions.
3. `POST /api/v1/pdf/clean-generate`: Extracts text/formulas from watermarked documents and renders a fresh, clean, branded PDF without original watermarks.
4. `POST /api/v1/quiz/generate`: Generates randomized MCQs for Math, Reasoning, or Current Affairs (with Google Search Grounding tool enabled).
5. `POST /api/v1/quiz/evaluate`: Canonical endpoint for evaluating student scores and tracking progress.

---

## Coding Guidelines
- Follow strict MVC/modular service-controller structure (`/controllers`, `/services`, `/models`, `/routes`, `/utils`).
- Always validate incoming files (file type, size limits) before hitting external APIs.
- Keep Gemini prompts strictly formatted with JSON schemas (`responseSchema` / `responseMimeType: "application/json"`) to eliminate parsing errors.
- Never hardcode API keys or secrets; load via `process.env`.
- Log errors gracefully using clean error-handling middleware (`src/middleware/errorHandler.js`).
