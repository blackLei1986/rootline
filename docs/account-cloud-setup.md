# Account and cloud setup

Rootline uses Supabase Auth and PostgreSQL for verified accounts and private learning data. Do not place real credentials in this file or commit them to source control.

## 1. Create the Supabase project

Create a Supabase project for each environment. In **Authentication → Providers → Email**, keep email/password enabled and turn **Confirm Email** on. Production must never disable email confirmation.

Configure these redirect URLs in **Authentication → URL Configuration**:

- Local site URL: `http://localhost:3000`
- Local callback: `http://localhost:3000/auth/callback`
- Production site URL: the final HTTPS origin
- Production callback: `<production-origin>/auth/callback`

## 2. Configure local environment variables

Copy `.env.example` to `.env.local` and set values from the corresponding Supabase project:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CLOUD_LEARNING_ENABLED=true
```

Only the URL and publishable key are browser-visible. The service-role key is server-only and must be stored in the deployment platform's encrypted secret settings.

## 3. Apply and test the database

Install the Supabase CLI and a Docker-compatible local runtime. From the project root run:

```text
supabase start
supabase db reset
supabase test db
```

The database test is a release gate. It must prove that an owner can access their row, a second authenticated user cannot access it, and an anonymous user cannot access private rows. The current development machine did not have the CLI, Docker, or PostgreSQL available when this feature was authored, so these commands must be run before deployment.

For a hosted project, link the intended project explicitly and review the target before pushing migrations. Never apply development migrations to production by assumption.

## 4. Verify two-user isolation

1. Register two different email addresses and confirm both emails.
2. Sign in as user A, learn a word, save a Reading document, and finish one review.
3. Sign in as user B in a separate browser profile.
4. Confirm user B cannot see user A's word state, Reading document, review history, migration batch, or Today plan.
5. Sign back in as user A and confirm all records remain available.
6. Sign out and confirm private API routes return an authentication error.

## 5. Verify migration and offline replay

Use a browser profile containing pre-account local learning data. After the first verified login, accept the import banner and check its imported/skipped/failed counts. Reload and retry: the same batch ID must be reused and counters must not double. Preserve the local source data.

Disconnect the network, complete several supported learning actions, reconnect, and confirm the queue drains in order. Replaying the same operation ID must return success without applying the mutation twice.

## 6. Run the application gate

```text
pnpm run audit:account-cloud
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Do not enable cloud learning in production until both the application gate and the Supabase database-policy gate pass.
