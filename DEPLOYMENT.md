# Deployment

## Production Checklist

Before deploying, ensure these environment variables are set:

```bash
GROQ_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_PRO_PRODUCT_ID=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Optional:

```bash
GROQ_MODEL=
GROQ_MAX_TOKENS=
GROQ_ATS_MAX_TOKENS=
NEXT_PUBLIC_APP_URL=
POLAR_SERVER=
ERROR_MONITORING_WEBHOOK_URL=
```

## Deploy Steps

1. Apply all SQL migrations in `supabase/migrations/`.
2. Add the production env vars in your hosting platform.
3. Configure the Polar webhook to `https://your-domain.com/api/webhooks/polar`.
4. Run `pnpm build`.
5. Deploy.
6. Keep CI green on `.github/workflows/ci.yml`.

## Post-Deploy Smoke Test

1. Open `/api/health` and confirm it returns `200`.
2. Sign in with a normal user.
3. Generate a resume.
4. Run AI ATS insights.
5. Export account data.
6. Delete account.
7. Complete one billing checkout and one billing portal flow.
8. Check `/api/health` again after billing and auth smoke tests.
