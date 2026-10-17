/* Runs inside every unlocked page: sign-out links, and read-only mode for guests.
   Guests can explore the demo (inject faults, run checks, read the AI's diagnosis) but cannot change
   settings or approve fixes. */
(function () {
  'use strict';
  var U = window.AIOPS_USER || { role: 'viewer' };
  var admin = U.role === 'admin';
  var LOCKED = '[data-p="settings"], [data-p="prompts"], #ctl, [data-ctl-on], #interval, [data-locked]';
  var MSG = 'This is managed by Lakhshit. Please contact Lakhshit Kumar.';
  var APPROVE = '#apYes, #apNo, [data-approve], [data-reject]';
  var APPROVE_MSG = 'Fixes are approved by Lakhshit. Please contact Lakhshit Kumar to approve or reject this fix.';

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

  // Guests cannot approve or reject. They can email Lakhshit an approval request with the incident's details.
  var requestTo = null;
  try { fetch('/users.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (db) { requestTo = db.request_to || ''; }).catch(function () {}); } catch (x) {}

  function currentIncident() {
    try {
      // the dashboard keeps its state in globals S (latest state) and selInc (incident on screen)
      /* global S, selInc */
      return ((typeof S !== 'undefined' && S && S.incidents) || []).find(function (i) { return i.id === (typeof selInc !== 'undefined' ? selInc : null); }) || null;
    } catch (x) { return null; }
  }

  function askApproval(reject) {
    var inc = currentIncident();
    var id = inc ? inc.id : 'this incident';
    var fix = inc && inc.op ? inc.op + (inc.target ? ' ' + inc.target : '') : 'the proposed fix';
    if (!requestTo) { notice(esc(APPROVE_MSG)); return; }
    notice('Only Lakhshit can approve or reject fixes. Send him a request to <b>' + (reject ? 'reject' : 'approve') + '</b> <b>' + esc(fix) +
           '</b> for ' + esc(id) + '?<br><span style="color:#4E6467;font-size:13.5px">This demo runs in your browser, so the details go in the email.</span>',
      'Approval needed from Lakhshit', {
        label: 'Email approval request', run: function () {
          var whoEl = document.getElementById('apWho');
          var who = (whoEl && whoEl.value.trim()) || U.user || 'guest';
          var body = 'Hi Lakhshit,\n\n' + who + ' asks you to ' + (reject ? 'REJECT' : 'APPROVE') + ' the fix for ' + id + ' in the AI operations demo.\n\n' +
            'Check: ' + ((inc && inc.check) || '-') + '\n' +
            'Root cause (AI): ' + ((inc && inc.root_cause) || '-') + '\n' +
            'Business impact: ' + ((inc && inc.impact) || '-') + '\n' +
            'Proposed fix: ' + fix + '\n\n' +
            'Sent from ' + location.origin + location.pathname + '\n\nThanks,\n' + who;
          location.href = 'mailto:' + requestTo + '?subject=' + encodeURIComponent('Approval request: ' + id + ' (' + fix + ')') + '&body=' + encodeURIComponent(body);
          notice('Your email app has opened with the request to Lakhshit. Press <b>Send</b> there. The fix stays on hold until he approves it.', 'Almost done');
        }
      });
  }

  function block(e) {
    var ap = e.target && e.target.closest && e.target.closest(APPROVE);
    var t = ap || (e.target && e.target.closest && e.target.closest(LOCKED));
    if (!t) return;
    if (e.type === 'keydown' && !/^(Enter| |ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === 'mousedown') return;
    if (ap) askApproval(!!ap.closest('#apNo, [data-reject]')); else notice(esc(MSG));
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
