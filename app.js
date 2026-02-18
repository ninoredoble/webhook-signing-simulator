// relayctl — Interactive Terminal Emulator & Command Parser

const COMMANDS = {
  "help": () => `
<div class="resp-line resp-dim">Available CLI commands:</div>
<div class="resp-line">&bull; <strong style="color: var(--term-cyan);">dispatch [topic]</strong> : Dispatches an authenticated webhook with HMAC signature.</div>
<div class="resp-line">&bull; <strong style="color: var(--term-cyan);">backoff</strong>        : Computes decorrelated exponential retry jitter for N=5 attempts.</div>
<div class="resp-line">&bull; <strong style="color: var(--term-cyan);">inspect</strong>        : Generates raw hex dump & wire headers for active delivery.</div>
<div class="resp-line">&bull; <strong style="color: var(--term-cyan);">keys</strong>           : Queries Redis distributed idempotency locks.</div>
<div class="resp-line">&bull; <strong style="color: var(--term-cyan);">top</strong>            : Refreshes background worker process status.</div>
<div class="resp-line">&bull; <strong style="color: var(--term-cyan);">clear</strong>          : Clears current terminal scrollback buffer.</div>
  `,

  "dispatch": (args) => {
    const topic = args[0] || "invoice.payment_settled";
    const randKey = "idem_cdo_" + Math.random().toString(16).substring(2, 8);
    const delivId = "deliv_" + Math.random().toString(16).substring(2, 10);
    const sig = "t=" + Math.floor(Date.now()/1000) + ",v1=" + Math.random().toString(16).substring(2, 14);

    updateHexDump(topic, randKey);

    return `
<div class="resp-line resp-success">&bull; [INGEST] Event received for topic: <code>${topic}</code></div>
<div class="resp-line">&bull; [HMAC-SHA256] Generated cryptographic signature: <code>${sig}</code></div>
<div class="resp-line">&bull; [IDEMPOTENCY] Acquired distributed lock: <code>${randKey}</code> (TTL: 86400s)</div>
<div class="resp-line resp-success">&bull; [HTTP 200 OK] Delivered to <code>api.subscriber.ph</code> in 1.42ms (Delivery: ${delivId})</div>
    `;
  },

  "backoff": () => `
<div class="resp-line resp-warn">&bull; SIMULATING SUBSCRIBER 504 GATEWAY TIMEOUT (Truncated Exponential Backoff):</div>
<div class="resp-line resp-dim">  [Attempt 1] t = 0.0s  &bull; Immediate Dispatch &rarr; HTTP 504 Gateway Timeout</div>
<div class="resp-line resp-dim">  [Attempt 2] t = 2.4s  &bull; Exponential Step 1 (2^1s + 400ms Jitter) &rarr; HTTP 502 Bad Gateway</div>
<div class="resp-line resp-dim">  [Attempt 3] t = 11.6s &bull; Exponential Step 2 (2^3s + 800ms Jitter) &rarr; HTTP 503 Unavailable</div>
<div class="resp-line resp-success">  [Attempt 4] t = 44.8s &bull; Exponential Step 3 (2^5s + 1.2s Jitter) &rarr; HTTP 200 OK (Recovered!)</div>
  `,

  "inspect": () => `
<div class="resp-line resp-cyan">&bull; [WIRE BUFFER] RFC 7946 Webhook Packet Inspection:</div>
<div class="resp-line">  POST /v1/webhooks/listener HTTP/1.1</div>
<div class="resp-line">  Host: api.subscriber.ph</div>
<div class="resp-line">  Content-Type: application/json</div>
<div class="resp-line">  User-Agent: RelayCore/2.4 (Distributed Webhook Engine)</div>
<div class="resp-line">  Idempotency-Key: idem_cdo_948f2c01</div>
<div class="resp-line resp-dim">  (See right pane for raw packet hex dump and byte offsets)</div>
  `,

  "keys": () => `
<div class="resp-line resp-cyan">&bull; [REDIS IDEMPOTENCY LEDGER] Active Distributed Locks:</div>
<div class="resp-line">  KEY: <code>idem_cdo_948f2c01</code> &bull; TOPIC: invoice.payment_settled &bull; TTL: 84210s &bull; STATE: LOCKED</div>
<div class="resp-line">  KEY: <code>idem_grid_1848da3</code>  &bull; TOPIC: grid.meter_overload    &bull; TTL: 81920s &bull; STATE: REPLAY_GUARD</div>
<div class="resp-line">  KEY: <code>idem_auth_7832ef1</code>  &bull; TOPIC: identity.token_revoked &bull; TTL: 76400s &bull; STATE: REPLAY_GUARD</div>
  `,

  "top": () => {
    refreshWorkers();
    return `<div class="resp-line resp-success">&bull; Refreshed 16 worker threads. All daemon queues synchronized.</div>`;
  },

  "clear": () => {
    document.getElementById("termStage").innerHTML = `
<pre class="term-banner">
┌──────────────────────────────────────────────────────────────┐
│  RELAY CORE CLI &bull; DISTRIBUTED EVENT ENGINE (v2.4.0)          │
│  Type '<span class="highlight">help</span>' for available commands or use quick actions below.│
└──────────────────────────────────────────────────────────────┘</pre>
    `;
    return "";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("cliInput");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = input.value.trim();
      input.value = "";
      if (val) handleCommand(val);
    }
  });

  // Global Keyboard shortcuts F1-F4
  window.addEventListener("keydown", (e) => {
    if (e.key === "F1") { e.preventDefault(); runCommand("help"); }
    if (e.key === "F2") { e.preventDefault(); runCommand("dispatch"); }
    if (e.key === "F3") { e.preventDefault(); runCommand("backoff"); }
    if (e.key === "F4") { e.preventDefault(); runCommand("inspect"); }
  });

  // Sparkline through-put jitter
  initSparkline();
});

function handleCommand(raw) {
  const stage = document.getElementById("termStage");
  const parts = raw.split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Echo command
  const echoBlock = document.createElement("div");
  echoBlock.className = "term-output-block";
  echoBlock.innerHTML = `
    <div class="cmd-echo">
      <span class="prompt-user">relay@worker-01</span><span class="prompt-sep">:</span><span class="prompt-path">~</span>$ <span class="cmd-txt">${raw}</span>
    </div>
  `;

  if (COMMANDS[cmd]) {
    const output = COMMANDS[cmd](args);
    if (output) {
      echoBlock.innerHTML += output;
    }
  } else {
    echoBlock.innerHTML += `<div class="resp-line resp-alert">&bull; command not found: ${cmd}. Type 'help' for options.</div>`;
  }

  stage.appendChild(echoBlock);
  stage.scrollTop = stage.scrollHeight;
}

function runCommand(cmd) {
  handleCommand(cmd);
}

function initSparkline() {
  const sparkEl = document.getElementById("sparkline");
  const reqEl = document.getElementById("reqSec");
  const bars = [" ", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

  setInterval(() => {
    let s = "[ ";
    for (let i = 0; i < 10; i++) {
      s += bars[Math.floor(Math.random() * bars.length)];
    }
    s += " ]";
    sparkEl.innerText = s;
    reqEl.innerText = (4200 + Math.floor(Math.random() * 200 - 100)).toLocaleString();
  }, 1200);
}

function updateHexDump(topic, key) {
  const dump = document.getElementById("hexDump");
  dump.innerHTML = `
<span class="hex-addr">00000000</span>  <span class="hex-bytes">50 4f 53 54 20 2f 76 31  2f 77 65 62 68 6f 6f 6b</span>  |<span class="hex-ascii">POST /v1/webhook</span>|
<span class="hex-addr">00000010</span>  <span class="hex-bytes">73 20 48 54 54 50 2f 31  2e 31 0d 0a 48 6f 73 74</span>  |<span class="hex-ascii">s HTTP/1.1..Host</span>|
<span class="hex-addr">00000020</span>  <span class="hex-bytes">3a 20 61 70 69 2e 73 75  62 73 63 72 69 62 65 72</span>  |<span class="hex-ascii">: api.subscriber</span>|
<span class="hex-addr">00000030</span>  <span class="hex-bytes">2e 70 68 0d 0a 58 2d 52  65 6c 61 79 2d 45 76 65</span>  |<span class="hex-ascii">.ph..X-Relay-Eve</span>|
<span class="hex-addr">00000040</span>  <span class="hex-bytes">6e 74 3a 20 ${toHex(topic.substring(0, 8))}</span>  |<span class="hex-ascii">nt: ${topic.substring(0, 8)}</span>|
<span class="hex-addr">00000050</span>  <span class="hex-bytes">69 64 65 6d 2d 6b 65 79  3a 20 ${toHex(key.substring(0, 6))}</span>  |<span class="hex-ascii">idem-key: ${key.substring(0, 6)}</span>|
`;
}

function toHex(str) {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16) + " ";
  }
  return hex;
}

function refreshWorkers() {
  const tbody = document.getElementById("workerTableBody");
  const states = ["POLLING", "DISPATCHING", "IDLE", "LOCK_WAIT"];
  tbody.innerHTML = `
    <tr>
      <td><code>4091</code></td>
      <td>worker-tx-0</td>
      <td>billing.settled</td>
      <td><span class="status-active">${states[Math.floor(Math.random()*states.length)]}</span></td>
    </tr>
    <tr>
      <td><code>4092</code></td>
      <td>worker-tx-1</td>
      <td>grid.telemetry</td>
      <td><span class="status-active">${states[Math.floor(Math.random()*states.length)]}</span></td>
    </tr>
    <tr>
      <td><code>4093</code></td>
      <td>worker-retry</td>
      <td>backoff.jitter</td>
      <td><span class="status-retry">DELAY (${(Math.random()*3).toFixed(1)}s)</span></td>
    </tr>
    <tr>
      <td><code>4094</code></td>
      <td>worker-crypto</td>
      <td>hmac.sha256</td>
      <td><span class="status-active">IDLE</span></td>
    </tr>
  `;
}
