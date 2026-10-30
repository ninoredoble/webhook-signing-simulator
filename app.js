// relay-core-api: webhook signing and retry simulator.
// An interactive study. Everything runs in this page; nothing is sent anywhere.

'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const enc = new TextEncoder();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- HMAC-SHA256 through Web Crypto ---------- */

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

// Compares every character instead of stopping at the first difference.
// JavaScript offers no real timing guarantee; this shows the shape of the idea.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Renders `str` with characters that differ from `other` wrapped in .chg
function diffSpans(target, str, other) {
  target.textContent = '';
  let run = '';
  let runChanged = false;
  const flush = () => {
    if (!run) return;
    if (runChanged) target.append(el('span', 'chg', run));
    else target.append(document.createTextNode(run));
    run = '';
  };
  for (let i = 0; i < str.length; i++) {
    const changed = other !== undefined && str[i] !== other[i];
    if (changed !== runChanged) { flush(); runChanged = changed; }
    run += str[i];
  }
  flush();
}

function countDiff(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/* ---------- Sign a payload ---------- */

let prevSig = null;
let signSeq = 0;

function currentSender() {
  return {
    secret: $('#secret').value,
    t: $('#ts').value.trim(),
    body: $('#body').value,
  };
}

async function updateSign() {
  const mine = ++signSeq;
  const sender = currentSender();
  const signed = `${sender.t}.${sender.body}`;

  const stamp = $('#signedString');
  stamp.textContent = '';
  stamp.append(el('span', 'dim', `${sender.t}.`), document.createTextNode(sender.body));

  if (!sender.secret) {
    $('#sigOut').textContent = 'Enter a secret to sign with.';
    $('#reqOut').textContent = '';
    $('#delta').textContent = '';
    sender.sig = null;
    updateVerify(sender);
    return;
  }

  let sig;
  try {
    sig = await hmacHex(sender.secret, signed);
  } catch (err) {
    $('#sigOut').textContent = 'Web Crypto is not available here. Open this page over https or from localhost.';
    return;
  }
  if (mine !== signSeq) return;

  diffSpans($('#sigOut'), sig, prevSig || undefined);
  $('#delta').textContent = prevSig && prevSig !== sig ? `${countDiff(sig, prevSig)} of 64 characters changed` : '';
  prevSig = sig;

  $('#reqOut').textContent =
    `POST /hooks/study HTTP/1.1\nHost: subscriber.example\nContent-Type: application/json\n` +
    `Relay-Signature: t=${sender.t},v1=${sig}\n\n${sender.body}`;

  $('#heroReq').textContent = $('#reqOut').textContent;
  sender.sig = sig;
  updateVerify(sender);
}

async function copyRequest() {
  const btn = $('#copyReq');
  try {
    await navigator.clipboard.writeText($('#reqOut').textContent);
    btn.textContent = 'Copied';
  } catch (err) {
    btn.textContent = 'Select and copy instead';
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
}

// RFC 4231, test case 2.
async function runVector() {
  const out = $('#vectorOut');
  const expected = '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843';
  try {
    const got = await hmacHex('Jefe', 'what do ya want for nothing?');
    const same = got === expected;
    out.className = same ? 'ok' : 'bad';
    out.textContent = same
      ? `Match. key "Jefe", data "what do ya want for nothing?" gives ${got}`
      : `No match. Got ${got}`;
  } catch (err) {
    out.className = 'bad';
    out.textContent = 'Web Crypto is not available here.';
  }
}

/* ---------- Verify as the receiver ---------- */

let verifySeq = 0;
let lastSender = null;

function alterBody(body) {
  const altered = body.replace(/(\d)(?!.*\d)/s, (d) => String((Number(d) + 1) % 10));
  return altered === body ? body + ' ' : altered;
}

async function updateVerify(sender) {
  if (sender) lastSender = sender;
  sender = lastSender;
  if (!sender) return;
  const mine = ++verifySeq;

  const age = Number($('#age').value);
  const tol = Math.max(1, Number($('#tol').value) || 300);
  $('#ageOut').textContent = age;

  const tampered = $('#tamper').checked;
  const wrong = $('#wrongSecret').checked;
  const gotBody = tampered ? alterBody(sender.body) : sender.body;
  const recvSecret = wrong ? `${sender.secret}-rotated` : sender.secret;

  // body the receiver got
  const gotEl = $('#gotBody');
  gotEl.textContent = '';
  if (tampered && gotBody !== sender.body) {
    let i = 0;
    while (i < gotBody.length && gotBody[i] === sender.body[i]) i++;
    gotEl.append(
      document.createTextNode(gotBody.slice(0, i)),
      el('span', 'chg', gotBody[i] === ' ' ? '·' : gotBody[i]),
      document.createTextNode(gotBody.slice(i + 1))
    );
  } else {
    gotEl.textContent = gotBody;
  }

  const header = sender.sig ? `t=${sender.t},v1=${sender.sig}` : '';
  const parsed = header.match(/^t=(\d+),v1=([0-9a-f]{64})$/);

  let computed = null;
  if (parsed && recvSecret) {
    try { computed = await hmacHex(recvSecret, `${parsed[1]}.${gotBody}`); } catch (err) { computed = null; }
  }
  if (mine !== verifySeq) return;

  const fresh = age <= tol;
  const matches = parsed && computed !== null && safeEqual(computed, parsed[2]);

  const steps = [
    {
      name: 'Read t and v1 from the header',
      ok: Boolean(parsed),
      pass: 'Found a timestamp and a 64-character signature.',
      fail: sender.sig ? 'The timestamp must be whole unix seconds.' : 'There is no signature to read.',
    },
    {
      name: 'Check the timestamp is recent',
      ok: fresh,
      pass: `${age}s old, limit ${tol}s.`,
      fail: `${age}s old, limit ${tol}s. A captured request replayed later is refused here.`,
    },
    {
      name: 'Recompute the signature and compare',
      ok: Boolean(matches),
      pass: 'The signature the receiver computed is identical.',
      fail: 'The signature the receiver computed is different from the one in the header.',
    },
  ];

  const list = $('#checks');
  list.textContent = '';
  let failed = null;
  for (const step of steps) {
    const li = el('li');
    let state, text;
    if (failed) { state = 'skip'; text = 'Not reached.'; }
    else if (step.ok) { state = 'pass'; text = step.pass; }
    else { state = 'fail'; text = step.fail; failed = step; }
    const label = { pass: 'Pass', fail: 'Fail', skip: 'Skipped' }[state];
    li.append(el('span', `res ${state}`, label));
    const copy = el('p');
    copy.append(el('strong', '', step.name), document.createTextNode(text));
    li.append(copy);
    list.append(li);
  }

  const verdict = $('#verdict');
  verdict.textContent = '';
  if (failed) {
    verdict.className = 'verdict bad';
    verdict.append(document.createTextNode('Rejected. Respond 401.'), el('small', '', failed.name + ' failed.'));
  } else {
    verdict.className = 'verdict ok';
    verdict.append(document.createTextNode('Accepted. Respond 200.'), el('small', '', 'Header, freshness and signature all check out.'));
  }

  const cmp = $('#cmpOut');
  cmp.textContent = '';
  if (parsed && computed !== null && steps[1].ok) {
    const a = el('span'); const b = el('span');
    diffSpans(a, parsed[2], computed);
    diffSpans(b, computed, parsed[2]);
    cmp.append(el('span', 'dim', 'header    '), a, document.createTextNode('\n'), el('span', 'dim', 'computed  '), b);
  } else if (parsed && !steps[1].ok) {
    cmp.append(el('span', 'dim', 'Not computed. The request was refused before the signature check.'));
  } else {
    cmp.append(el('span', 'dim', 'Nothing to compare.'));
  }
}

/* ---------- Retry with backoff ---------- */

const STRATEGIES = [
  { id: 'none', short: 'None', name: 'No jitter', rule: 'wait d' },
  { id: 'full', short: 'Full', name: 'Full jitter', rule: 'wait random(0, d)' },
  { id: 'equal', short: 'Equal', name: 'Equal jitter', rule: 'wait d/2 + random(0, d/2)' },
  { id: 'decorr', short: 'Decorr.', name: 'Decorrelated jitter', rule: 'wait random(base, 3 × previous wait)' },
];

// Small seeded generator, so the same seed gives the same run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function num(id, min, max, fallback) {
  const raw = Number($(id).value);
  const v = Number.isFinite(raw) && $(id).value !== '' ? raw : fallback;
  return Math.min(max, Math.max(min, v));
}

function readParams() {
  const base = num('#rBase', 0.1, 60, 1);
  return {
    base,
    cap: num('#rCap', base, 3600, 30),
    mult: num('#rMult', 1, 4, 2),
    attempts: Math.round(num('#rMax', 2, 12, 8)),
    failFirst: Math.round(num('#rFail', 0, 12, 5)),
    seed: Math.round(num('#rSeed', 0, 999999, 7)),
  };
}

// One client talking to an endpoint that fails the first `failFirst` attempts.
// If `alwaysFail`, every attempt fails (used for the thundering-herd view).
function schedule(kind, p, rng, alwaysFail = false) {
  const out = [];
  let at = 0;
  let prevWait = p.base;
  for (let k = 1; k <= p.attempts; k++) {
    const ok = !alwaysFail && k > p.failFirst;
    const entry = { n: k, at, ok };
    out.push(entry);
    if (ok || k === p.attempts) break;

    const d = Math.min(p.cap, p.base * Math.pow(p.mult, k - 1));
    let wait, ceil;
    if (kind === 'none') { wait = d; ceil = d; }
    else if (kind === 'full') { ceil = d; wait = rng() * d; }
    else if (kind === 'equal') { ceil = d; wait = d / 2 + rng() * (d / 2); }
    else {
      ceil = Math.min(p.cap, prevWait * 3);
      wait = Math.min(p.cap, p.base + rng() * Math.max(0, prevWait * 3 - p.base));
      prevWait = wait;
    }
    entry.nextWait = wait;
    entry.nextCeil = ceil;
    at += wait;
  }
  return out;
}

const fmt = (s) => `${Math.round(s * 10) / 10}s`;

function niceStep(span) {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
  return steps.find((s) => span / s <= 6) || 3600;
}

let playRaf = 0;

function renderRetry() {
  cancelAnimationFrame(playRaf);
  const p = readParams();
  const lanes = STRATEGIES.map((s, i) => ({ s, run: schedule(s.id, p, mulberry32(p.seed * 31 + i + 1)) }));
  const maxAt = Math.max(...lanes.map((l) => l.run[l.run.length - 1].at));
  const T = maxAt > 0 ? maxAt * 1.06 : 1;
  const PAD = 12; // px kept clear at both ends so markers stay inside the track
  const pct = (v) => `calc(${PAD}px + (100% - ${PAD * 2}px) * ${v / T})`;
  const span = (v) => `calc((100% - ${PAD * 2}px) * ${v / T})`;

  const tracks = $('#tracks');
  tracks.textContent = '';
  tracks.dataset.span = T;
  for (const { s, run } of lanes) {
    const last = run[run.length - 1];
    const lane = el('div', 'lane');
    const name = el('div', 'lane-name');
    name.append(el('strong', '', s.name));
    name.append(el('span', '', last.ok
      ? `${s.rule}. Delivered on attempt ${last.n} at ${fmt(last.at)}.`
      : `${s.rule}. Gave up after ${last.n} attempts at ${fmt(last.at)}.`));
    const track = el('div', 'track');
    track.setAttribute('aria-hidden', 'true'); // the table below carries the same times as text

    run.forEach((a, idx) => {
      if (a.nextWait !== undefined) {
        const g = el('span', 'ghost');
        g.style.left = pct(a.at);
        g.style.width = span(a.nextCeil);
        g.dataset.at = a.at;
        const w = el('span', 'wait');
        w.style.left = pct(a.at);
        w.style.width = span(a.nextWait);
        w.dataset.at = a.at;
        track.append(g, w);
      }
      const m = el('span', `mark ${a.ok ? 'ok' : 'fail'}`);
      m.style.left = pct(a.at);
      m.dataset.at = a.at;
      m.title = `Attempt ${a.n} at ${fmt(a.at)}: ${a.ok ? 'delivered' : 'endpoint failed'}`;
      track.append(m);
    });
    lane.append(name, track);
    tracks.append(lane);
  }
  const head = el('div', 'playhead');
  head.hidden = true;
  head.id = 'playhead';
  tracks.append(head);

  // axis
  const axis = $('#axis');
  axis.textContent = '';
  const step = niceStep(T);
  for (let v = 0; v <= T; v += step) {
    const tick = el('span', '', fmt(v));
    tick.style.left = pct(v);
    axis.append(tick);
  }

  // table
  const table = $('#attemptsTable');
  const thead = table.tHead; const tbody = table.tBodies[0];
  thead.textContent = ''; tbody.textContent = '';
  const hr = el('tr');
  hr.append(el('th', '', 'Attempt'));
  lanes.forEach((l) => hr.append(el('th', '', l.s.short)));
  thead.append(hr);
  for (let k = 1; k <= p.attempts; k++) {
    if (!lanes.some((l) => l.run.length >= k)) break;
    const tr = el('tr');
    tr.append(el('td', '', String(k)));
    for (const l of lanes) {
      const a = l.run[k - 1];
      tr.append(a ? el('td', a.ok ? 'ok' : 'fail', fmt(a.at)) : el('td', 'none', '-'));
    }
    tbody.append(tr);
  }
  const sum = el('tr', 'sum');
  sum.append(el('td', '', 'Outcome'));
  for (const l of lanes) {
    const last = l.run[l.run.length - 1];
    sum.append(el('td', last.ok ? 'ok' : 'fail', last.ok ? 'delivered' : 'gave up'));
  }
  tbody.append(sum);

  renderHerd(p);
}

function playRetry() {
  if (reduceMotion.matches) return;
  cancelAnimationFrame(playRaf);
  const track = $('#tracks');
  const PAD = 12;
  const items = [...track.querySelectorAll('[data-at]')];
  const head = $('#playhead');
  const span = Number(track.dataset.span);
  items.forEach((i) => i.classList.add('unseen'));
  head.hidden = false;
  const duration = 5200;
  const t0 = performance.now();
  $('#play').disabled = true;

  const frame = (now) => {
    const f = Math.min(1, (now - t0) / duration);
    const time = f * span;
    head.style.left = `calc(${PAD}px + (100% - ${PAD * 2}px) * ${f})`;
    for (const i of items) {
      if (i.classList.contains('unseen') && Number(i.dataset.at) <= time) {
        i.classList.remove('unseen');
        if (i.classList.contains('mark')) { i.classList.add('pop'); }
      }
    }
    if (f < 1) playRaf = requestAnimationFrame(frame);
    else {
      head.hidden = true;
      $('#play').disabled = false;
      $('#retryAnnounce').textContent = 'Playback finished.';
    }
  };
  playRaf = requestAnimationFrame(frame);
}

/* ---------- The herd ---------- */

function renderHerd(p) {
  const CLIENTS = 200;
  const BINS = 48;
  const FIRST = 4; // look at the first four retries, where the pile-up shows
  const results = STRATEGIES.map((s, si) => {
    const times = [];
    for (let c = 0; c < CLIENTS; c++) {
      const run = schedule(s.id, p, mulberry32(p.seed * 7919 + si * 104729 + c + 1), true);
      for (let k = 1; k < Math.min(run.length, FIRST + 1); k++) times.push(run[k].at);
    }
    return { s, times };
  });
  const end = Math.max(1, ...results.map((r) => Math.max(0, ...r.times)));
  const width = end / BINS;
  results.forEach((r) => {
    r.bins = new Array(BINS).fill(0);
    r.times.forEach((t) => { r.bins[Math.min(BINS - 1, Math.floor(t / width))]++; });
    r.peak = Math.max(...r.bins);
  });
  const scale = Math.max(...results.map((r) => r.peak));

  const root = $('#herdCharts');
  if (!root.children.length) {
    results.forEach(() => {
      const box = el('div', 'hist');
      box.append(el('h3'), el('p', 'peak'), el('div', 'bars'), el('div', 'x'));
      root.append(box);
    });
  }
  results.forEach((r, i) => {
    const box = root.children[i];
    box.querySelector('h3').textContent = r.s.name;
    const peak = box.querySelector('.peak');
    peak.textContent = '';
    peak.append(el('b', '', String(r.peak)), document.createTextNode(`retries in the busiest ${fmt(width)} slice`));
    const bars = box.querySelector('.bars');
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', `${r.s.name}: busiest ${fmt(width)} slice receives ${r.peak} of ${r.times.length} retries.`);
    if (!bars.children.length) for (let b = 0; b < BINS; b++) bars.append(document.createElement('i'));
    r.bins.forEach((count, b) => {
      const bar = bars.children[b];
      bar.style.height = `${(count / scale) * 100}%`;
      bar.className = count === r.peak && count > 0 ? 'max' : '';
    });
    const x = box.querySelector('.x');
    x.textContent = '';
    x.append(el('span', '', '0s'), el('span', '', fmt(end / 2)), el('span', '', fmt(end)));
  });
}

/* ---------- Wiring ---------- */

function bind() {
  ['#secret', '#ts', '#body'].forEach((id) => $(id).addEventListener('input', updateSign));
  $('#tsNow').addEventListener('click', () => { $('#ts').value = Math.floor(Date.now() / 1000); updateSign(); });
  $('#bodyPretty').addEventListener('click', () => {
    try { $('#body').value = JSON.stringify(JSON.parse($('#body').value), null, 2); updateSign(); } catch (err) { /* not JSON, leave it */ }
  });
  $('#bodyMin').addEventListener('click', () => {
    try { $('#body').value = JSON.stringify(JSON.parse($('#body').value)); updateSign(); } catch (err) { /* not JSON, leave it */ }
  });
  $('#copyReq').addEventListener('click', copyRequest);
  $('#vector').addEventListener('click', runVector);

  ['#tamper', '#wrongSecret', '#age', '#tol'].forEach((id) => $(id).addEventListener('input', () => updateVerify()));
  $('#verifyReset').addEventListener('click', () => {
    $('#tamper').checked = false; $('#wrongSecret').checked = false;
    $('#age').value = 2; $('#tol').value = 300;
    updateVerify();
  });

  ['#rBase', '#rCap', '#rMult', '#rMax', '#rFail', '#rSeed'].forEach((id) => $(id).addEventListener('input', renderRetry));
  $('#play').addEventListener('click', playRetry);
  $('#reroll').addEventListener('click', () => {
    $('#rSeed').value = Math.floor(Math.random() * 1000000);
    renderRetry();
    $('#retryAnnounce').textContent = `Jitter re-rolled with seed ${$('#rSeed').value}.`;
  });
  if (reduceMotion.matches) {
    $('#play').disabled = true;
    $('#play').title = 'Playback is off because your system asks for reduced motion. The full schedule is already shown.';
  }
}

function observe() {
  const reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { reveals.forEach((r) => r.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  reveals.forEach((r) => io.observe(r));

  const links = [...document.querySelectorAll('.side a')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
  const nav = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      const a = links[sections.indexOf(e.target)];
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach((s) => s && nav.observe(s));
}

bind();
observe();
updateSign();
renderRetry();
