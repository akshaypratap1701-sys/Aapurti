const PAGE_BASE64 = "__PAGE_BASE64__";

const SOURCES = [
  { kind: "ashby", name: "Nivoda", board: "Nivoda" },
  { kind: "ashby", name: "Lyric", board: "lyric" },
  { kind: "ashby", name: "Fleek", board: "fleek" },
  { kind: "ashby", name: "Airbound", board: "airbound" },
  { kind: "lever", name: "Meesho", board: "meesho" },
  { kind: "lever", name: "Porter", board: "porter" },
  { kind: "greenhouse", name: "Flexport", board: "flexport" },
  { kind: "greenhouse", name: "Instacart", board: "instacart" },
  { kind: "smart", name: "Bosch Group", company: "BoschGroup", queries: ["supply chain", "logistics", "procurement"] },
  { kind: "smart", name: "Umdasch Group", company: "UmdaschGroup", queries: ["supply chain", "logistics", "procurement"] },
  { kind: "smart", name: "METRO", company: "METROMAKRO", queries: ["supply chain", "logistics", "procurement"] },
  { kind: "smart", name: "Konecranes", company: "Konecranes", queries: ["supply chain", "logistics", "procurement"] },
  { kind: "smart", name: "QAD", company: "qadinc", queries: ["supply chain", "logistics", "procurement"] },
];

const DOMAIN_TERMS = [
  "supply chain", "supply planning", "demand planning", "s&op", "ibp", "replenishment",
  "procurement", "sourcing", "purchasing", "buyer", "supplier", "logistics", "freight",
  "transport", "last mile", "warehouse", "fulfilment", "fulfillment", "inventory",
  "distribution", "material planning", "production planning", "manufacturing", "fleet",
  "customs", "shipping", "shipment", "dispatch", "network design", "order management",
];

let isolateCache = { at: 0, payload: null };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/me") return handleProfile(request, env);
    if (url.pathname === "/api/jobs") return handleJobs(request, ctx);
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
    if (url.pathname !== "/") return new Response("Not found", { status: 404 });
    return new Response(decodePage(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, max-age=0, must-revalidate",
        "x-content-type-options": "nosniff",
      },
    });
  },
};


async function handleProfile(request, env) {
  const identity = authenticatedIdentity(request);
  if (!identity) return jsonResponse({ error: "Sign in to access your Aapurti profile." }, 401, "private, no-store");
  if (!env?.DB) return jsonResponse({ error: "Aapurti profile storage is temporarily unavailable." }, 503, "private, no-store");
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Cross-origin profile changes are not allowed." }, 403, "private, no-store");
  }
  try {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT email, display_name, companies_json, experience, target_level, domains_json, skills, locations, titles FROM profiles WHERE user_id = ? LIMIT 1").bind(identity.id).first();
      const profile = row ? {
        name: row.display_name,
        email: row.email,
        companies: parseStringArray(row.companies_json),
        experience: row.experience || "",
        level: row.target_level || "",
        domains: parseStringArray(row.domains_json),
        skills: row.skills || "",
        locations: row.locations || "",
        titles: row.titles || "",
      } : null;
      return jsonResponse({ user: { id: identity.id, email: identity.email, name: identity.name }, profile }, 200, "private, no-store");
    }
    if (request.method === "PUT") {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 20000) return jsonResponse({ error: "Profile is too large." }, 413, "private, no-store");
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return jsonResponse({ error: "Invalid profile." }, 400, "private, no-store");
      const profile = {
        name: cleanText(identity.name || body.name || identity.email, 120),
        email: identity.email,
        companies: cleanArray(body.companies, 20, 120),
        experience: cleanText(body.experience, 40),
        level: cleanText(body.level, 60),
        domains: cleanArray(body.domains, 20, 80),
        skills: cleanText(body.skills, 1000),
        locations: cleanText(body.locations, 300),
        titles: cleanText(body.titles, 300),
      };
      await env.DB.prepare("INSERT INTO profiles (user_id, email, display_name, companies_json, experience, target_level, domains_json, skills, locations, titles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, companies_json = excluded.companies_json, experience = excluded.experience, target_level = excluded.target_level, domains_json = excluded.domains_json, skills = excluded.skills, locations = excluded.locations, titles = excluded.titles, updated_at = CURRENT_TIMESTAMP")
        .bind(identity.id, identity.email, profile.name, JSON.stringify(profile.companies), profile.experience, profile.level, JSON.stringify(profile.domains), profile.skills, profile.locations, profile.titles)
        .run();
      return jsonResponse({ user: { id: identity.id, email: identity.email, name: identity.name }, profile }, 200, "private, no-store");
    }
    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM profiles WHERE user_id = ?").bind(identity.id).run();
      return jsonResponse({ ok: true }, 200, "private, no-store");
    }
    return jsonResponse({ error: "Method not allowed." }, 405, "private, no-store");
  } catch (error) {
    console.error("Aapurti profile request failed", error);
    return jsonResponse({ error: "Aapurti could not load or save your profile. Please try again." }, 500, "private, no-store");
  }
}

function authenticatedIdentity(request) {
  const id = request.headers.get("oai-authenticated-user-id");
  if (!id) return null;
  const email = request.headers.get("oai-authenticated-user-email") || "";
  let name = "";
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  if (encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { name = decodeURIComponent(encodedName); } catch {}
  }
  return { id, email, name: name || email };
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanArray(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === "string").map(item => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function parseStringArray(value) {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : []; }
  catch { return []; }
}

async function handleJobs(request, ctx) {
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  if (!force && typeof caches !== "undefined") {
    try {
      const cached = await caches.default.match(new Request(new URL("/api/jobs", request.url).toString(), { method: "GET" }));
      if (cached) return cached;
    } catch {}
  }
  if (!force && isolateCache.payload && Date.now() - isolateCache.at < 8 * 60 * 1000) {
    return jsonResponse(isolateCache.payload, 200, "public, max-age=0, s-maxage=300");
  }
  const payload = await loadLiveJobs();
  isolateCache = { at: Date.now(), payload };
  if (ctx?.waitUntil && typeof caches !== "undefined") {
    const cacheKey = new Request(new URL("/api/jobs", request.url).toString(), { method: "GET" });
    ctx.waitUntil(caches.default.put(cacheKey, jsonResponse(payload, 200, "public, max-age=0, s-maxage=300")));
  }
  return jsonResponse(payload, 200, "public, max-age=0, s-maxage=300");
}

async function loadLiveJobs() {
  const feeds = SOURCES.flatMap(source => {
    if (source.kind === "smart") {
      return source.queries.map(query => {
        const scoped = { ...source, query };
        return { source: scoped, promise: fetchSource(scoped) };
      });
    }
    return [{ source, promise: fetchSource(source) }];
  });
  const results = await Promise.allSettled(feeds.map(feed => feed.promise));
  const byPosting = new Map();
  const sourceCounts = new Map();
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const source = feeds[i].source;
    if (result.status !== "fulfilled") {
      failed++;
      sourceCounts.set(source.name, sourceCounts.get(source.name) || { name: source.name, ok: false, count: 0 });
      continue;
    }
    const jobs = result.value;
    const status = sourceCounts.get(source.name) || { name: source.name, ok: true, count: 0 };
    status.ok = true;
    sourceCounts.set(source.name, status);
    for (const raw of jobs) {
      const job = normalizeJob(source, raw);
      if (!job || !isSupplyChainRole(job)) continue;
      if (isExpired(job.postedAt)) continue;
      const dedupeKey = `${job.company.toLowerCase()}|${job.title.toLowerCase()}|${cityKey(job.location)}`;
      if (!byPosting.has(dedupeKey)) {
        byPosting.set(dedupeKey, job);
        status.count++;
      }
    }
  }

  const jobs = [...byPosting.values()].sort((a, b) => (dateValue(b.postedAt) || 0) - (dateValue(a.postedAt) || 0));
  const sources = [...sourceCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const sourceErrors = sources.filter(s => !s.ok).length;
  return {
    jobs,
    sources,
    updatedAt: new Date().toISOString(),
    warning: failed ? `${failed} public employer feed${failed === 1 ? "" : "s"} did not respond; available results are still shown.` : "",
    coverage: { providers: ["Greenhouse", "Lever", "Ashby", "SmartRecruiters"], companiesConfigured: SOURCES.length, sourcesWithResults: sources.filter(s => s.ok && s.count > 0).length, failedFeeds: sourceErrors },
  };
}

function fetchSource(source) {
  let url;
  if (source.kind === "greenhouse") url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`;
  else if (source.kind === "lever") url = `https://api.lever.co/v0/postings/${encodeURIComponent(source.board)}?mode=json`;
  else if (source.kind === "ashby") url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.board)}`;
  else {
    const params = new URLSearchParams({ q: source.query, limit: "100", destination: "PUBLIC" });
    url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.company)}/postings?${params}`;
  }
  const promise = (async () => {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 Aapurti/0.1" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);
    const data = await response.json();
    if (source.kind === "greenhouse") return data.jobs || [];
    if (source.kind === "lever") return Array.isArray(data) ? data : [];
    if (source.kind === "ashby") return (data.jobs || []).filter(j => j.isListed !== false);
    return data.content || [];
  })();
  return promise;
}

function normalizeJob(source, raw) {
  if (source.kind === "greenhouse") {
    const offices = (raw.offices || []).map(o => typeof o.location === "string" ? o.location : o.location?.name || o.name).filter(Boolean);
    return baseJob({
      id: `gh-${source.board}-${raw.id}`,
      title: raw.title,
      company: source.name,
      location: offices.join(" · ") || raw.location?.name || "Location not supplied",
      country: countryFrom(offices.join(" ")),
      postedAt: raw.updated_at || raw.created_at || raw.first_published,
      url: raw.absolute_url,
      description: htmlText(raw.content || raw.description || ""),
      source: "Greenhouse",
      sourceName: source.name,
      employmentType: raw.metadata?.find?.(m => /employment/i.test(m.name || ""))?.value || "",
      workplaceType: "",
      tags: [],
    });
  }
  if (source.kind === "lever") {
    const cat = raw.categories || {};
    const location = cat.allLocations?.join(" · ") || cat.location || "Location not supplied";
    return baseJob({
      id: `lever-${source.board}-${raw.id}`,
      title: raw.text,
      company: source.name,
      location,
      country: raw.country || countryFrom(location),
      postedAt: safeDate(raw.createdAt),
      url: raw.hostedUrl,
      description: htmlText(raw.descriptionPlain || raw.description || raw.openingPlain || ""),
      source: "Lever",
      sourceName: source.name,
      employmentType: cat.commitment || "",
      workplaceType: raw.workplaceType || "",
      tags: [cat.team, cat.department].filter(Boolean),
    });
  }
  if (source.kind === "ashby") {
    const location = [raw.location, ...(raw.secondaryLocations || []).map(x => x.location)].filter(Boolean).join(" · ") || "Location not supplied";
    const address = raw.address?.postalAddress || {};
    return baseJob({
      id: `ashby-${source.board}-${raw.jobUrl || raw.title}`,
      title: raw.title,
      company: source.name,
      location,
      country: String(address.addressCountry || "").toUpperCase() || countryFrom(location),
      postedAt: raw.publishedAt,
      url: raw.jobUrl,
      description: htmlText(raw.descriptionPlain || raw.descriptionHtml || ""),
      source: "Ashby",
      sourceName: source.name,
      employmentType: raw.employmentType || "",
      workplaceType: raw.workplaceType || (raw.isRemote ? "Remote" : ""),
      tags: [raw.department, raw.team].filter(Boolean),
    });
  }
  const id = raw.id || raw.uuid;
  const location = raw.location?.fullLocation || [raw.location?.city, raw.location?.region, raw.location?.country].filter(Boolean).join(", ") || "Location not supplied";
  const refId = String(id || raw.ref || "").split("/").pop();
  return baseJob({
    id: `smart-${source.company}-${id || refId}`,
    title: raw.name || raw.title,
    company: source.name,
    location,
    country: String(raw.location?.country || "").toUpperCase() || countryFrom(location),
    postedAt: raw.releasedDate || raw.refreshedDate || raw.createdOn,
    url: refId ? `https://jobs.smartrecruiters.com/${encodeURIComponent(source.company)}/${encodeURIComponent(refId)}` : raw.ref,
    description: htmlText(raw.jobAd?.sections?.jobDescription?.text || raw.jobAd?.sections?.qualifications?.text || raw.jobAd?.sections?.additionalInformation?.text || ""),
    source: "SmartRecruiters",
    sourceName: source.name,
    employmentType: raw.typeOfEmployment?.label || "",
    workplaceType: raw.location?.remote ? "Remote" : raw.location?.hybrid ? "Hybrid" : "",
    tags: [],
  });
}

function baseJob(job) {
  if (!job.title || !job.url) return null;
  try {
    const url = new URL(job.url);
    if (url.protocol !== "https:") return null;
    job.url = url.toString();
  } catch { return null; }
  const category = classify(job.title, job.description);
  if (!category) return null;
  const tags = [...new Set([category, ...(job.tags || []), ...extractTools(`${job.title} ${job.description}`)])].slice(0, 5);
  return { ...job, family: category, tags };
}

function isSupplyChainRole(job) {
  const title = normalize(job.title);
  const body = normalize(job.description || "");
  const titleDirect = /(supply chain|\bscm\b|logistics|warehouse|fulfilment|fulfillment|procurement|sourcing|purchasing|inventory|demand planning|supply planning|material planning|production planning|\bproduction\b|transport|freight|last mile|distribution|network design|s&op|\bibp\b|manufacturing)/.test(title);
  if (titleDirect) return true;
  const bodyHits = DOMAIN_TERMS.filter(term => body.includes(term)).length;
  return /\boperations?\b|\bops\b/.test(title) && bodyHits >= 5;
}

function classify(titleValue, bodyValue) {
  const title = normalize(titleValue);
  const body = normalize(bodyValue || "");
  const has = pattern => pattern.test(title);
  if (has(/network design|network optimization|network strategy/)) return "Network Design & Strategy";
  if (has(/demand planning|supply planning|demand planner|supply planner|replenishment|s&op|\bibp\b|material planning|production planning|forecast planner/)) return title.includes("s&op") || title.includes("ibp") ? "S&OP / IBP" : "Demand & Supply Planning";
  if (has(/procurement|sourcing|purchasing|buyer|category management|supplier development/)) return "Procurement & Sourcing";
  if (has(/warehouse|fulfilment|fulfillment|wms|inventory control|inventory planning/)) return "Warehousing & Fulfilment";
  if (has(/logistics|transport|freight|last mile|fleet|shipping|customs|distribution|dispatch|air operations|ocean operations|port operations/)) return "Logistics & Transportation";
  if (has(/supply chain analyst|logistics intelligence|inventory analyst|supply chain data|planning analytics|\bscm\b/)) return "SC Analytics & Data";
  if (has(/manufacturing|production|plant operations/)) return "Manufacturing & Operations";
  if (has(/supply chain.*consult|logistics.*consult|procurement.*consult|supply chain advisory/)) return "SC Consulting";
  if (has(/supply chain|\bscm\b/)) return "Manufacturing & Operations";
  const hits = DOMAIN_TERMS.filter(term => body.includes(term)).length;
  if (hits >= 5 && has(/operations|\bops\b/)) {
    if (/warehouse|fulfilment|fulfillment|inventory/.test(body)) return "Warehousing & Fulfilment";
    if (/logistics|transport|freight|last mile|fleet|shipping|customs|distribution|dispatch/.test(body)) return "Logistics & Transportation";
    if (/procurement|sourcing|purchasing|supplier/.test(body)) return "Procurement & Sourcing";
    if (/planning|forecast|replenishment|s&op|\bibp\b/.test(body)) return "Demand & Supply Planning";
    return "Manufacturing & Operations";
  }
  return null;
}

function extractTools(textValue) {
  const text = normalize(textValue);
  return ["SAP IBP", "o9", "Kinaxis", "Blue Yonder", "SAP MM", "SAP EWM", "Power BI", "SQL", "WMS", "Excel"].filter(t => text.includes(normalize(t)));
}

function countryFrom(location) {
  const text = String(location || "").toLowerCase();
  if (/(india|bengaluru|bangalore|mumbai|pune|delhi|gurugram|gurgaon|hyderabad|chennai|kolkata|noida|ahmedabad|jaipur|indore|kochi|lucknow)/.test(text)) return "IN";
  if (/(united states|\busa\b|\bus\b|canada|uk|united kingdom|australia|singapore|netherlands|germany|france|spain|mexico|brazil|china|japan)/.test(text)) return "OTHER";
  return "";
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9&]+/g, " ").trim();
}

function htmlText(value) {
  return String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

function isExpired(value) {
  const time = dateValue(value);
  return time != null && Date.now() - time > 45 * 86400000;
}

function dateValue(value) {
  if (!value) return null;
  const numeric = Number(value);
  const time = Number.isFinite(numeric) && numeric > 1e11 ? numeric : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function safeDate(value) {
  if (!value) return "";
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 1e11 ? new Date(numeric) : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function cityKey(location) {
  return normalize(String(location || "").split(/[·,]/)[0]);
}

function jsonResponse(data, status, cacheControl) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl, "x-content-type-options": "nosniff" },
  });
}

function decodePage() {
  const binary = atob(PAGE_BASE64);
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
