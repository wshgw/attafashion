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
  "brand_file": "full content of content/brands/SLUG/index.md (YAML frontmatter only)",
  "posts": [
    {"filename": "content/posts/2025-01-01-SLUG-review.md", "content": "markdown with frontmatter"},
    {"filename": "content/posts/2025-01-01-SLUG-guide.md", "content": "markdown with frontmatter"},
    {"filename": "content/posts/2025-01-01-SLUG-comparison.md", "content": "markdown with frontmatter"}
  ]
} where SLUG is the lowercase brand slug (letters and numbers only, no hyphens).

CRITICAL: brand_file must be YAML frontmatter ONLY (no body content after ---). Use this EXACT field structure:

---
title: "Brand Name — Short Tagline"
description: "SEO meta description ~150 chars"
layout: landing
date: ${today}
cover: "https://images.unsplash.com/photo-XXXXX?w=1200&q=80"
categories: ["Trends"]
canonical_url: "AFFILIATE_URL"
keywords: "keyword1, keyword2, keyword3"

brand_name: "Brand Name"
brand_url: "AFFILIATE_URL"
brand_logo_svg: "<svg>...</svg>"

announcement_text: "FREE SHIPPING / SALE etc"

style_override: |
  :root {
    --lp-primary: #HEX;
    --lp-primary-dark: #HEX;
    --lp-primary-light: #HEX;
    --lp-accent: #HEX;
  }

hero:
  badge: "Short category tag"
  headline: "Main headline (not 'title')"
  tagline: "Supporting description (not 'subtitle')"
  image: "https://images.unsplash.com/photo-XXXXX?w=600&q=80"
  cta_primary:
    text: "Shop Now"
    url: "AFFILIATE_URL"
  cta_secondary:
    text: "Learn More"
    url: "#section"

trust_bar:
  - icon: "star"
    text: "Feature 1"
  - icon: "checkmark"
    text: "Feature 2"
  - icon: "shield"
    text: "Feature 3"
  - icon: "heart"
    text: "Feature 4"

products:
  heading: "Section Heading"
  subheading: "Section Subtitle"
  description: "Short intro paragraph"
  items:
    - name: "Product Name"
      price: "$XX.XX"
      image: "https://images.unsplash.com/photo-XXXXX?w=400&q=80"
      rating: 4.5
      reviews: "123+"
      badge: "Best Seller"
      description: "1-2 sentence product description"

benefits:
  heading: "Why Brand Name"
  items:
    - icon: "shield"
      title: "Benefit Title"
      description: "Benefit description"

features_strip:
  - icon: "package"
    title: "Free Shipping"
    subtitle: "On orders over $X"
  - icon: "clock"
    title: "Returns"
    subtitle: "30-day policy"
  - icon: "shield"
    title: "Warranty"
    subtitle: "Lifetime"
  - icon: "star"
    title: "Quality"
    subtitle: "Premium"

cta:
  headline: "Final CTA Headline"
  tagline: "Supporting text"
  button_text: "Shop Now"
  button_url: "AFFILIATE_URL"

faq:
  heading: "Frequently Asked Questions"
  items:
    - q: "Question?"
      a: "Answer..."

footer:
  description: "Brand description for footer"
  copyright: "2026 Brand Name Guide. All rights reserved."
  copyright_url: "https://attafashion.com/brands/SLUG/"
  columns:
    - heading: "Shop"
      links:
        - text: "All Products"
          url: "AFFILIATE_URL"
    - heading: "Learn"
      links:
        - text: "Review"
          url: "/posts/${today}-SLUG-review/"
    - heading: "Support"
      links:
        - text: "Privacy Policy"
          url: "/privacy-policy/"
---

STRICT RULES:
- style_override MUST be a pipe-string (literal block |), NEVER a YAML object or map
- Products exactly 3-4 items, benefits 3-4 items, features_strip exactly 4 items, faq exactly 3 items
- hero MUST use "headline" and "tagline" — NOT "title" or "subtitle"
- products MUST have wrapper "items" array — NOT a flat list
- faq MUST have wrapper "items" array with "q"/"a" — NOT "question"/"answer"
- cta MUST use "button_text"/"button_url" — NOT "button"/"url"
- All images: https://images.unsplash.com/photo-XXXXX?w=400&q=80 (products) or w=600 (hero) or w=1200 (cover)
- NO body content after closing ---
- Icon names (for trust_bar, benefits, features_strip): star, checkmark, heart, shield, check-circle, clock, package, plus, globe, lock, map-pin, users, home

RULES for posts:
- Frontmatter: title, description, date, categories: ["Trends"], cover (Unsplash URL), affiliate_url (AFFILIATE_URL)
- Content: 2-3 affiliate link anchor texts, informative & SEO-optimized, cross-links between articles, standard markdown, no shortcodes`;

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
