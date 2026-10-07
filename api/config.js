export default function handler(_request, response) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    response.status(503).setHeader("Cache-Control", "no-store");
    return response.json({ error: "Supabase is not configured." });
  }
  response.status(200).setHeader("Cache-Control", "no-store");
  return response.json({ url, anonKey });
}
