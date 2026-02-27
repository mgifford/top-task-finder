const MAX_URL_COUNT = 200;
const MIN_URL_COUNT = 1;

function buildCorsHeaders(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const value = allowedOrigin === '*' ? '*' : origin;
  return {
    'Access-Control-Allow-Origin': value,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

function clampRequestedCount(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 100;
  }
  return Math.min(MAX_URL_COUNT, Math.max(MIN_URL_COUNT, parsed));
}

function normalizeDomainUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    throw new Error('domainUrl is required.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const parsed = new URL(withProtocol);
  parsed.hash = '';
  return parsed.origin;
}

async function dispatchGithubWorkflow(env, payload) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const workflowFile = env.GITHUB_WORKFLOW_FILE || 'cache-refresh.yml';
  const workflowRef = env.GITHUB_WORKFLOW_REF || 'main';

  if (!owner || !repo || !env.GITHUB_TOKEN) {
    throw new Error('Cloudflare worker secrets/vars are incomplete.');
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'top-task-finder-cloudflare-worker',
      },
      body: JSON.stringify({
        ref: workflowRef,
        inputs: {
          domain_url: payload.domainUrl,
          requested_count: String(payload.requestedCount),
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub dispatch failed (${response.status}): ${text}`);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders(request.headers.get('Origin') || '*', env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST' || url.pathname !== '/trigger-crawl') {
      return jsonResponse({ error: 'Not found.' }, 404, corsHeaders);
    }

    try {
      const body = await request.json();
      const domainUrl = normalizeDomainUrl(body.domainUrl);
      const requestedCount = clampRequestedCount(body.requestedCount);

      await dispatchGithubWorkflow(env, {
        domainUrl,
        requestedCount,
      });

      return jsonResponse(
        {
          accepted: true,
          message: 'Workflow dispatched.',
        },
        202,
        corsHeaders,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected worker error.';
      return jsonResponse({ error: message }, 500, corsHeaders);
    }
  },
};
