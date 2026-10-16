/* Sign-in for aiops.lakhshit.in.
   Every page is published encrypted (AES-GCM). A user's password unlocks only the page keys of that user's role,
   so a guest cannot open the live pages even by reading the page source. Built by website/protect.py. */
(function () {
  'use strict';
  var STORE = 'aiops-session', HOURS = 12;
  var P = window.AIOPS_PAGE;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && s.exp > Date.now()) return s; } catch (e) {}
    return window.__aiopsSession || null;
  }
  function save(s) { window.__aiopsSession = s; try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }
  function clear() { window.__aiopsSession = null; try { localStorage.removeItem(STORE); } catch (e) {} }
  window.AIOPS_SIGNOUT = function () { clear(); location.href = '/'; };

  async function aes(keyBytes, iv, ct) {
    var k = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k, ct));
  }

  async function signIn(user, pass) {
    var r = await fetch('/users.json', { cache: 'no-store' });
    var db = await r.json();
    var id = hex(await crypto.subtle.digest('SHA-256', enc.encode('aiops:' + user.trim().toLowerCase())));
    var u = db.users[id];
    if (!u) throw new Error('bad');
    var base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(u.salt), iterations: db.iter }, base, 256);
    var info = JSON.parse(dec.decode(await aes(new Uint8Array(bits), b64(u.iv), b64(u.ct))));
    return { user: info.name, role: info.role, keys: info.keys, exp: Date.now() + HOURS * 3600e3 };
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
    '.alt{background:transparent;color:var(--ink);border:1px solid var(--line);margin-top:10px}';
  var MARK = '<div class="mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 32 32"><path d="M7 17h5l3-7 4 13 3-6h3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';

  function shell(inner) {
    document.title = 'AI Operations Strategy';
    document.head.insertAdjacentHTML('beforeend', '<style>' + CSS + '</style>');
    document.body.innerHTML = '<main class="gate"><div class="box">' + MARK + inner + '</div></main>';
  }

  function showLogin(msg) {
    shell('<h1>AI Operations Strategy</h1><p>This site contains AI strategy material prepared for leadership. Access is by invitation.</p>' +
      '<form id="f" autocomplete="on"><label for="u">Username</label><input id="u" name="username" autocomplete="username" required autocapitalize="none" spellcheck="false">' +
      '<label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required>' +
      '<div class="err" id="e" role="alert">' + (msg || '') + '</div><button id="b" type="submit">Sign in</button></form>' +
      '<p class="fine">Need access? Please contact Lakhshit Kumar.</p>');
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

  function showRestricted() {
    shell('<h1>Restricted area</h1><p>The live system is available to Lakhshit only. For a walkthrough, please contact Lakhshit Kumar.</p>' +
      '<a class="btn" href="/">Back to the site</a><button class="alt" type="button" onclick="AIOPS_SIGNOUT()">Sign in as someone else</button>');
  }

  async function open(s) {
    if (!s.keys[P.key]) return showRestricted();
    var html;
    try { html = dec.decode(await aes(b64(s.keys[P.key]), b64(P.iv), b64(P.ct))); }
    catch (x) { clear(); return showLogin('Your session has expired. Please sign in again.'); }
    var who = '<script>window.AIOPS_USER=' + JSON.stringify({ user: s.user, role: s.role }) + '<\/script><script src="/guard.js"><\/script>';
    var i = html.search(/<\/head>/i);
    html = i < 0 ? who + html : html.slice(0, i) + who + html.slice(i);
    document.open(); document.write(html); document.close();
  }

  if (!window.crypto || !crypto.subtle) {
    document.body.innerHTML = '<p style="padding:24px">Please open this site over https://aiops.lakhshit.in in a current browser.</p>';
    return;
  }
  var s = load();
  if (s) open(s); else showLogin();
})();
