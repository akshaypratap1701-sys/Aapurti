const PROFILE_COLUMNS = "user_id,email,display_name,companies,experience,target_level,domains,skills,locations,titles";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (!sameOrigin(request)) return response.status(403).json({ error: "Cross-origin profile changes are not allowed." });
  if (!["GET", "PUT", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, PUT, DELETE");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) return response.status(503).json({ error: "Profile storage is not configured." });
  const token = bearerToken(request.headers.authorization);
  if (!token) return response.status(401).json({ error: "Sign in with Google to access your Aapurti profile." });

  try {
    const identityResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` },
    });
    if (!identityResponse.ok) return response.status(401).json({ error: "Your sign-in has expired. Please sign in again." });
    const identity = await identityResponse.json();
    if (!identity?.id) return response.status(401).json({ error: "Please sign in with Google to continue." });

    if (request.method === "GET") {
      const rows = await supabaseRequest(supabaseUrl, key, token,
        `/rest/v1/profiles?user_id=eq.${encodeURIComponent(identity.id)}&select=${PROFILE_COLUMNS}`);
      const row = rows[0] || null;
      return response.status(200).json({ user: publicUser(identity), profile: row ? profileFromRow(row) : null });
    }
    if (request.method === "PUT") {
      let body;
      try { body = await readJsonBody(request); }
      catch { return response.status(413).json({ error: "Profile is too large." }); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return response.status(400).json({ error: "Invalid profile." });
      const profile = {
        user_id: identity.id,
        email: cleanText(identity.email, 320),
        display_name: cleanText(identity.user_metadata?.full_name || identity.user_metadata?.name || identity.email, 120),
        companies: cleanArray(body.companies, 20, 120),
        experience: cleanText(body.experience, 40),
        target_level: cleanText(body.level, 60),
        domains: cleanArray(body.domains, 20, 80),
        skills: cleanText(body.skills, 1000),
        locations: cleanText(body.locations, 300),
        titles: cleanText(body.titles, 300),
      };
      const rows = await supabaseRequest(supabaseUrl, key, token,
        "/rest/v1/profiles?on_conflict=user_id", {
          method: "POST",
          headers: { prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(profile),
        });
      return response.status(200).json({ user: publicUser(identity), profile: profileFromRow(rows[0] || profile) });
    }

    await supabaseRequest(supabaseUrl, key, token,
      `/rest/v1/profiles?user_id=eq.${encodeURIComponent(identity.id)}`, { method: "DELETE" });
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Aapurti profile request failed", error?.message || "unknown error");
    return response.status(500).json({ error: "Aapurti could not load or save your profile. Please try again." });
  }
}

async function supabaseRequest(baseUrl, anonKey, userToken, path, options = {}) {
  const result = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${userToken}`,
      accept: "application/json",
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await result.text();
  if (!result.ok) throw new Error(`Supabase request failed (${result.status})`);
  return text ? JSON.parse(text) : [];
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email || "",
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Aapurti user",
  };
}

function profileFromRow(row) {
  return {
    name: row.display_name || "",
    email: row.email || "",
    companies: Array.isArray(row.companies) ? row.companies : [],
    experience: row.experience || "",
    level: row.target_level || "",
    domains: Array.isArray(row.domains) ? row.domains : [],
    skills: row.skills || "",
    locations: row.locations || "",
    titles: row.titles || "",
  };
}

function bearerToken(header = "") {
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : "";
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const proto = request.headers["x-forwarded-proto"] || "https";
  return host ? origin === `${proto}://${host}` : false;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanArray(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === "string").map(item => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems);
}

async function readJsonBody(request) {
  if (Number(request.headers["content-length"] || 0) > 20000) throw new Error("Profile is too large.");
  if (request.body && typeof request.body === "object" && !request.body[Symbol.asyncIterator]) return request.body;
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20000) throw new Error("Profile is too large.");
  }
  try { return JSON.parse(body); } catch { return null; }
}
