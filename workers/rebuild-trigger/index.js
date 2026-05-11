// Scheduled rebuild trigger for attafashion Cloudflare Pages
// Calls the Pages Deploy Hook to trigger a new build, picking up
// any posts/brand pages whose frontmatter date has arrived.
//
// Deploy:
//   1. npx wrangler login
//   2. npx wrangler deploy
//   3. npx wrangler secret put DEPLOY_HOOK_URL

export default {
  async scheduled(event, env, ctx) {
    const hook = env.DEPLOY_HOOK_URL;
    if (!hook) {
      console.error('DEPLOY_HOOK_URL not set');
      return;
    }

    const res = await fetch(hook, { method: 'POST' });

    if (res.ok) {
      const data = await res.json();
      console.log('Rebuild triggered:', data.id || 'ok');
    } else {
      console.error('Deploy hook failed:', res.status, await res.text());
    }
  },

  // Manual trigger via HTTP (for testing)
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Send POST to trigger rebuild', { status: 405 });
    }

    const hook = env.DEPLOY_HOOK_URL;
    if (!hook) {
      return new Response('DEPLOY_HOOK_URL not set', { status: 500 });
    }

    const res = await fetch(hook, { method: 'POST' });
    const body = res.ok ? { success: true } : { error: await res.text() };

    return new Response(JSON.stringify(body), {
      status: res.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
