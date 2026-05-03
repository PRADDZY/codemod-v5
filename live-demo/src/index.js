let cachedData = null;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function loadScenarioData(env, requestUrl) {
  if (cachedData) {
    return cachedData;
  }
  const assetUrl = new URL("/data/scenarios.json", requestUrl);
  const response = await env.ASSETS.fetch(assetUrl.toString());
  if (!response.ok) {
    throw new Error(`Unable to read live demo data (${response.status})`);
  }
  cachedData = await response.json();
  return cachedData;
}

function summarizeScenario(scenario) {
  return {
    id: scenario.id,
    name: scenario.name,
    repo_url: scenario.repo_url,
    ref: scenario.ref,
    verdict: scenario.verdict,
    reason: scenario.reason,
    selected_tier_mb: scenario.selected_tier_mb,
    checks: scenario.checks,
    timings_ms: scenario.timings_ms,
    todo_markers: scenario.todo_markers,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, mode: "replay", timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/api/scenarios") {
      try {
        const data = await loadScenarioData(env, url);
        const scenarios = (data.scenarios ?? []).map((scenario) =>
          summarizeScenario(scenario),
        );
        return json({
          generated_at: data.generated_at ?? null,
          title: data.title ?? null,
          description: data.description ?? null,
          summary: data.summary ?? null,
          links: data.links ?? null,
          scenarios,
        });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }

    if (url.pathname.startsWith("/api/scenarios/")) {
      try {
        const data = await loadScenarioData(env, url);
        const id = decodeURIComponent(url.pathname.replace("/api/scenarios/", ""));
        const scenario = (data.scenarios ?? []).find((entry) => entry.id === id);
        if (!scenario) {
          return json({ error: `Scenario not found: ${id}` }, 404);
        }
        return json({
          generated_at: data.generated_at ?? null,
          scenario,
        });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "API route not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
