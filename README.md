# Aapurti

A supply-chain careers workspace that matches a signed-in profile to published roles and provides employer apply links, LinkedIn people searches, and referral message drafts.

The current backend is a Cloudflare Worker with Cloudflare D1 profile storage. Authentication is supplied by the hosted Site environment; this version is not yet configured for Vercel. Application tracking is not included.

## Build and validate

```sh
bash scripts/build.sh
node scripts/validate-artifact.mjs
```

The `/api/jobs` endpoint aggregates public employer postings from selected Greenhouse, Lever, Ashby, and SmartRecruiters boards.