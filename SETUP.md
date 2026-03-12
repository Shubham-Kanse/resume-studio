# Quick Setup Guide

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Get Groq API Key

1. Go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `gsk_`)

## 3. Configure Environment

Create `.env.local` file in the root directory:

```bash
GROQ_API_KEY=gsk_your-key-here
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
POLAR_ACCESS_TOKEN=polar_oat_your_access_token_here
POLAR_WEBHOOK_SECRET=whsec_your_webhook_secret_here
POLAR_PRO_PRODUCT_ID=your_polar_pro_product_id_here
POLAR_SERVER=sandbox
```

Optional settings:

```bash
# Set production URL
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Required for reliable rate limiting in production
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token_here
```

Supabase is optional for guests. If you want Google login and saved history:

1. Create a free Supabase project
2. In Supabase, enable the Google provider under Authentication > Providers
3. Add your local and production redirect URLs under Authentication > URL Configuration
4. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`
5. Add your Polar credentials to `.env.local`
6. Run the SQL in `supabase/tracked-runs.sql`, `supabase/job-applications.sql`, and `supabase/user-subscriptions.sql`
7. Configure a Polar webhook to `https://your-domain.com/api/webhooks/polar`
8. Copy the project URL and anon key into `.env.local`

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
- Verify the key starts with `gsk_`
- Restart the dev server after creating `.env.local`

### "Failed to generate resume"

- Check your Groq account has access to the selected model
- Try a different Groq-supported model
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

Set your model with `GROQ_MODEL` in `.env.local`. Pick a Groq-supported model that matches your latency and quality requirements.
