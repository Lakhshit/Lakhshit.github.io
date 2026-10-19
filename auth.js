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

  var CSS = ':root{--ink:#12282B;--muted:#4E6467;--line:#C9D3D0;--paper:#EEF2F0;--card:#fff;--teal:#0D6B60;--red:#B0362C}' +
    '@media (prefers-color-scheme:dark){:root{--ink:#E4ECEA;--muted:#9DB0AD;--line:#2F4245;--paper:#0F1C1E;--card:#16282A;--teal:#4FB3A4;--red:#E07A70}}' +
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--paper);color:var(--ink);font:16px/1.5 "Schibsted Grotesk",system-ui,"Segoe UI",sans-serif}' +
    '.gate{min-height:100vh;display:grid;place-items:center;padding:24px 16px}.box{width:100%;max-width:400px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:32px 28px}' +
    '.mark{width:40px;height:40px;border-radius:10px;background:var(--teal);display:grid;place-items:center;margin-bottom:18px}' +
    'h1{font-size:23px;line-height:1.25;margin:0 0 8px;letter-spacing:-.01em}p{margin:0 0 22px;color:var(--muted);font-size:15px}' +
    'label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px}input{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font:inherit}' +
    'input:focus{outline:2px solid var(--teal);outline-offset:1px;border-color:transparent}' +
    'button,.btn{display:inline-block;width:100%;margin-top:22px;padding:12px;border:0;border-radius:10px;background:var(--teal);color:#fff;font:inherit;font-weight:600;cursor:pointer;text-align:center;text-decoration:none}' +
    'button[disabled]{opacity:.6;cursor:wait}.err{color:var(--red);font-size:14px;min-height:21px;margin:12px 0 0}.fine{font-size:12.5px;margin:22px 0 0;text-align:center}' +
    '.alt{background:transparent;color:var(--ink);border:1px solid var(--line);margin-top:10px}' +
    '.ai{display:flex;flex-wrap:wrap;gap:6px;margin:-8px 0 18px}.ai span{font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:99px;border:1px solid var(--line);color:var(--muted)}';
  var AI_CHIPS = '<div class="ai" aria-label="AI inside"><span>Deep learning</span><span>Machine learning</span><span>RAG</span><span>Agentic AI</span><span>Responsible AI</span></div>';
  var MARK = '<div class="mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 32 32"><path d="M7 17h5l3-7 4 13 3-6h3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';

  var TITLE = P.title || 'AI Operations Strategy';
  var TEXT = P.text || 'This site contains AI strategy material prepared for leadership. Access is by invitation.';
  function shell(inner) {
    document.title = TITLE;
    document.head.insertAdjacentHTML('beforeend', '<style>' + CSS + '</style>');
    document.body.innerHTML = '<main class="gate"><div class="box">' + MARK + inner + '</div></main>';
  }

  function showLogin(msg) {
    shell('<h1>' + esc(TITLE) + '</h1><p>' + esc(TEXT) + '</p>' + AI_CHIPS +
      '<form id="f" autocomplete="on"><label for="u">Username</label><input id="u" name="username" autocomplete="username" required autocapitalize="none" spellcheck="false">' +
      '<label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required>' +
      '<div class="err" id="e" role="alert">' + (msg || '') + '</div><button id="b" type="submit">Sign in</button></form>' +
      '<p class="fine" id="req">Need access? Please contact Lakhshit Kumar.</p>');
    getDb().then(function (db) {
      if (db.request_to) document.getElementById('req').innerHTML = 'No account yet? <a href="#request-access" id="reqa">Request access</a>';
      var a = document.getElementById('reqa'); if (a) a.onclick = function (ev) { ev.preventDefault(); showRequest(); };
    }).catch(function () {});
    var f = document.getElementById('f'), b = document.getElementById('b'), e = document.getElementById('e');
    document.getElementById('u').focus();
    f.onsubmit = async function (ev) {
      ev.preventDefault(); b.disabled = true; b.textContent = 'Signing in…'; e.textContent = '';
      try {
        var s = await signIn(f.username.value, f.password.value);
        save(s); open(s);
      } catch (x) {
        e.textContent = 'Username or password is incorrect.'; b.disabled = false; b.textContent = 'Sign in';
      }
    };
  }

  async function showRequest() {
    var db = {};
    try { db = await getDb(); } catch (x) {}
    if (!db.request_to) return showLogin();
    shell('<h1>Request access</h1><p>You are asking for access to the <b>' + esc(TITLE) + '</b>. If Lakhshit approves, you will get a username and password by email.</p>' +
      '<form id="rq"><label for="rn">Full name</label><input id="rn" name="n" autocomplete="name" required>' +
      '<label for="re">Work email</label><input id="re" name="e" type="email" autocomplete="email" required>' +
      '<label for="rt">Team or organisation</label><input id="rt" name="t" autocomplete="organization">' +
      '<label for="rw">Why do you need access?</label><input id="rw" name="w" placeholder="e.g. leadership review, AI ops evaluation">' +
      '<button type="submit">Send request</button></form>' +
      '<button class="alt" type="button" id="back">Back to sign in</button>');
    document.getElementById('rn').focus();
    document.getElementById('back').onclick = function () { history.replaceState(null, '', location.pathname); showLogin(); };
    document.getElementById('rq').onsubmit = function (ev) {
      ev.preventDefault();
      var f = ev.target, n = f.n.value.trim(), e = f.e.value.trim(), t = f.t.value.trim(), w = f.w.value.trim();
      var body = 'Hi Lakhshit,\n\nPlease give me access to the ' + TITLE + ' at ' + location.origin + location.pathname + '\n\n' +
        'Name: ' + n + '\nEmail: ' + e + '\nTeam: ' + (t || '-') + '\nReason: ' + (w || '-') + '\n\nThanks,\n' + n;
      location.href = 'mailto:' + db.request_to + '?subject=' + encodeURIComponent('Access request: ' + TITLE + ' (' + n + ')') +
        '&body=' + encodeURIComponent(body);
      shell('<h1>Almost done</h1><p>Your email app has opened with the request ready. Press <b>Send</b> there. ' +
        'Lakhshit will reply with your sign-in details.</p><p>If nothing opened, email <b>' + esc(db.request_to) +
        '</b> with your name and why you need access.</p><a class="btn" href="/">Back to the site</a>');
    };
  }

  function showRestricted() {
    shell('<h1>Restricted area</h1><p>The live system is available to Lakhshit only. For a walkthrough, please contact Lakhshit Kumar.</p>' +
      '<a class="btn" href="/">Back to the site</a><button class="alt" type="button" onclick="AIOPS_SIGNOUT()">Sign in as someone else</button>');
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
  if (s) open(s); else if (location.hash === '#request-access') showRequest(); else showLogin();
})();
