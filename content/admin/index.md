---
title: "Brand Generator"
layout: "page"
draft: false
---

<style>
.bg-container { max-width: 640px; margin: 0 auto; }
.bg-form { display: flex; flex-direction: column; gap: 20px; }
.bg-field { display: flex; flex-direction: column; gap: 6px; }
.bg-field label { font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--text-light); }
.bg-field input { padding: 12px 16px; border: 1px solid var(--border); border-radius: 6px; font-size: 15px; font-family: var(--font-body); }
.bg-field input:focus { outline: none; border-color: var(--accent); }
.bg-btn { padding: 14px 28px; background: var(--accent); color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: background .3s ease; }
.bg-btn:hover { background: var(--accent-hover); }
.bg-btn:disabled { opacity: .5; cursor: not-allowed; }
.bg-status { padding: 16px; border-radius: 6px; line-height: 1.7; font-size: 14px; display: none; }
.bg-status.loading { display: block; background: #fff3cd; color: #856404; }
.bg-status.success { display: block; background: #d4edda; color: #155724; }
.bg-status.error { display: block; background: #f8d7da; color: #721c24; }
.bg-status a { color: inherit; text-decoration: underline; font-weight: 600; }
.bg-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #856404; border-top-color: transparent; border-radius: 50%; animation: bg-spin .6s linear infinite; vertical-align: middle; margin-right: 8px; }
@keyframes bg-spin { to { transform: rotate(360deg); } }
.bg-hint { font-size: 13px; color: var(--text-muted); text-align: center; margin-top: 8px; }
</style>

<div class="bg-container">
  <p style="color:var(--text-light);margin-bottom:32px;">Enter a brand name and your affiliate link. The system will generate a landing page + 3 blog articles and publish them automatically.</p>

  <form id="brandForm" class="bg-form">
    <div class="bg-field">
      <label for="brand">Brand Name</label>
      <input type="text" id="brand" placeholder="e.g. Merry People" required>
    </div>
    <div class="bg-field">
      <label for="url">Affiliate URL</label>
      <input type="url" id="url" placeholder="https://app.partnermatic.com/track/..." required>
    </div>
    <div class="bg-field">
      <label for="password">Admin Password</label>
      <input type="password" id="password" placeholder="Enter admin password" required>
    </div>
    <button type="submit" class="bg-btn" id="submitBtn">Generate &amp; Publish</button>
  </form>

  <div id="status" class="bg-status"></div>
  <p class="bg-hint">This may take 1-2 minutes. The site will auto-deploy after generation.</p>
</div>

<script>
document.getElementById('brandForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const brand = document.getElementById('brand').value.trim();
  const url = document.getElementById('url').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!brand || !url || !password) return;

  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('status');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  status.className = 'bg-status loading';
  status.innerHTML = '<span class="bg-spinner"></span>Calling DeepSeek API to generate content...';

  try {
    const res = await fetch('/api/generate-brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, affiliateUrl: url, password })
    });
    const data = await res.json();

    if (data.success) {
      status.className = 'bg-status success';
      let html = '<strong>Published!</strong><br><br>';
      data.files.forEach(f => {
        const path = f.replace(/^content\//, '');
        const url = path.replace(/^brands\/(.+)\/index\.md$/, '/brands/$1/')
                        .replace(/^posts\/(.+)\.md$/, '/posts/$1/')
                        .replace(/\/index\.md$/, '/');
        html += '<a href="https://www.attafashion.com' + url + '" target="_blank">' + path + '</a><br>';
      });
      html += '<br><small>Cloudflare build will complete in ~2 minutes.</small>';
      status.innerHTML = html;
    } else {
      status.className = 'bg-status error';
      status.innerHTML = '<strong>Error:</strong> ' + (data.error || 'Unknown error');
    }
  } catch (err) {
    status.className = 'bg-status error';
    status.innerHTML = '<strong>Error:</strong> ' + err.message;
  }

  btn.disabled = false;
  btn.textContent = 'Generate & Publish';
});
</script>
