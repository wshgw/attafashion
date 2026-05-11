export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { brand, affiliateUrl, password } = await request.json();
    if (!brand || !affiliateUrl) throw new Error('brand and affiliateUrl required');

    const adminPass = env.ADMIN_PASSWORD;
    if (!adminPass) throw new Error('ADMIN_PASSWORD not configured on server');
    if (password !== adminPass) throw new Error('Invalid admin password');

    const dsKey = env.DEEPSEEK_API_KEY;
    const ghToken = env.GITHUB_TOKEN || env.GH_TOKEN;
    const repo = env.GITHUB_REPO || 'wshgw/attafashion';
    if (!dsKey) throw new Error('DEEPSEEK_API_KEY not configured');
    if (!ghToken) throw new Error('GITHUB_TOKEN / GH_TOKEN not configured');

    // Step 1: Generate content via DeepSeek
    const content = await generateContent(brand, affiliateUrl, dsKey);

    // Step 2: Push to GitHub
    const result = await pushToGitHub(content, ghToken, repo, brand);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}

function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function generateContent(brand, url, apiKey) {
  const today = new Date().toISOString().slice(0, 10);
  const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^[^a-z]+/, '');

  const systemPrompt = `You are a brand page generator for a Hugo static fashion site.

Return a JSON object ONLY (no markdown, no explanation):
{
  "brand_file": "full content of content/brands/SLUG/index.md",
  "posts": [
    {"filename": "content/posts/${today}-SLUG-review.md", "content": "..."},
    {"filename": "content/posts/${today}-SLUG-guide.md", "content": "..."},
    {"filename": "content/posts/${today}-SLUG-comparison.md", "content": "..."}
  ]
} where SLUG is the brand slug.

RULES for brand_file:
- Must have layout: "landing" in frontmatter
- Uses YAML frontmatter with fields: title, description, layout, date, categories (["Trends"]), brand_name, brand_logo_svg (inline SVG), hero, products (3-4 items), benefits (3-4 items), features_strip (4 items), cta, faq (3 items), footer
- All images use Unsplash URLs with format https://images.unsplash.com/photo-XXXXX?w=400&q=80
- CTA buttons all use the affiliate URL provided
- Include style_override with brand-appropriate colors
- NO body content after the frontmatter

RULES for posts:
- Frontmatter must include: title, description, date, categories: ["Trends"], cover (Unsplash URL), affiliate_url
- Content must include 2-3 affiliate link anchor texts pointing to the affiliate URL
- Articles should be informative, SEO-optimized
- Include cross-links between the 3 articles
- Standard markdown format, no shortcodes`;

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Brand: ${brand}\nAffiliate URL: ${url}\nToday: ${today}\nSlug: ${slug}` },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek API: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = JSON.parse(data.choices[0].message.content);

  if (!content.brand_file || !content.posts?.length) throw new Error('AI response missing required fields');
  return content;
}

async function pushToGitHub(content, token, repo, brand) {
  const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^[^a-z]+/, '');
  const baseUrl = `https://api.github.com/repos/${repo}`;
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'attafashion-bg' };

  const gh = async (path, data, method) => {
    const opts = { method: method || (data ? 'POST' : 'GET'), headers };
    if (data) opts.body = JSON.stringify(data);
    const res = await fetch(`${baseUrl}/${path}`, opts);
    if (!res.ok) throw new Error(`GitHub ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  const ref = await gh('git/refs/heads/main');
  const commit = await gh(`git/commits/${ref.object.sha}`);

  const files = [
    { path: `content/brands/${slug}/index.md`, content: content.brand_file },
    ...content.posts.map(p => ({ path: p.filename, content: p.content })),
  ];

  const entries = [];
  for (const f of files) {
    const blob = await gh('git/blobs', { content: base64Encode(f.content), encoding: 'base64' });
    entries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const newTree = await gh('git/trees', { base_tree: commit.tree.sha, tree: entries });
  const newCommit = await gh('git/commits', {
    message: `feat: add ${brand} brand page and posts`,
    tree: newTree.sha,
    parents: [ref.object.sha],
  });
  await gh('git/refs/heads/main', { sha: newCommit.sha }, 'PATCH');

  return { commit: newCommit.sha, files: files.map(f => f.path) };
}
