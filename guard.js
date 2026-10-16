/* Runs inside every unlocked page: sign-out links, and read-only mode for guests.
   Guests can explore the demo (inject faults, run checks, approve fixes) but cannot change settings. */
(function () {
  'use strict';
  var U = window.AIOPS_USER || { role: 'viewer' };
  var admin = U.role === 'admin';
  var LOCKED = '[data-p="settings"], [data-p="prompts"], #ctl, [data-ctl-on], #interval, [data-locked]';
  var MSG = 'This is managed by Lakhshit. Please contact Lakhshit Kumar.';

  function signout(e) { e.preventDefault(); if (window.AIOPS_SIGNOUT) window.AIOPS_SIGNOUT(); else { try { localStorage.removeItem('aiops-session'); } catch (x) {} location.href = '/'; } }

  function notice() {
    var d = document.getElementById('aiops-lock');
    if (!d) {
      d = document.createElement('div');
      d.id = 'aiops-lock';
      d.setAttribute('role', 'alertdialog');
      d.setAttribute('aria-modal', 'true');
      d.setAttribute('aria-labelledby', 'aiops-lock-t');
      d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:16px;background:rgba(10,20,22,.45)';
      d.innerHTML = '<div style="max-width:380px;width:100%;background:#fff;color:#12282B;border-radius:14px;padding:24px;font:15px/1.5 system-ui,Segoe UI,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
        '<b id="aiops-lock-t" style="display:block;font-size:17px;margin-bottom:6px">View-only access</b><span>' + MSG + '</span>' +
        '<button type="button" style="display:block;margin-top:18px;padding:9px 18px;border:0;border-radius:8px;background:#0D6B60;color:#fff;font:inherit;font-weight:600;cursor:pointer">OK</button></div>';
      d.addEventListener('click', function (e) { if (e.target === d || e.target.tagName === 'BUTTON') d.hidden = true; });
      document.body.appendChild(d);
    }
    d.hidden = false;
    d.querySelector('button').focus();
  }

  function block(e) {
    var t = e.target && e.target.closest && e.target.closest(LOCKED);
    if (!t) return;
    if (e.type === 'keydown' && !/^(Enter| |ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type !== 'mousedown') notice();
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
