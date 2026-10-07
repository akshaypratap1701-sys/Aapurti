# Aapurti

Aapurti matches a signed-in user's profile to published supply-chain roles from selected Greenhouse, Lever, Ashby and SmartRecruiters career boards. It includes employer posting links, LinkedIn people searches and referral message drafts. It does not track applications.

## Hosting and sign-in

The Vercel deployment serves the app and its API routes. Users sign in with Google through Supabase Auth. Profile requests are handled server-side and verified against the Supabase Auth user endpoint. The database uses row-level security so each signed-in user can read, update or delete only their own profile. Database administration remains with the Supabase project owner.

## Configure Supabase

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
2. In **Authentication → Providers → Google**, enable Google sign-in and enter the OAuth client ID and client secret from Google Cloud.
3. In Google Cloud, add Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI.
4. In **Authentication → URL Configuration**, set the Site URL to the Vercel deployment URL and add that URL to the allowed redirect URLs.
5. In Vercel, add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables for the deployment. The anon key is used only with a verified user token and row-level security. Never add a Supabase service-role key to this app.

## Deploy to Vercel

Import this GitHub repository into Vercel. The project uses `npm run build` and the `site` output directory. Vercel detects the Node functions in `api/` automatically. Add the two Supabase environment variables before deploying.

## Local validation

```sh
npm run build
npm run validate
```

Public employer job listings are aggregated by `/api/jobs` and briefly edge-cached. Profile data is stored in Supabase Postgres and protected by both authenticated API requests and row-level security.
