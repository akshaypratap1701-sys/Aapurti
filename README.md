# Aapurti

Aapurti is a supply-chain careers workspace. It matches a signed-in user's profile to published roles from selected Greenhouse, Lever, Ashby and SmartRecruiters career boards, then provides employer posting links, LinkedIn people searches and referral message drafts.

## Profile storage and access

The hosted Site supplies the signed-in account identity. The Worker uses that stable identity to read, update or delete only that user's profile in the Cloudflare D1 `profiles` table. The browser does not hold the canonical profile record, and users cannot browse other profiles or access database administration. Database administration is available to the Site owner through the Site settings.

## Build and validate

```sh
bash scripts/build.sh
node scripts/validate-artifact.mjs
```

The `/api/jobs` endpoint aggregates public employer postings and briefly caches results. Job listings link to the employer's original posting. Aapurti does not include application tracking.
