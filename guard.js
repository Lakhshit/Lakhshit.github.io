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

  // Guests cannot approve or reject. They email Lakhshit a request with a link; he approves on the site and sends
  // back an approval code signed with a key only his account holds. Pasting the code here applies his decision.
  var requestTo = null, approverPub = null, pending = {};
  try {
    fetch('/users.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (db) { requestTo = db.request_to || ''; approverPub = db.approver_pub || null; }).catch(function () {});
  } catch (x) {}

  function b64u(bytes) { var s = ''; bytes.forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromB64u(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var b = atob(t), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

  function currentIncident() {
    try {
      // the dashboard keeps its state in globals S (latest state) and selInc (incident on screen)
      /* global S, selInc */
      return ((typeof S !== 'undefined' && S && S.incidents) || []).find(function (i) { return i.id === (typeof selInc !== 'undefined' ? selInc : null); }) || null;
    } catch (x) { return null; }
  }

  var CODE_BOX = '<label for="aiops-code" style="display:block;font-weight:600;font-size:13.5px;margin-top:14px">Approval code from Lakhshit</label>' +
    '<textarea id="aiops-code" rows="3" style="width:100%;margin-top:6px;padding:8px;border:1px solid #C9D3D0;border-radius:8px;font:12px/1.4 ui-monospace,Consolas,monospace" placeholder="Paste the code from Lakhshit\'s reply"></textarea>' +
    '<div id="aiops-code-err" style="color:#B0362C;font-size:13.5px;min-height:1.2em;margin-top:4px"></div>';

  function applyCode(inc, req) {
    var box = document.getElementById('aiops-code'), err = document.getElementById('aiops-code-err');
    var code = (box && box.value || '').trim(), parts = code.split('.');
    function fail(m) { if (err) err.textContent = m; }
    if (parts.length !== 2) return fail('That does not look like an approval code. Copy the whole code from the email.');
    if (!approverPub) return fail('Could not load the verification key. Check your connection and try again.');
    var data, payload;
    try { data = fromB64u(parts[0]); payload = JSON.parse(new TextDecoder().decode(data)); } catch (e) { return fail('That code is damaged. Copy it again from the email.'); }
    crypto.subtle.importKey('spki', fromB64u(approverPub.replace(/\+/g, '-').replace(/\//g, '_')), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
      .then(function (k) { return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, fromB64u(parts[1]), data); })
      .then(function (ok) {
        if (!ok) return fail('This code was not signed by Lakhshit, or it was changed. Ask him to send it again.');
        if (payload.id !== inc.id || payload.nonce !== req.nonce) return fail('This code is for a different request (' + payload.id + ').');
        var approve = payload.decision === 'approve';
        return fetch('/api/' + (approve ? 'approve' : 'reject') + '/' + encodeURIComponent(inc.id), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ who: (payload.by || 'Lakhshit') + ' (by approval code)', comment: 'Decided by email at ' + payload.t })
        }).then(function () {
          delete pending[inc.id];
          notice(approve ? 'Lakhshit approved the fix for <b>' + esc(inc.id) + '</b>. The pipeline is running now: watch the dashboard recover.'
                         : 'Lakhshit rejected the fix for <b>' + esc(inc.id) + '</b>. Nothing will change.', approve ? 'Approved by Lakhshit' : 'Rejected by Lakhshit');
        });
      })
      .catch(function () { fail('Could not check the code. Try again.'); });
  }

  function waitForCode(inc, req) {
    notice('Your request for <b>' + esc(inc.id) + '</b> is with Lakhshit. When he replies with an approval code, paste it here.' + CODE_BOX +
           '<a href="#" id="aiops-resend" style="font-size:13.5px;color:#0D6B60">Send the request again</a>',
      'Waiting for Lakhshit', { label: 'Apply code', run: function () { applyCode(inc, req); } });
    document.getElementById('aiops-resend').onclick = function (e) { e.preventDefault(); sendRequest(inc, req); };
  }

  function sendRequest(inc, req) {
    var link = location.origin + '/approve-request/#r=' + b64u(new TextEncoder().encode(JSON.stringify(req)));
    window.__aiopsRequestLink = link;  // also shown nowhere else; handy for support
    var body = 'Hi Lakhshit,\n\n' + req.who + ' asks you to ' + req.decision.toUpperCase() + ' the fix for ' + req.id + ' in the AI operations demo.\n\n' +
      'Check: ' + (req.check || '-') + '\nRoot cause (AI): ' + (req.root_cause || '-') + '\nBusiness impact: ' + (req.impact || '-') + '\n' +
      'Proposed fix: ' + req.fix + '\n\nApprove or reject here (sign in as lakhshit):\n' + link + '\n\nThanks,\n' + req.who;
    location.href = 'mailto:' + requestTo + '?subject=' + encodeURIComponent('Approval request: ' + req.id + ' (' + req.fix + ')') + '&body=' + encodeURIComponent(body);
    notice('Your email app has opened with the request to Lakhshit. Press <b>Send</b> there.<br>Keep this demo tab open. When he replies with an approval code, paste it here, or later via Approve and run.' + CODE_BOX,
      'Request ready to send', { label: 'Apply code', run: function () { applyCode(inc, req); } });
  }

  function askApproval(reject) {
    var inc = currentIncident();
    if (!inc || !requestTo) { notice(esc(APPROVE_MSG)); return; }
    if (pending[inc.id]) { waitForCode(inc, pending[inc.id]); return; }
    var fix = inc.op ? inc.op + (inc.target ? ' ' + inc.target : '') : 'the proposed fix';
    notice('Only Lakhshit can approve or reject fixes. Send him a request to <b>' + (reject ? 'reject' : 'approve') + '</b> <b>' + esc(fix) +
           '</b> for ' + esc(inc.id) + '? The email includes a link for him to decide.',
      'Approval needed from Lakhshit', {
        label: 'Email approval request', run: function () {
          var whoEl = document.getElementById('apWho');
          var req = { id: inc.id, check: inc.check, root_cause: inc.root_cause, impact: inc.impact, fix: fix,
                      decision: reject ? 'reject' : 'approve', who: (whoEl && whoEl.value.trim()) || U.user || 'guest',
                      nonce: b64u(crypto.getRandomValues(new Uint8Array(9))), t: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC' };
          pending[inc.id] = req;
          sendRequest(inc, req);
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
