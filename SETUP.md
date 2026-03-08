# Quick Setup Guide

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Get OpenRouter API Key

1. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `sk-or-v1-`)

## 3. Configure Environment

Create `.env.local` file in the root directory:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Optional settings:
```bash
# Use a different model (default: deepseek/deepseek-chat)
OPENROUTER_MODEL=anthropic/claude-3-5-sonnet

# Set production URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

Supabase is optional for guests. If you want Google login and saved history:
1. Create a free Supabase project
2. In Supabase, enable the Google provider under Authentication > Providers
3. Add your local and production redirect URLs under Authentication > URL Configuration
4. Run the SQL in `supabase/tracked-runs.sql`
5. Copy the project URL and anon key into `.env.local`

## 4. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Test the App

1. Paste a job description and upload a resume file
2. Click "Generate LaTeX Resume"
3. Wait 5-10 seconds for generation
4. View the result in the preview panel
5. Download as PDF or edit the LaTeX
6. Sign in with Google to save generated resumes and ATS score snapshots to your account

## Troubleshooting

### "API key not configured"
- Make sure `.env.local` exists in the root directory
- Verify the key starts with `sk-or-v1-`
- Restart the dev server after creating `.env.local`

### "Failed to generate resume"
- Check your OpenRouter account has credits
- Try a different model (e.g., `deepseek/deepseek-chat` is cheaper)
- Check the browser console for detailed errors

### PDF preview not working
- The LaTeX compilation service may be temporarily down
- Try downloading the .tex file and compiling locally
- Check for LaTeX syntax errors in the "Edit LaTeX" tab

## File Size Limits

- Max resume file size: 10MB
- Max LaTeX content: 100KB
- Supported formats: PDF, DOCX, DOC, TXT, MD, JSON

## Available Models

Popular models on OpenRouter:
- `deepseek/deepseek-chat` (fast, cheap, recommended)
- `anthropic/claude-3-5-sonnet` (high quality)
- `openai/gpt-4o` (balanced)
- `google/gemini-pro` (fast)

Set via `OPENROUTER_MODEL` in `.env.local`
