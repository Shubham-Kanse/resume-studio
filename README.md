# 📄 AI Resume Generator

> **Transform your resume in seconds. Land your dream job with AI-powered, ATS-optimized resumes tailored to any job description.**

## 👤 What Can You Do With This App?

### The Problem It Solves

Applying for jobs is tedious. You have one resume, but each job is different. Hiring managers use automated systems (ATS) that filter resumes before humans even see them. Your perfectly good resume might get rejected by a machine because it doesn't have the right keywords from the job description.

### What This App Does For You

1. **Upload Your Resume** (in any format)
   - Have a PDF resume? Upload it.
   - Got a Word document? Upload it.
   - Just want to paste text? Paste it.
   - The app extracts everything automatically.

2. **Paste a Job Description**
   - Find a job you love
   - Copy-paste the job description
   - The AI reads it to understand what they're looking for

3. **Get an Optimized Resume in Seconds**
   - The AI analyzes both documents
   - It rewrites your resume to highlight relevant skills and experiences
   - It uses powerful action verbs and keywords from the job posting
   - It formats everything as an ATS-friendly PDF
   - Everything stays professional and honest—just tailored

4. **Preview & Download**
   - See your new resume instantly in the preview pane
   - Download as PDF and send immediately
   - No waiting, no fuss

### Real-World Example

**Your situation:** You apply for 3 different jobs (marketing, product, engineering)

- **Marketing Role**: Your resume emphasizes campaign management and analytics
- **Product Role**: Your resume highlights cross-functional collaboration and feature ownership
- **Engineering Role**: Your resume showcases technical skills and system architecture

**Time saved**: Instead of manually rewriting your resume 3 times (30+ minutes), this app does it in 10 seconds per job.

### Why This Matters

- ✅ **Get Past ATS Filters**: Resumes optimized specifically for each job's keywords
- ✅ **Save Hours**: Stop manual resume tweaking before each application
- ✅ **Competitive Edge**: Hiring managers see your most relevant experience first
- ✅ **Professional Quality**: AI ensures proper formatting and language
- ✅ **Guest Mode**: Use the app without creating an account
- ✅ **Optional Cloud History**: Sign in with Google to save resumes and ATS score snapshots

---

## 🛠️ Technical Overview

An intelligent, modern web application that uses AI to generate ATS-optimized resumes tailored to specific job descriptions. The application takes your current resume and a target job description, then leverages Claude/Deepseek AI to create a professional LaTeX resume optimized for Applicant Tracking Systems (ATS).

### Core Features

- **AI-Powered Resume Generation**: Uses advanced LLMs (Claude/Deepseek) to transform your resume to match job requirements
- **ATS Score Analysis**: Comprehensive resume scoring against job descriptions with detailed feedback
- **ATS-Optimized Output**: Generates resumes that pass Applicant Tracking System filters
- **Multi-Format Support**: Upload resumes in PDF, DOCX, or paste text directly
- **Live PDF Preview**: Real-time preview of your generated resume in PDF format
- **Beautiful UI**: Modern, responsive interface with a live WebGL shader background
- **Optional Google Auth**: Supabase-powered sign-in for cross-session history
- **LaTeX-Based**: Professional, compilable LaTeX output for maximum formatting control
- **Action Verb Suggestions**: Integrated database of powerful action verbs organized by skill category
- **Extended Instructions**: Add custom requirements or preferences for resume generation
- **Detailed Issue Analysis**: CareerSet-style issue reporting with severity levels and fixes
- **Keyword Analysis**: Track matched and missing keywords from job descriptions
- **Accessibility**: Built with Radix UI components for full accessibility support

## � Quick Start (For Users)

### Step 1: Open the app

Go to [http://localhost:3000](http://localhost:3000) (or the deployed URL)

### Step 2: Upload or paste your resume

- Drag & drop a PDF/DOCX file, or
- Paste your resume text directly

### Step 3: Paste the job description

Copy-paste the job posting you're applying for

### Step 4: (Optional) Add custom notes

Want to emphasize certain skills? Have specific keywords to include? Add them here.

### Step 5: Generate

Click "Generate Resume" and wait 5-10 seconds

### Step 6: Download

Your new resume appears in the preview pane. Download and apply!

### Step 7: Check ATS Score (Optional)

1. Click "ATS Score" button at the top
2. Click "Get ATS Score"
3. Review your score and recommendations
4. Make improvements based on feedback

---

## 🛠️ Technical Deep Dive

### Architecture Overview

This is a full-stack Next.js application with the following architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Interface (React)                       │
│  - Resume Input Panel | PDF Preview Pane | WebGL Shader        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                   Next.js API Routes                            │
│                                                                  │
│  /api/generate-resume  →  AI Resume Generation                  │
│  /api/latex-to-pdf     →  LaTeX → PDF Conversion               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│              External Services & Libraries                       │
│                                                                  │
│  OpenRouter API (Claude/Deepseek)  →  LLM Processing           │
│  pdfjs-dist                         →  PDF Text Extraction     │
│  mammoth                            →  Word Doc Extraction      │
│  wkhtmltopdf                        →  LaTeX to PDF Conversion  │
└──────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer             | Technology             | Purpose                                     |
| ----------------- | ---------------------- | ------------------------------------------- |
| **Frontend**      | React 19 + Next.js 14  | UI framework with server/client components  |
| **Language**      | TypeScript             | Type-safe development                       |
| **Styling**       | Tailwind CSS + Emotion | Utility-first CSS and emotion-based styling |
| **UI Components** | Radix UI               | Unstyled, accessible component primitives   |
| **Form**          | React Hook Form + Zod  | Form state & validation                     |
| **PDF Input**     | pdfjs-dist             | Extract text from PDF files                 |
| **Word Input**    | mammoth                | Extract text from .docx files               |
| **AI Provider**   | OpenRouter API         | Access to Claude, Deepseek, and other LLMs  |
| **LaTeX→PDF**     | wkhtmltopdf            | Convert LaTeX documents to PDF              |
| **Animations**    | Framer Motion          | Smooth UI animations                        |
| **Icons**         | Lucide React           | Consistent icon library                     |
| **Package Mgmt**  | pnpm                   | Fast, efficient package management          |

### Data Flow

```
User Input (Resume + Job Description)
    ↓
[Client-side extraction]
- PDF → Text (pdfjs-dist)
- DOCX → Text (mammoth)
    ↓
[API: /api/generate-resume]
- Build system prompt with LLM context
- Build user prompt with JD + resume
- Send to OpenRouter (Claude/Deepseek)
    ↓
[LLM Processing]
- Analyze resume and job description
- Apply ATS optimization rules
- Generate LaTeX using formatting rules
    ↓
[API: /api/latex-to-pdf]
- Convert LaTeX to PDF via latex.ytotech.com
- Return PDF for preview
    ↓
[Client Display]
- Show PDF in preview pane
- Allow download and editing
```

---

````

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- pnpm package manager
- OpenRouter API key (for AI resume generation)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
````

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:
   Create a `.env.local` file in the root directory:

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
POLAR_ACCESS_TOKEN=polar_oat_your_access_token_here
POLAR_WEBHOOK_SECRET=whsec_your_webhook_secret_here
POLAR_PRO_PRODUCT_ID=your_polar_pro_product_id_here
POLAR_SERVER=sandbox
```

Get your API key at [https://openrouter.ai/keys](https://openrouter.ai/keys)

If you want saved history:

1. Create a free Supabase project
2. Enable Google auth in Supabase
3. Add `http://localhost:3000` and your deployed URL to the Supabase redirect allow list
4. Add `SUPABASE_SERVICE_ROLE_KEY` to your environment
5. Apply the SQL migrations in `supabase/migrations/` in timestamp order
6. Add a Polar webhook endpoint pointing to `/api/webhooks/polar`

7. Start the development server:

```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build & Deploy

Development:

```bash
pnpm dev
```

Production build:

```bash
pnpm build
```

Start production server:

```bash
pnpm start
```

Lint code:

```bash
pnpm lint
```

## � For Developers: Setup & Development

### Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **pnpm** package manager (install with `npm install -g pnpm`)
- **OpenRouter API key** (get one at [openrouter.ai](https://openrouter.ai/keys))

### Local Development Setup

1. **Clone and navigate to project**

```bash
git clone <repository-url>
cd <repository-name>
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Configure environment variables**
   Create `.env.local` in the root directory:

```bash
# Required for AI resume generation
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: Override default model (defaults to deepseek/deepseek-chat)
# OPENROUTER_MODEL=anthropic/claude-3-5-sonnet

# Optional: Set app URL for production
# NEXT_PUBLIC_APP_URL=https://your-domain.com
```

4. **Start development server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser

5. **Check it's working**

- You should see the animated WebGL shader background
- Paste a job description and upload a resume file
- Try generating a resume to verify API connection

### build for Production

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

### Development Notes

- **Hot Reload**: Changes to `.tsx`, `.ts`, and `.css` files auto-refresh
- **API Routes**: Modify anything in `app/api/` and restart the dev server
- **Dependencies**: If you add new packages, run `pnpm install` and restart the dev server
- **TypeScript**: Run `pnpm tsc --noEmit` to check for type errors

## 📁 Project Structure & File Organization

```
ai-resume-generator/
├── app/                                   # Next.js App Router
│   ├── api/
│   │   ├── generate-resume/
│   │   │   └── route.ts                   # Main LLM integration endpoint
│   │   │                                  # - Takes resume + job description
│   │   │                                  # - Uses OpenRouter API for AI generation
│   │   │                                  # - Returns LaTeX resume
│   │   │
│   │   └── latex-to-pdf/
│   │       └── route.ts                   # PDF conversion endpoint
│   │                                      # - Converts LaTeX → PDF
│   │                                      # - Uses wkhtmltopdf or similar
│   │
│   ├── layout.tsx                         # Root layout with providers
│   ├── page.tsx                           # Main application page
│   │                                      # - Orchestrates input/preview panels
│   │                                      # - Manages generation workflow
│   │
│   └── globals.css                        # Global styles & animations
│
├── components/                            # React Components
│   ├── webgl-shader.tsx                   # Shader-driven background effect
│   │
│   ├── resume-input-panel.tsx             # Left side: Input panel
│   │                                      # - Resume upload/paste
│   │                                      # - Job description input
│   │                                      # - Extra instructions
│   │                                      # - Generate trigger
│   │
│   ├── resume-preview-panel.tsx           # Right side: Preview panel
│   │                                      # - PDF viewer
│   │                                      # - Download button
│   │
│   ├── pdf-viewer.tsx                     # PDF rendering component
│   │
│   └── ui/                                # Radix UI primitives
│       ├── button.tsx                     # Styled button component
│       ├── label.tsx                      # Form label component
│       ├── textarea.tsx                   # Multi-line input field
│       └── ...                            # Other UI components
│
├── lib/                                   # Utility & Config
│   ├── llm-context.ts                     # LLM system prompts & context
│   │                                      # - Loads instructions from LLM_utils/
│   │                                      # - Builds system prompt for Claude
│   │                                      # - Defines action verbs & rules
│   │
│   ├── utils.ts                           # General utility functions
│   │
│   └── LLM_utils/                         # External LLM resources
│       ├── Action-Verbs-claude.txt        # 200+ action verbs by category
│       ├── Claude-Master-Instructions.md  # Core system instructions
│       ├── Claude-ATS-Cheatsheet-Instructions.md  # ATS best practices
│       ├── Claude-Project-System-Instructions.md  # Project-specific prompts
│       └── LatexRules.txt                 # LaTeX formatting standards
│
├── public/                                # Static assets
│   └── images/                            # Image files
│
├── configuration files:
│   ├── package.json                       # Dependencies & scripts
│   ├── pnpm-lock.yaml                     # Locked dependency versions
│   ├── tsconfig.json                      # TypeScript configuration
│   ├── next.config.mjs                    # Next.js configuration
│   ├── tailwind.config.ts                 # Tailwind CSS settings
│   ├── postcss.config.mjs                 # PostCSS configuration
│   ├── components.json                    # shadcn/ui metadata
│   └── next-env.d.ts                      # Next.js type definitions
│
└── README.md                              # This file
```

### Key Components Explained

**App Page (`app/page.tsx`)**

- Entry point of the application
- Manages overall workflow state
- Orchestrates Resume Input Panel and Resume Preview Panel
- Handles API calls to `/api/generate-resume`

**Resume Input Panel (`components/resume-input-panel.tsx`)**

- Multi-format file upload (PDF, DOCX, text)
- PDF extraction using `pdfjs-dist`
- Word document extraction using `mammoth`
- Form validation and state management
- Loading states during generation

**Resume Preview Panel (`components/resume-preview-panel.tsx`)**

- Displays generated PDF in real-time
- Download functionality
- Error handling and retry logic

**API Route: Generate Resume (`app/api/generate-resume/route.ts`)**

```typescript
// Request: FormData
- jobDescription: string (target job posting)
- resumeContent: string (user's current resume)
- extraInstructions: string (optional custom instructions)

// Internal Process:
1. Build system prompt from llm-context.ts
2. Construct user prompt with resume + job description
3. Call OpenRouter API with Claude/Deepseek model
4. Parse LaTeX output

// Response: JSON
- latex: string (complete LaTeX document)
```

**API Route: LaTeX to PDF (`app/api/latex-to-pdf/route.ts`)**

```typescript
// Request: JSON
- latex: string (LaTeX document content)

// Internal Process:
1. Validate LaTeX syntax
2. Execute wkhtmltopdf or similar converter
3. Generate PDF binary

// Response: Binary
- PDF file (with appropriate headers)
```

## 🔌 API Reference

### Resume Generation Endpoint

**Route:** `POST /api/generate-resume`

**Purpose:** Generate an ATS-optimized LaTeX resume by combining user's resume with target job description using AI.

**Request Format:**

```
Content-Type: multipart/form-data

- jobDescription (string, required)
    The job posting/description to optimize for
    Example: "We're looking for a full-stack engineer with React and Node.js experience..."

- resumeContent (string, required)
    The user's current resume (extracted from PDF/DOCX or pasted)

- extraInstructions (string, optional)
    Custom instructions for the AI
    Example: "Emphasize ML/AI experience, focus on startup background"
```

**Response:**

```json
{
  "latex": "\\documentclass{article}\n\\usepackage{...\n...\n\\end{document}"
}
```

**Error Handling:**

```json
{
  "error": "Job description and resume are required.",
  "status": 400
}
```

**Internal Flow:**

1. Validate inputs (both resume and job description present)
2. Load system prompt from `lib/llm-context.ts`
3. Build structured prompt combining:
   - LLM_utils/Claude-Master-Instructions.md
   - LLM_utils/Claude-ATS-Cheatsheet-Instructions.md
   - Action verbs from LLM_utils/Action-Verbs-claude.txt
   - User's resume and target job description
4. Send to OpenRouter API (default: deepseek/deepseek-chat)
5. Stream and parse LaTeX response
6. Return complete LaTeX document

---

### PDF Conversion Endpoint

**Route:** `POST /api/latex-to-pdf`

**Purpose:** Convert LaTeX document to PDF for preview and download.

**Request Format:**

```json
{
  "latex": "\\documentclass{article}...\\end{document}"
}
```

**Response:**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="resume.pdf"

[Binary PDF data]
```

**Error Handling:**

- Invalid LaTeX syntax returns 400
- Compilation errors return detailed error messages

---

## ⚙️ Configuration & Customization

### Environment Variables

```bash
# Required for operation
OPENROUTER_API_KEY=sk_***                    # API key from openrouter.ai

# Optional
OPENROUTER_MODEL=deepseek/deepseek-chat      # LLM model to use
NODE_ENV=development                         # development | production
```

### Customize LLM Behavior

All LLM instructions are stored in `lib/LLM_utils/`:

**File:** `Claude-Master-Instructions.md`

- Core system prompt and role definition
- Modify to change how Claude understands its task

**File:** `Claude-ATS-Cheatsheet-Instructions.md`

- ATS optimization strategies
- Keywords and formatting best practices
- Modify to prioritize different aspects

**File:** `Action-Verbs-claude.txt`

- Database of 200+ action verbs by skill category
- Used to enrich resume language
- Add or remove verbs to customize output

**File:** `LatexRules.txt`

- LaTeX formatting standards and rules
- Controls resume appearance and ATS compatibility

All these files are loaded in `lib/llm-context.ts` and compiled into the system prompt at runtime.

### Styling Customization

**Tailwind CSS** (`tailwind.config.ts`)

- Color scheme
- Typography scales
- Spacing and breakpoints

**Global CSS** (`app/globals.css`)

- Theme tokens, utilities, and shared layout styling
- Default styles for UI components

**Component Styles** (`components/ui/*.tsx`)

- Individual component styling
- Built with Radix UI for accessibility

### UI Component Customization

All UI components in `components/ui/` are built on Radix UI primitives:

- Fully accessible (WCAG compliant)
- Styled with Tailwind CSS
- Can be customized without breaking functionality

Examples:

- `button.tsx` - Customizable button with variants
- `textarea.tsx` - Multi-line input with auto-resize
- `label.tsx` - Form labels with proper accessibility

## 🧠 How the AI Works (Technical Details)

### Resume Generation Pipeline

```
Input: Resume Text + Job Description
   ↓
System Prompt Assembly
  ├─ Claude-Master-Instructions.md     → "You are a professional resume writer"
  ├─ Claude-ATS-Cheatsheet-Instructions → "Follow these ATS rules..."
  ├─ Action-Verbs-claude.txt           → "Use verbs like: Accelerated, Achieved..."
  ├─ LatexRules.txt                    → "Format with these LaTeX rules..."
  └─ Claude-Project-System-Instructions → Project-specific context
   ↓
User Prompt Construction
  ├─ Current Resume (full text)
  ├─ Target Job Description (full text)
  └─ Extra Instructions (if provided by user)
   ↓
OpenRouter API Call
  ├─ Model: deepseek/deepseek-chat (configurable)
  ├─ Temperature: 0.7 (balanced creativity/consistency)
  └─ Max Tokens: 4000+
   ↓
LaTeX Generation
  ├─ AI analyzes job description for keywords
  ├─ Maps resume experience to job requirements
  ├─ Rewrites bullet points with power verbs
  ├─ Formats as ATS-friendly LaTeX
  └─ Returns complete, compilable document
   ↓
Output: LaTeX Resume → PDF Conversion
```

### Why LaTeX?

1. **ATS-Compatible**: Plain text format, no embedded fonts or graphics
2. **Consistent Formatting**: Same output across all systems
3. **Professional Quality**: Academic/Professional standard format
4. **Compilable**: Can be edited and recompiled locally
5. **Metadata-Free**: No hidden formatting that confuses ATS systems

### ATS Optimization Strategies

The application implements these ATS best practices:

| Strategy             | Implementation                                                              |
| -------------------- | --------------------------------------------------------------------------- |
| **Keyword Matching** | AI extracts keywords from job description and weaves them throughout resume |
| **Section Headers**  | Uses standard headers (Experience, Education, Skills) that ATS can parse    |
| **No Graphics**      | LaTeX generates plain text PDF without images or visual elements            |
| **Formatting**       | Avoids columns, text boxes, or decorative separators                        |
| **Consistency**      | Uniform date formats, bullet point structure                                |
| **Power Verbs**      | Uses action verbs from curated database to start achievements               |
| **Brevity**          | Reformats to fit single page while maximizing content                       |

---

## 🛠️ Development Guide

### Code Architecture

**Component Philosophy:**

- **Server-side**: Next.js App Router for API and layout
- **Client-side**: React components for interactivity
- **Type Safety**: Full TypeScript throughout

**File Organization:**

- API routes in `app/api/` - isolated, single responsibility
- Components in `components/` - reusable, focused, accessible
- Utilities in `lib/` - pure functions, no side effects
- Styles alongside components - co-located with implementation

### Key Dependencies

**Why each library:**

- **React Hook Form**: Minimal re-renders, easy validation
- **Zod**: Runtime type validation for API inputs
- **pdfjs-dist**: Client-side PDF parsing without server overhead
- **mammoth**: Clean DOCX extraction to text
- **Framer Motion**: Smooth, performant animations
- **Radix UI**: Low-level, unstyled, fully accessible components

### Performance Considerations

1. **Client-Side PDF Extraction**
   - PDFs are processed in the browser (pdfjs-dist)
   - Reduces server load
   - Faster for user (no upload → extract → process cycle)

2. **Streaming API Responses**
   - LaTeX generation streams from OpenRouter
   - UI can show progress without blocking

3. **Component Code Splitting**
   - WebGL shader effect is isolated component
   - PDF viewer loads only when needed

4. **CSS Optimization**
   - Tailwind purges unused styles in production
   - Emotion handles CSS-in-JS efficiently

### Code Quality Standards

**TypeScript:**

```bash
# Check for type errors without building
pnpm tsc --noEmit

# Build catches all type issues before deployment
pnpm build
```

**Linting:**

```bash
# Run ESLint on all files
pnpm lint
```

**Testing (if added):**

```bash
# Future: Add Jest/Vitest for unit tests
# Future: Add E2E tests with Playwright/Cypress
```

---

## 🔐 Security & Privacy

### Data Handling

- ✅ **No Data Storage**: Resumes are never saved to database
- ✅ **In-Memory Processing**: All work happens in API request lifecycle
- ✅ **No Logs**: Resume content not logged or retained
- ✅ **HTTPS Only**: Enforced in production
- ✅ **API Key Security**: Keys stored in environment variables only, never in code

### API Security

- Input validation through Zod schemas
- FormData validation on upload
- Error messages don't expose internals
- Rate limiting recommended for production

### User Privacy

- Session-based, not user-account based
- No tracking or analytics on resume content
- User data doesn't persist between sessions

---

## 📊 Performance Metrics

### Typical Workflow Timing

| Step                    | Duration           |
| ----------------------- | ------------------ |
| PDF upload & extraction | 1-2 seconds        |
| Job description input   | User-dependent     |
| AI resume generation    | 5-10 seconds       |
| LaTeX → PDF conversion  | 1-2 seconds        |
| **Total**               | **~10-15 seconds** |

### API Response Times (OpenRouter)

- Claude models: 8-12 seconds
- Deepseek: 4-8 seconds
- Varies based on model selection and system load

---

## 🚀 Deployment

### Deploying to Vercel (Recommended)

1. **Push to GitHub**

```bash
git push origin main
```

2. **Connect to Vercel**
   - Go to vercel.com
   - Import your GitHub repository
   - Set environment variables (OPENROUTER_API_KEY)

3. **Deploy**
   - Vercel automatically builds and deploys on push

### Self-Hosted Options

**Requirements:**

- Node.js 18+ runtime
- Ability to set environment variables
- Access to OpenRouter API

**Platforms:**

- Railway.app
- Render.com
- DigitalOcean App Platform
- Self-hosted VPS with Docker

---

## 🐛 Troubleshooting & Development

### Common Issues

**Issue: "API key is missing"**

```bash
# Check .env.local exists in root
cat .env.local

# Should contain: OPENROUTER_API_KEY=sk-or-v1-***
# Get your key at: https://openrouter.ai/keys
```

**Issue: "PDF extraction fails"**

- Check browser console for pdfjs worker errors
- Ensure PDF is not corrupted
- Try copying/pasting resume text instead

**Issue: "Generated resume is blank"**

- Check API response in browser DevTools
- Verify job description is filled in
- Try smaller, simpler job descriptions first

**Issue: "LaTeX contains errors"**

- Some special characters may need escaping
- Check OpenRouter API response for errors
- Review LLM output in browser network tab

### Enable Debug Mode

```typescript
// In app/page.tsx, add logging:
console.log("Resume Input:", resumeContent)
console.log("Job Description:", jobDescription)
console.log("API Response:", response)
```

### Useful Commands During Development

```bash
# Watch mode with hot reload (preserves state)
pnpm dev

# Check TypeScript without building
pnpm tsc --noEmit

# Run linter
pnpm lint

# Production build (catches all errors)
pnpm build && pnpm start

# Clean build (remove cache)
rm -rf .next
pnpm build
```

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a pull request

### Contribution Areas

- Additional LLM models support
- Improved ATS optimization strategies
- More action verb categories
- Enhanced UI/UX
- Additional file format support (Google Docs, etc.)
- Localization to other languages

---

## 📄 License

This project is provided as-is for personal and educational use.

---

## 🙏 Acknowledgments

- [Radix UI](https://www.radix-ui.com/) — Accessible component primitives
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS framework
- [Next.js](https://nextjs.org/) — React framework with App Router
- [OpenRouter](https://openrouter.ai/) — LLM API aggregation
- [Claude](https://anthropic.com) & [Deepseek](https://deepseek.com) — Powerful AI models
- [React](https://react.dev) — UI library
- [Framer Motion](https://www.framer.com/motion/) — Animation library

---

## 📞 Support & Contact

**Found a bug?**

- Open an issue on GitHub with details and reproduction steps

**Have a feature idea?**

- Create a GitHub issue with the `enhancement` label

**General questions?**

- Check existing issues and discussions
- Join our community discussions

---

## 🎯 Roadmap

Potential future features:

- [ ] Multiple resume versions management
- [ ] Cover letter generation
- [ ] Job application tracking dashboard
- [ ] Resume analytics (keyword coverage, formatting score)
- [ ] LinkedIn profile import
- [ ] Batch job application processing
- [ ] Dark mode support
- [ ] Mobile app version
- [ ] API for third-party integrations

---

## 📈 Success Stories

Share your success! Let us know if you landed a job using this tool:

- Open an issue with "Success Story" label
- Tell us which position and company
- Any tips or feedback appreciated!

---

**Made with ❤️ to help you land your dream job** 🚀

_Last Updated: March 7, 2026_
_Version: 0.1.0_
