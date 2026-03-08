# Changelog

## [New Feature] - ATS Scoring System - 2024

### 🎯 Major Feature Addition

#### ATS Score Analysis
- **Comprehensive Scoring System** - 100-point scale across 5 categories
- **Detailed Issue Reporting** - CareerSet-style issue cards with severity levels
- **Keyword Analysis** - Track matched and missing keywords from job descriptions
- **Actionable Recommendations** - Prioritized tips with implementation guidance
- **Interactive UI** - Expandable issue cards and recommendation panels
- **Real-time Analysis** - 10-15 second scoring using OpenRouter API

#### Scoring Categories
1. **Keyword Match (30 points)** - Primary, secondary, and industry keywords
2. **Formatting & ATS Compatibility (20 points)** - Structure, headers, dates
3. **Content Quality (25 points)** - Quantification, action verbs, relevance
4. **Professional Summary (10 points)** - Experience, skills, achievements
5. **Experience Section (15 points)** - STAR method, metrics, relevance

#### New Components
- `components/ats-score-panel.tsx` - Main ATS scoring display panel
- `lib/ats-scoring-context.ts` - Comprehensive scoring prompt system
- `lib/ats-types.ts` - TypeScript interfaces for ATS data
- `app/api/ats-score/route.ts` - API endpoint for scoring

#### UI Enhancements
- **Dual Mode Interface** - Toggle between "LaTeX Generator" and "ATS Score"
- **Tab Navigation** - Overview, Issues, Keywords, Recommendations
- **Color-Coded Severity** - Critical (red), High (orange), Medium (yellow), Low (blue)
- **Expandable Cards** - Click to see detailed fixes and examples
- **Progress Indicators** - Visual score bars and percentages

#### Documentation
- `ATS_SCORING_GUIDE.md` - Complete feature documentation
- Updated README with ATS scoring information
- API documentation for `/api/ats-score` endpoint

### Technical Implementation

- Uses OpenRouter API with JSON response format
- Temperature: 0.3 for consistent scoring
- Max tokens: 4000 for detailed analysis
- Comprehensive prompt based on ATS Cheatsheet
- Severity-based issue categorization
- Priority-based recommendations

### User Benefits

✅ Understand why resumes get rejected by ATS
✅ Get specific, actionable feedback
✅ See exactly which keywords are missing
✅ Learn how to fix each issue with examples
✅ Track improvements with re-scoring
✅ Optimize for specific job descriptions

---

## [Fixed] - 2024

### Critical Fixes

#### 🔴 API Consistency
- **Removed Puter SDK dependency** - App was using Puter SDK but documentation mentioned OpenRouter
- **Unified on OpenRouter API** - All AI calls now go through `/api/generate-resume` endpoint
- **Fixed prompt engineering** - Now properly uses `buildSystemPrompt()` and `buildUserPrompt()` from `lib/llm-context.ts`
- **Applied comprehensive LLM instructions** - Action verbs, LaTeX rules, and ATS optimization now properly utilized

#### 🔴 Environment Configuration
- **Created `.env.example`** - Template for required environment variables
- **Added proper API key validation** - Clear error messages when key is missing
- **Added model configuration** - Support for `OPENROUTER_MODEL` environment variable
- **Added app URL configuration** - Support for `NEXT_PUBLIC_APP_URL` in production

### Code Quality Improvements

#### 🟡 Removed Dead Code
- Deleted `components/resume-preview-panel-old.tsx`
- Removed unused Puter SDK code from `app/page.tsx`
- Removed unused helper functions (`extractText`, `getPuter`)

#### 🟡 Cleaned Dependencies
- Removed `@heyputer/puter.js` (unused)
- Removed `vue-router` (wrong framework)
- Kept only necessary dependencies

#### 🟡 Added TypeScript Types
- Created `lib/types.ts` with API response interfaces
- Added `GenerateResumeResponse` type
- Added `LatexToPdfResponse` type
- Added `OpenRouterError` type

### Feature Additions

#### 🟢 User Experience
- **Clear All button** - Reset all input fields at once
- **Better error messages** - User-friendly error display at top of page
- **File size validation** - 10MB limit with clear error messages
- **Max content validation** - 100KB LaTeX limit to prevent timeouts

#### 🟢 Performance
- **Extracted magic numbers to constants** - `AUTO_COMPILE_DELAY`, `MAX_FILE_SIZE`, `MAX_LATEX_LENGTH`
- **Added runtime configuration** - `maxDuration` for API routes
- **Better error handling** - Proper try-catch with specific error messages

### Documentation Updates

#### 📝 README.md
- Updated setup instructions with correct API key link
- Fixed data flow diagram to match actual implementation
- Updated troubleshooting with correct API key format

#### 📝 New Files
- **SETUP.md** - Quick setup guide with step-by-step instructions
- **CHANGELOG.md** - This file, documenting all changes
- **.env.example** - Template for environment variables

### API Improvements

#### `/api/generate-resume`
- Now uses proper system and user prompts from `lib/llm-context.ts`
- Added code fence stripping for LaTeX output
- Added proper error handling with OpenRouter API
- Added API key validation
- Added model configuration support
- Increased `maxDuration` to 60 seconds

#### `/api/latex-to-pdf`
- Added runtime configuration
- Added `maxDuration` of 30 seconds
- Added TypeScript types
- Improved error messages

### Breaking Changes

None - all changes are backward compatible if you set up `.env.local` correctly.

### Migration Guide

If you were using the old version:

1. **Remove Puter SDK** (if you had it configured)
   ```bash
   pnpm remove @heyputer/puter.js
   ```

2. **Create `.env.local`**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your OpenRouter API key
   ```

3. **Reinstall dependencies**
   ```bash
   pnpm install
   ```

4. **Restart dev server**
   ```bash
   pnpm dev
   ```

### Testing Checklist

- [x] API key validation works
- [x] Example data loads correctly
- [x] Resume generation uses proper prompts
- [x] File upload with size validation
- [x] PDF preview compiles correctly
- [x] LaTeX download works
- [x] PDF download works
- [x] Clear all functionality
- [x] Error messages display properly
- [x] TypeScript compiles without errors

### Known Issues

None currently. If you find any, please open an issue on GitHub.

### Future Improvements

See README.md "Roadmap" section for planned features.
