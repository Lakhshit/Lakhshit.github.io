/* Sign-in for aiops.lakhshit.in.
   Every page is published encrypted (AES-GCM). A user's password unlocks only the page keys of that user's role,
   so a guest cannot open the live pages even by reading the page source. Built by website/protect.py. */
(function () {
  'use strict';
  // Signed in per browser tab: kept while moving between pages in this tab, gone when the tab or browser closes,
  // and ended after 30 minutes without opening a page. A new tab always asks again.
  var STORE = 'aiops-session', IDLE_MIN = 30;
  try { localStorage.removeItem(STORE); } catch (e) {}  // drop sign-ins remembered by the old 12-hour version
  var P = window.AIOPS_PAGE;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function load() {
    // A refresh (F5) always asks again; following a link on the site keeps the sign-in for this tab.
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'reload') { clear(); return null; }
    } catch (e) {}
    try {
      var s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (s && s.exp > Date.now()) { s.exp = Date.now() + IDLE_MIN * 60e3; save(s); return s; }
      sessionStorage.removeItem(STORE);
    } catch (e) {}
    return window.__aiopsSession || null;
  }
  function save(s) { window.__aiopsSession = s; try { sessionStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }
  function clear() { window.__aiopsSession = null; try { sessionStorage.removeItem(STORE); } catch (e) {} }
  window.AIOPS_SIGNOUT = function () { clear(); location.href = '/'; };
  window.AIOPS_SWITCH = function () { clear(); showLogin(); };   // sign in as someone else, staying on this page

  async function aes(keyBytes, iv, ct) {
    var k = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k, ct));
  }

  var dbPromise = null;
  function getDb() { if (!dbPromise) dbPromise = fetch('/users.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); return dbPromise; }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  async function signIn(user, pass) {
    var db = await getDb();
    var id = hex(await crypto.subtle.digest('SHA-256', enc.encode('aiops:' + user.trim().toLowerCase())));
    var u = db.users[id];
    if (!u) throw new Error('bad');
    var base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(u.salt), iterations: db.iter }, base, 256);
    var info = JSON.parse(dec.decode(await aes(new Uint8Array(bits), b64(u.iv), b64(u.ct))));
    return { user: info.name, role: info.role, keys: info.keys, exp: Date.now() + IDLE_MIN * 60e3 };
  }

  var CSS = ':root{--ink:#12282B;--muted:#4E6467;--line:#CBD5D2;--paper:#F3F6F5;--card:#fff;--teal:#0D6B60;--teal-2:#0A574E;--red:#B0362C;--field:#F6F8F7;--on-teal:#fff}' +
    '@media (prefers-color-scheme:dark){:root{--ink:#E4ECEA;--muted:#9DB0AD;--line:#2F4245;--paper:#0C1719;--card:#132426;--teal:#3FA796;--teal-2:#2F8C7D;--red:#E07A70;--field:#0F1E20;--on-teal:#04201C}}' +
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--paper);color:var(--ink);font:16px/1.5 "Schibsted Grotesk","Segoe UI Variable","Segoe UI",system-ui,sans-serif}' +
    '.gate{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}' +
    /* left: the story */
    '.story{position:relative;overflow:hidden;color:#EAF6F3;padding:48px 56px;display:flex;flex-direction:column;gap:28px;' +
      'background:radial-gradient(900px 500px at 15% 0%,rgba(79,224,197,.22),transparent 60%),radial-gradient(700px 600px at 100% 100%,rgba(53,87,201,.25),transparent 60%),linear-gradient(160deg,#06302B,#0B4A43 55%,#0A2E3A)}' +
    '.story:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:22px 22px;pointer-events:none}' +
    '.brand{display:flex;align-items:center;gap:12px;position:relative}.brand .mk{width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);display:grid;place-items:center}' +
    '.brand b{font-size:17px;letter-spacing:-.01em}.brand span{display:block;font-size:12.5px;color:rgba(234,246,243,.7)}' +
    '.story h2{position:relative;margin:auto 0 0;font-size:clamp(28px,3.1vw,42px);line-height:1.12;letter-spacing:-.025em;max-width:16ch;font-weight:700}' +
    '.story h2 em{font-style:normal;color:#7FE3D0}.story .lede{position:relative;margin:0;max-width:46ch;color:rgba(234,246,243,.78);font-size:16px}' +
    '.pipe{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:6px}' +
    '.pipe:before{content:"";position:absolute;left:8%;right:8%;top:19px;height:2px;background:linear-gradient(90deg,transparent,rgba(127,227,208,.9),transparent) 0 0/40% 100% no-repeat,rgba(255,255,255,.14);animation:flow 3.2s linear infinite}' +
    '.pipe div{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px}' +
    '.pipe i{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#0B3F39;border:1px solid rgba(255,255,255,.22);animation:lit 5s infinite}' +
    '.pipe div:nth-child(2) i{animation-delay:1s}.pipe div:nth-child(3) i{animation-delay:2s}.pipe div:nth-child(4) i{animation-delay:3s}.pipe div:nth-child(5) i{animation-delay:4s}' +
    '.pipe b{font-size:13px;line-height:1.2}.pipe small{font-size:11px;color:rgba(234,246,243,.65);letter-spacing:.02em}' +
    '@keyframes flow{from{background-position:-40% 0,0 0}to{background-position:140% 0,0 0}}' +
    '@keyframes lit{0%,16%{background:#1E8C7B;border-color:#7FE3D0;box-shadow:0 0 0 6px rgba(127,227,208,.15)}24%,100%{background:#0B3F39;border-color:rgba(255,255,255,.22);box-shadow:none}}' +
    '.facts{position:relative;display:flex;flex-wrap:wrap;gap:10px 28px;padding-top:18px;border-top:1px solid rgba(255,255,255,.14)}' +
    '.facts div{display:flex;flex-direction:column}.facts b{font-size:24px;letter-spacing:-.02em}.facts span{font-size:12.5px;color:rgba(234,246,243,.7)}' +
    /* right: the form */
    '.side{display:flex;flex-direction:column;justify-content:center;align-items:center;padding:40px 24px;gap:18px}' +
    '.box{width:100%;max-width:410px;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:34px 32px;box-shadow:0 24px 60px -30px rgba(10,40,36,.35)}' +
    '.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--teal);margin-bottom:10px}' +
    '.eyebrow:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 22%,transparent)}' +
    'h1{font-size:28px;line-height:1.2;margin:0 0 8px;letter-spacing:-.02em}p{margin:0 0 20px;color:var(--muted);font-size:15px}' +
    'label{display:block;font-size:13px;font-weight:600;margin:16px 0 7px}' +
    '.field{position:relative}.field svg.ic{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}' +
    'input{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:12px;background:var(--field);color:var(--ink);font:inherit;transition:border-color .15s,box-shadow .15s}' +
    '.field input{padding-left:40px}.field.pw input{padding-right:46px}' +
    'input:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 18%,transparent)}' +
    '.eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;border-radius:9px;background:transparent;color:var(--muted);cursor:pointer;display:grid;place-items:center}' +
    '.eye:hover{color:var(--ink)}.eye:focus-visible{outline:2px solid var(--teal)}' +
    '.btn-p,.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-top:22px;padding:13px;border:0;border-radius:12px;background:var(--teal);color:var(--on-teal);font:inherit;font-weight:700;cursor:pointer;text-decoration:none;transition:background .15s,transform .05s}' +
    '.btn-p:hover,.btn:hover{background:var(--teal-2)}.btn-p:active{transform:translateY(1px)}.btn-p:focus-visible{outline:3px solid color-mix(in srgb,var(--teal) 40%,transparent);outline-offset:2px}' +
    '.btn-p[disabled]{opacity:.75;cursor:wait}.spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;animation:sp .7s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}' +
    '.alt{background:transparent;color:var(--ink);border:1px solid var(--line);margin-top:10px}.alt:hover{background:var(--field)}' +
    '.err{color:var(--red);font-size:14px;min-height:21px;margin:12px 0 0}.err:not(:empty){animation:shake .35s}@keyframes shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}' +
    '.fine{font-size:13px;margin:20px 0 0;text-align:center}.fine a{color:var(--teal);font-weight:600}' +
    '.safe{display:flex;align-items:center;justify-content:center;gap:7px;font-size:12.5px;color:var(--muted);margin:0;text-align:center}' +
    '.ai{display:flex;flex-wrap:wrap;gap:6px;position:relative}.ai span{font-size:12px;font-weight:600;padding:4px 10px;border-radius:99px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#EAF6F3}' +
    '.copy{font-size:12px;color:var(--muted);margin:0}' +
    '.dest{display:flex;flex-direction:column;gap:10px;margin-top:18px}.dest a{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:var(--field);color:var(--ink);text-decoration:none;transition:border-color .15s,transform .1s,box-shadow .15s}' +
    '.dest a:hover,.dest a:focus-visible{border-color:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 14%,transparent);outline:none}.dest a:active{transform:translateY(1px)}' +
    '.dest i{flex:none;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--teal);color:var(--on-teal)}' +
    '.dest span{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.dest b{font-size:15.5px}.dest small{font-size:13px;color:var(--muted);line-height:1.4}.dest em{font-style:normal;color:var(--teal);font-size:18px}' +
    '.ai.mob{display:none}@media (max-width:900px){.ai.mob{display:flex}.gate{grid-template-columns:1fr}.story{padding:28px 20px;gap:18px}.story h2{margin-top:6px;font-size:26px}.pipe,.facts{display:none}.side{padding:24px 16px 32px}.box{padding:28px 22px}}' +
    '@media (prefers-reduced-motion:reduce){.pipe:before,.pipe i,.spin,.err:not(:empty){animation:none}}';
  var AI_CHIPS = '<div class="ai" aria-label="AI inside"><span>Machine learning</span><span>Deep learning</span><span>RAG</span><span>Generative AI</span><span>Agentic AI</span><span>Responsible AI</span></div>';
  var MARK_SVG = '<svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 17h5l3-7 4 13 3-6h3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IC = {
    user: '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5"/></svg>',
    lock: '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
    eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    shield: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>'
  };
  var STAGES = [['Detect', 'ML · DL', '<path d="M3 12h4l2-5 4 10 2-5h6"/>'], ['Recall', 'RAG · memory', '<path d="M4 6h16M4 12h10M4 18h7"/>'],
                ['Diagnose', 'Generative AI', '<path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Z"/><path d="M9.5 22h5"/>'],
                ['Act', 'Agentic AI', '<path d="M5 12h14M13 6l6 6-6 6"/>'], ['Guard', 'Responsible AI', '<path d="M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Z"/>']];

  var TITLE = P.title || 'AI Operations Strategy';
  var TEXT = P.text != null ? P.text : 'This site contains AI strategy material prepared for leadership. Access is by invitation.';
  function story() {
    var live = P.key === 'live';
    return '<div class="brand"><span class="mk">' + MARK_SVG + '</span><div><b>AI Operations</b><span>by Lakhshit Kumar</span></div></div>' +
      (live ? '<h2>Live system. <em>Presenter console.</em></h2><p class="lede">Running on Kubernetes with a private AI model and real approval pipelines.</p>'
            : '<h2>AI that finds the problem, <em>explains it</em>, and asks before it fixes.</h2>') +
      '<div class="pipe" aria-hidden="true">' + STAGES.map(function (s) {
        return '<div><i><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EAF6F3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + s[2] + '</svg></i><b>' + s[0] + '</b><small>' + s[1] + '</small></div>';
      }).join('') + '</div>' +
      (live ? '' : '<div class="ai mob">' + AI_CHIPS.replace(/^<div class="ai" aria-label="AI inside">|<\/div>$/g, '') + '</div>') +
      '<div class="facts"><div><b>6</b><span>AI techniques</span></div><div><b>10</b><span>safety controls</span></div><div><b>1</b><span>human decision</span></div></div>';
  }
  function shell(inner) {
    document.title = TITLE + ' · Sign in';
    if (!document.getElementById('gate-css')) document.head.insertAdjacentHTML('beforeend', '<style id="gate-css">' + CSS + '</style>');
    document.body.innerHTML = '<main class="gate"><aside class="story">' + story() + '</aside><section class="side"><div class="box">' + inner + '</div>' +
      '<p class="copy">© Lakhshit Kumar · private preview</p></section></main>';
  }

  function showLogin(msg) {
    shell('<span class="eyebrow">' + esc(TITLE) + '</span><h1>Sign in</h1>' + (TEXT ? '<p>' + esc(TEXT) + '</p>' : '') +
      '<form id="f" autocomplete="on"><label for="u">Username</label><div class="field">' + IC.user +
      '<input id="u" name="username" autocomplete="username" required autocapitalize="none" spellcheck="false" placeholder="Your username"></div>' +
      '<label for="pw">Password</label><div class="field pw">' + IC.lock +
      '<input id="pw" name="password" type="password" autocomplete="current-password" required placeholder="Your password">' +
      '<button class="eye" type="button" id="eye" aria-label="Show password" aria-pressed="false">' + IC.eye + '</button></div>' +
      '<div class="err" id="e" role="alert">' + (msg || '') + '</div><button class="btn-p" id="b" type="submit">Sign in</button></form>' +
      '<p class="fine" id="req">' + (P.key === 'live' ? '' : 'Need access? Please contact Lakhshit Kumar.') + '</p>' +
      '<p class="safe">' + IC.shield + 'Your password never leaves this browser.</p>');
    getDb().then(function (db) {
      if (db.request_to && P.key !== 'live') document.getElementById('req').innerHTML = 'No account yet? <a href="#request-access" id="reqa">Request access</a>';
      var a = document.getElementById('reqa'); if (a) a.onclick = function (ev) { ev.preventDefault(); showRequest(); };
    }).catch(function () {});
    var f = document.getElementById('f'), b = document.getElementById('b'), e = document.getElementById('e'), pw = document.getElementById('pw'), eye = document.getElementById('eye');
    eye.onclick = function () { var show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; eye.setAttribute('aria-pressed', show); eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); pw.focus(); };
    document.getElementById('u').focus();
    f.onsubmit = async function (ev) {
      ev.preventDefault(); b.disabled = true; b.innerHTML = '<span class="spin" aria-hidden="true"></span>Signing in…'; e.textContent = '';
      try {
        var s = await signIn(f.username.value, f.password.value);
        save(s); if (P.home) showHome(s); else open(s);
      } catch (x) {
        e.textContent = ''; void e.offsetWidth; e.textContent = 'Username or password is incorrect.'; b.disabled = false; b.textContent = 'Sign in';
      }
    };
  }

  async function showRequest() {
    var db = {};
    try { db = await getDb(); } catch (x) {}
    if (!db.request_to) return showLogin();
    shell('<span class="eyebrow">' + esc(TITLE) + '</span><h1>Request access</h1><p>If Lakhshit approves, you will get a username and password by email.</p>' +
      '<form id="rq"><label for="rn">Full name</label><input id="rn" name="n" autocomplete="name" required>' +
      '<label for="re">Work email</label><input id="re" name="e" type="email" autocomplete="email" required>' +
      '<label for="rt">Team or organisation</label><input id="rt" name="t" autocomplete="organization">' +
      '<label for="rw">Why do you need access?</label><input id="rw" name="w" placeholder="e.g. leadership review, AI ops evaluation">' +
      '<button class="btn-p" type="submit">Send request</button></form>' +
      '<button class="btn-p alt" type="button" id="back">Back to sign in</button>');
    document.getElementById('rn').focus();
    document.getElementById('back').onclick = function () { history.replaceState(null, '', location.pathname); showLogin(); };
    document.getElementById('rq').onsubmit = function (ev) {
      ev.preventDefault();
      var f = ev.target, n = f.n.value.trim(), e = f.e.value.trim(), t = f.t.value.trim(), w = f.w.value.trim();
      var body = 'Hi Lakhshit,\n\nPlease give me access to the ' + TITLE + ' at ' + location.origin + location.pathname + '\n\n' +
        'Name: ' + n + '\nEmail: ' + e + '\nTeam: ' + (t || '-') + '\nReason: ' + (w || '-') + '\n\nThanks,\n' + n;
      location.href = 'mailto:' + db.request_to + '?subject=' + encodeURIComponent('Access request: ' + TITLE + ' (' + n + ')') +
        '&body=' + encodeURIComponent(body);
      shell('<span class="eyebrow">Request access</span><h1>Almost done</h1><p>Your email app has opened with the request ready. Press <b>Send</b> there. ' +
        'Lakhshit will reply with your sign-in details.</p><p>If nothing opened, email <b>' + esc(db.request_to) +
        '</b> with your name and why you need access.</p><a class="btn" href="/">Back to the site</a>');
    };
  }

  function showHome(s) {
    var first = String(s.user || '').replace(/^\w/, function (c) { return c.toUpperCase(); });
    var go = [['/demo/', 'Interactive demo', 'Try it yourself: inject a problem and watch the AI find, explain and fix it.', '<path d="M8 5v14l11-7L8 5Z"/>']];
    if (s.keys && s.keys.live) go.push(['/live/', 'Live system', 'Presenter console: the Kubernetes lab with the private AI model.', '<circle cx="12" cy="12" r="3"/><path d="M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0"/>']);
    if (go.length === 1) { location.href = go[0][0]; return; }   // guests: straight to the demo
    shell('<span class="eyebrow">Signed in as ' + esc(first) + '</span><h1>Where would you like to go?</h1>' +
      '<div class="dest">' + go.map(function (g) {
        return '<a href="' + g[0] + '"><i><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + g[3] + '</svg></i>' +
          '<span><b>' + g[1] + '</b><small>' + g[2] + '</small></span><em aria-hidden="true">→</em></a>'; }).join('') + '</div>' +
      '<p class="fine"><a href="#" onclick="AIOPS_SIGNOUT();return false">Sign out</a></p>');
    var a = document.querySelector('.dest a'); if (a) a.focus();
  }

  function showRestricted() {
    shell('<span class="eyebrow">Live system</span><h1>Restricted area</h1><p>The live system is available to Lakhshit only. For a walkthrough, please contact Lakhshit Kumar.</p>' +
      '<a class="btn" href="/">Back to the site</a><button class="btn-p alt" type="button" onclick="AIOPS_SWITCH()">Sign in as someone else</button>');
  }

  async function open(s) {
    if (!s.keys[P.key]) return showRestricted();
    var html;
    try { html = dec.decode(await aes(b64(s.keys[P.key]), b64(P.iv), b64(P.ct))); }
    catch (x) { clear(); return showLogin('Your session has expired. Please sign in again.'); }
    var who = '<script>window.AIOPS_USER=' + JSON.stringify({ user: s.user, role: s.role }) + '<\/script><script src="/guard.js?v=c0ab216d0d"><\/script>';
    var i = html.search(/<\/head>/i);
    html = i < 0 ? who + html : html.slice(0, i) + who + html.slice(i);
    document.open(); document.write(html); document.close();
  }

  if (!window.crypto || !crypto.subtle) {
    document.body.innerHTML = '<p style="padding:24px">Please open this site over https://aiops.lakhshit.in in a current browser.</p>';
    return;
  }
  var s = load();
  if (s) { if (P.home) showHome(s); else open(s); } else if (location.hash === '#request-access') showRequest(); else showLogin();
})();
