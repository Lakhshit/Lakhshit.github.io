/* Runs inside every unlocked page: sign-out links, and read-only mode for guests.
   Guests can explore the demo (inject faults, run checks, read the AI's diagnosis, approve fixes; it all
   runs in their own browser) but cannot change settings or see the prompts. */
(function () {
  'use strict';
  var U = window.AIOPS_USER || { role: 'viewer' };
  var admin = U.role === 'admin';
  var LOCKED = '[data-p="settings"], [data-p="prompts"], #ctl, [data-ctl-on], #interval, [data-locked]';
  var MSG = 'This is managed by Lakhshit. Please contact Lakhshit Kumar.';

  function signout(e) { e.preventDefault(); if (window.AIOPS_SIGNOUT) window.AIOPS_SIGNOUT(); else { try { sessionStorage.removeItem('aiops-session'); localStorage.removeItem('aiops-session'); } catch (x) {} location.href = '/'; } }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // One dialog for every guest message. `action` adds a second button: {label, run}.
  function notice(msg, title, action) {
    var d = document.getElementById('aiops-lock');
    if (!d) {
      d = document.createElement('div');
      d.id = 'aiops-lock';
      d.setAttribute('role', 'alertdialog');
      d.setAttribute('aria-modal', 'true');
      d.setAttribute('aria-labelledby', 'aiops-lock-t');
      d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:16px;background:rgba(10,20,22,.45)';
      d.innerHTML = '<div style="max-width:420px;width:100%;background:#fff;color:#12282B;border-radius:14px;padding:24px;font:15px/1.5 system-ui,Segoe UI,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
        '<b id="aiops-lock-t" style="display:block;font-size:17px;margin-bottom:6px"></b><div id="aiops-lock-m"></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button type="button" id="aiops-lock-go" style="padding:9px 18px;border:0;border-radius:8px;background:#0D6B60;color:#fff;font:inherit;font-weight:600;cursor:pointer"></button>' +
        '<button type="button" id="aiops-lock-ok" style="padding:9px 18px;border-radius:8px;border:1.5px solid #12282B;background:#fff;color:#12282B;font:inherit;font-weight:600;cursor:pointer"></button></div></div>';
      d.addEventListener('click', function (e) { if (e.target === d || e.target.id === 'aiops-lock-ok') d.hidden = true; });
      document.body.appendChild(d);
    }
    d.querySelector('#aiops-lock-t').textContent = title || 'View-only access';
    d.querySelector('#aiops-lock-m').innerHTML = msg || esc(MSG);
    var go = d.querySelector('#aiops-lock-go'), ok = d.querySelector('#aiops-lock-ok');
    go.hidden = !action;
    ok.textContent = action ? 'Cancel' : 'OK';
    if (action) { go.textContent = action.label; go.onclick = action.run; }
    d.hidden = false;
    (action ? go : ok).focus();
  }

  function block(e) {
    var t = e.target && e.target.closest && e.target.closest(LOCKED);
    if (!t) return;
    if (e.type === 'keydown' && !/^(Enter| |ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === 'mousedown') return;
    notice(esc(MSG));
  }

  function ready() {
    if (location.hash) { var h = document.getElementById(location.hash.slice(1)); if (h) setTimeout(function () { h.scrollIntoView(); }, 50); }
    document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-signout]'); if (a) signout(e); }, true);
    // A sign-out link on pages that do not have one in their own menu
    if (!document.querySelector('[data-signout]')) {
      var host = document.querySelector('.rail .foot') || document.querySelector('header nav');
      if (host) {
        var a = document.createElement('a');
        a.href = '#'; a.setAttribute('data-signout', ''); a.style.color = 'inherit';
        a.textContent = 'Sign out (' + U.user + ')';
        host.appendChild(document.createTextNode(' '));
        host.appendChild(a);
      }
    }
    if (admin) return;
    document.querySelectorAll('[data-admin-only]').forEach(function (el) { el.remove(); });
    ['click', 'mousedown', 'keydown'].forEach(function (t) { document.addEventListener(t, block, true); });
    document.querySelectorAll('[data-p="settings"], [data-p="prompts"]').forEach(function (el) { el.title = 'Managed by Lakhshit'; });
    var st = document.createElement('style');
    st.textContent = '.aiops-prompt{display:none!important}';
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
