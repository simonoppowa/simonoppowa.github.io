/*
  Goodtime State Map web form: "Report content" (DSA Art. 16 notice) and "Contact"
  (LEG-25). Spec: docs/legal/contact-points.md §5.

  Plain JavaScript, no libraries, no cookies, no localStorage. The page sends one
  fetch request to the project's Supabase host, and only when the user taps Send.
  While the placeholders below are still in place, it sends nothing at all and
  shows "Draft: not connected yet" instead.
*/
'use strict';

(() => {
  // Fill these in before publishing (docs/web/README.md). Keep connect-src in the
  // page's Content-Security-Policy in step with SUPABASE_URL.
  const SUPABASE_URL = 'https://cofwdrhodyyvnjjbdird.supabase.co';
  const ANON_KEY = 'sb_publishable_w3eeLq2DVEHqsuDnwGkugg_MVsaeByA';
  const CONTACT_ADDRESS = 'goodtimestatemap@protonmail.com';

  const CONNECTED = !/[<>]/.test(SUPABASE_URL + ANON_KEY);

  const TABLE = { report: 'reports', contact: 'contact_messages' };
  // Same pattern as the database check constraint (§5.2).
  const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  const T = {
    de: {
      required: 'Bitte füllen Sie dieses Feld aus.',
      tooShort: 'Bitte schreiben Sie mindestens {n} Zeichen.',
      tooLong: 'Bitte kürzen Sie Ihren Text auf höchstens {n} Zeichen.',
      email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      checkbox: 'Bitte bestätigen Sie diese Erklärung.',
      rateLimit: 'Von Ihrem Anschluss kamen gerade zu viele Nachrichten. Bitte versuchen Sie es später erneut oder schreiben Sie an {contact}.',
      failed: 'Das Senden ist fehlgeschlagen. Ihre Eingaben sind noch da. Bitte versuchen Sie es erneut oder schreiben Sie an {contact}.',
      draft: 'Entwurf: noch nicht verbunden. Dieses Formular ist noch mit keinem Server verbunden, deshalb wurde nichts gesendet. Ihre Eingaben sind noch da.',
      reportTitle: 'Danke. Ihre Meldung ist eingegangen.',
      reportWithEmail: 'Referenz: {ref}. Ein Mensch prüft Ihre Meldung. Wir bestätigen Ihnen den Eingang per E-Mail an {email}. Später teilen wir Ihnen unsere Entscheidung mit und nennen Ihnen Ihre Möglichkeiten, dagegen vorzugehen. Bei akuter Gefahr wählen Sie bitte sofort den Notruf: 110 (Polizei in Deutschland) oder 112 (in der ganzen EU).',
      reportWithoutEmail: 'Referenz: {ref}. Ein Mensch prüft Ihre Meldung. Sie haben keine E-Mail-Adresse angegeben, deshalb erhalten Sie keine Rückmeldung von uns. Bei akuter Gefahr wählen Sie bitte sofort den Notruf: 110 (Polizei in Deutschland) oder 112 (in der ganzen EU).',
      contactTitle: 'Danke. Ihre Nachricht ist eingegangen.',
      contactBody: 'Referenz: {ref}. Ein Mensch liest Ihre Nachricht. Wir antworten per E-Mail an {email}.',
      again: 'Weitere Nachricht senden',
    },
    en: {
      required: 'Please fill in this field.',
      tooShort: 'Please write at least {n} characters.',
      tooLong: 'Please keep it to {n} characters or fewer.',
      email: 'Please enter a valid email address.',
      checkbox: 'Please confirm this statement.',
      rateLimit: 'Too many messages came from your connection. Please try again later or email {contact}.',
      failed: 'Sending failed. Your input is still here. Please try again or email {contact}.',
      draft: 'Draft: not connected yet. This form is not connected to a server yet, so nothing was sent. Your input is still here.',
      reportTitle: 'Thank you. We received your report.',
      reportWithEmail: 'Reference: {ref}. A person will review your report. We will confirm receipt by email to {email}. Later we will tell you our decision and how you can challenge it. In an emergency, call the emergency number right away: 110 (police in Germany) or 112 (anywhere in the EU).',
      reportWithoutEmail: 'Reference: {ref}. A person will review your report. You gave no email address, so you will not hear back from us. In an emergency, call the emergency number right away: 110 (police in Germany) or 112 (anywhere in the EU).',
      contactTitle: 'Thank you. We received your message.',
      contactBody: 'Reference: {ref}. A person will read your message. We will reply by email to {email}.',
      again: 'Send another message',
    },
  };

  const $ = (id) => document.getElementById(id);
  const app = $('form-app');
  const form = $('gs-form');
  const statusBox = $('form-status');
  const confirmBox = $('form-confirm');
  const confirmText = $('confirm-text');
  const againButton = $('f-again');
  const sendButton = $('f-send');
  const csamHint = $('h-csam');
  const modeInputs = Array.from(form.querySelectorAll('input[name="mode"]'));
  const reasonInputs = Array.from(form.querySelectorAll('input[name="reason"]'));
  const f = {
    location: $('f-location'),
    explanation: $('f-explanation'),
    name: $('f-name'),
    email: $('f-email'),
    goodFaith: $('f-goodfaith'),
    message: $('f-message'),
    website: $('f-website'),
  };

  let lang = initialLang();
  let mode = modeFromHash() || 'contact';
  let errors = []; // [{ input, errorId, key, n }]
  let statusKey = null;
  let confirmed = null; // { mode, id, email }
  let sending = false;

  // ---- Language and mode ----

  function initialLang() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'de' || fromUrl === 'en') return fromUrl;
    const preferred = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return /^de\b/i.test(preferred) ? 'de' : 'en';
  }

  function modeFromHash() {
    if (location.hash === '#report') return 'report';
    if (location.hash === '#contact') return 'contact';
    return null;
  }

  function applyVisibility() {
    for (const el of document.querySelectorAll('[data-lang], [data-mode]')) {
      const langMatches = !el.dataset.lang || el.dataset.lang === lang;
      const modeMatches = !el.dataset.mode || el.dataset.mode === mode;
      el.hidden = !(langMatches && modeMatches);
    }
    for (const el of document.querySelectorAll('[data-nojs]')) el.hidden = true;
    csamHint.hidden = !(mode === 'report' && reasonValue() === 'csam');
  }

  function setLang(next, { updateUrl = true } = {}) {
    lang = next;
    document.documentElement.lang = next;
    for (const link of document.querySelectorAll('[data-setlang]')) {
      if (link.dataset.setlang === next) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    applyVisibility();
    renderErrors();
    renderStatus();
    renderConfirm();
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('lang', next);
      history.replaceState(null, '', url);
    }
  }

  function setMode(next, { updateUrl = true } = {}) {
    if (confirmed) resetForm();
    mode = next;
    for (const input of modeInputs) input.checked = input.value === next;
    f.email.setAttribute('aria-required', String(next === 'contact'));
    clearErrors();
    setStatus(null);
    applyVisibility();
    if (updateUrl) history.replaceState(null, '', '#' + next);
  }

  // ---- Validation (§5.2, §5.3, §5.7) ----

  // Count Unicode code points, as Postgres char_length does.
  const length = (text) => Array.from(text).length;
  const reasonValue = () => (reasonInputs.find((input) => input.checked) || {}).value || '';

  function validate() {
    const found = [];
    const add = (input, errorId, key, n) => found.push({ input, errorId, key, n });

    const text = (input, errorId, min, max, required) => {
      const n = length(input.value.trim());
      if (n === 0) {
        if (required) add(input, errorId, 'required');
      } else if (n < min) {
        add(input, errorId, 'tooShort', min);
      } else if (n > max) {
        add(input, errorId, 'tooLong', max);
      }
    };

    const email = (required) => {
      const value = f.email.value.trim();
      if (!value) {
        if (required) add(f.email, 'e-email', 'required');
      } else if (length(value) > 254 || !EMAIL_PATTERN.test(value)) {
        add(f.email, 'e-email', 'email');
      }
    };

    if (mode === 'report') {
      if (!reasonValue()) add(reasonInputs[0], 'e-reason', 'required');
      text(f.location, 'e-location', 3, 500, true);
      text(f.explanation, 'e-explanation', 20, 4000, true);
      text(f.name, 'e-name', 0, 200, false);
      email(false);
      if (!f.goodFaith.checked) add(f.goodFaith, 'e-goodfaith', 'checkbox');
    } else {
      text(f.name, 'e-name', 0, 200, false);
      email(true);
      text(f.message, 'e-message', 10, 4000, true);
    }
    return found;
  }

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
  }

  function clearErrors() {
    errors = [];
    for (const el of form.querySelectorAll('.error')) {
      el.textContent = '';
      el.hidden = true;
    }
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
  }

  function renderErrors() {
    for (const error of errors) {
      const box = $(error.errorId);
      box.textContent = fill(T[lang][error.key], { n: error.n });
      box.hidden = false;
      const target = error.input.name === 'reason' ? $('g-reason') : error.input;
      target.setAttribute('aria-invalid', 'true');
    }
  }

  // ---- Status, confirmation, reset ----

  function setStatus(key) {
    statusKey = key;
    renderStatus();
  }

  function renderStatus() {
    statusBox.className = statusKey === 'draft' ? 'status draft' : 'status';
    statusBox.textContent = statusKey ? fill(T[lang][statusKey], { contact: CONTACT_ADDRESS }) : '';
  }

  function renderConfirm() {
    if (!confirmed) return;
    const t = T[lang];
    const ref = confirmed.id.slice(0, 8).toUpperCase();
    let title = t.contactTitle;
    let body = t.contactBody;
    if (confirmed.mode === 'report') {
      title = t.reportTitle;
      body = confirmed.email ? t.reportWithEmail : t.reportWithoutEmail;
    }
    const strong = document.createElement('strong');
    strong.textContent = title;
    confirmText.replaceChildren(strong, document.createTextNode(' ' + fill(body, { ref, email: confirmed.email })));
    againButton.textContent = t.again;
  }

  function showConfirm(sent) {
    confirmed = sent;
    renderConfirm();
    form.hidden = true;
    confirmBox.hidden = false;
    confirmBox.focus();
  }

  function resetForm() {
    form.reset();
    for (const input of modeInputs) input.checked = input.value === mode;
    confirmed = null;
    clearErrors();
    setStatus(null);
    confirmBox.hidden = true;
    form.hidden = false;
    applyVisibility();
  }

  // ---- Sending (§5.1) ----

  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function payload(id, sentMode) {
    const value = (input) => input.value.trim();
    const body = { id, lang };
    const optional = (key, text) => {
      if (text) body[key] = text;
    };
    if (sentMode === 'report') {
      body.reason = reasonValue();
      body.location_text = value(f.location);
      body.explanation = value(f.explanation);
      body.good_faith = true;
      optional('reporter_name', value(f.name));
      optional('reporter_email', value(f.email));
    } else {
      body.sender_email = value(f.email);
      body.message = value(f.message);
      optional('sender_name', value(f.name));
    }
    return body;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (sending) return;
    clearErrors();
    setStatus(null);

    errors = validate();
    if (errors.length) {
      renderErrors();
      errors[0].input.focus();
      return;
    }

    const sentMode = mode;
    const id = newId();
    const email = f.email.value.trim();

    // Honeypot filled: show the normal confirmation and send nothing.
    if (f.website.value !== '') {
      showConfirm({ mode: sentMode, id, email });
      return;
    }

    if (!CONNECTED) {
      setStatus('draft');
      return;
    }

    sending = true;
    sendButton.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE[sentMode]}`, {
        method: 'POST',
        headers: {
          apikey: ANON_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload(id, sentMode)),
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      });
      if (response.ok) {
        showConfirm({ mode: sentMode, id, email });
      } else {
        setStatus(response.status === 420 || response.status === 429 ? 'rateLimit' : 'failed');
      }
    } catch (error) {
      setStatus('failed');
    } finally {
      sending = false;
      sendButton.disabled = false;
      form.removeAttribute('aria-busy');
    }
  }

  // ---- Wiring ----

  form.addEventListener('submit', onSubmit);

  for (const input of modeInputs) {
    input.addEventListener('change', () => {
      if (input.checked) setMode(input.value);
    });
  }

  for (const input of reasonInputs) input.addEventListener('change', applyVisibility);

  againButton.addEventListener('click', () => {
    resetForm();
    (modeInputs.find((input) => input.checked) || modeInputs[0]).focus();
  });

  for (const link of document.querySelectorAll('[data-setlang]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      setLang(link.dataset.setlang);
    });
  }

  // In-page links to #report or #contact switch the mode and bring the form into view.
  for (const link of document.querySelectorAll('a[href="#report"], a[href="#contact"]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      setMode(link.getAttribute('href').slice(1));
      app.scrollIntoView({ block: 'start' });
      (modeInputs.find((input) => input.checked) || modeInputs[0]).focus({ preventScroll: true });
    });
  }

  window.addEventListener('hashchange', () => {
    const next = modeFromHash();
    if (next && next !== mode) setMode(next, { updateUrl: false });
  });

  app.hidden = false;
  setLang(lang, { updateUrl: false });
  setMode(mode, { updateUrl: false });
})();
