# Operations

## Health

- `GET /api/health`
- Returns `200` when core runtime dependencies are configured.
- Returns `503` when required runtime integrations are missing.

Checks include:

- Groq
- Supabase anon config
- Supabase service-role config
- Polar billing config
- Upstash rate-limiting config

## Support Playbook

### Billing issue

1. Check application logs for `billing-checkout`, `billing-portal`, or `polar-webhook-customer-state`.
2. Confirm Polar webhook delivery succeeded.
3. Confirm the user row exists in `user_subscriptions`.
4. Check `plan`, `status`, and provider IDs on the affected subscription row.

### Account deletion issue

1. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set.
2. Check application logs for `account-delete`.
3. Confirm the user can authenticate successfully before deletion.

### AI generation issue

1. Check logs for `generate-resume` or `ats-insights`.
2. Verify `GROQ_API_KEY` and selected model configuration.
3. Check rate-limit responses and Upstash connectivity.

## Alerts Worth Adding

- Repeated `polar-webhook-customer-state` failures
- Repeated `account-delete` failures
- Sustained Groq upstream failures
- Health endpoint returning `503`

## Analytics Events

The client emits lightweight funnel events through Vercel Analytics:

- `signup_completed`
- `signin_started`
- `signin_completed`
- `resume_generated`
- `ats_scored`
- `checkout_started`
- `billing_portal_opened`
- `account_exported`
- `account_deleted`
- `job_application_created`
