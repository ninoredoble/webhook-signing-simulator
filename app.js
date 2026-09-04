// relayctl - Interactive Terminal Emulator & Distributed Webhook Engine
// Character Encoding: 100% 7-Bit ASCII - Clean Typography & Network RFC Standards

// In-Memory Idempotency & Delivery Ledger
const IdempotencyLedger = new Map([
  ["idem_cdo_948f2c01", {
    topic: "invoice.payment_settled",
    deliveryId: "deliv_948f2c010a",
    signature: "t=1725482900,v1=9fa8e3b211dc",
    status: "DELIVERED_200",
    ttl: 84210,
    timestamp: "2026-09-04T16:15:00Z"
  }],
  ["idem_grid_1848da3", {
    topic: "grid.meter_overload",
    deliveryId: "deliv_1848da39b4",
    signature: "t=1725482120,v1=2c83ef4a8901",
    status: "DELIVERED_200",
    ttl: 81920,
    timestamp: "2026-09-04T16:02:00Z"
  }],
  ["idem_auth_7832ef1", {
    topic: "identity.token_revoked",
    deliveryId: "deliv_7832ef190e",
    signature: "t=1725476600,v1=67ef89a014bc",
    status: "DELIVERED_200",
    ttl: 76400,
    timestamp: "2026-09-04T14:30:00Z"
  }]
]);

let lastDispatchedKey = "idem_cdo_948f2c01";
let commandHistory = [];
let historyIndex = -1;

// Command Dispatch Registry
const COMMANDS = {
  "help": () => `
<div class="resp-line resp-dim">Available CLI commands:</div>
<div class="resp-line">// <strong style="color: var(--term-cyan);">dispatch [topic] [key]</strong> : Ingests event, checks idempotency lock, dispatches signed webhook.</div>
<div class="resp-line">// <strong style="color: var(--term-cyan);">replay [key]</strong>           : Attempts duplicate delivery to demonstrate atomic replay guard.</div>
<div class="resp-line">// <strong style="color: var(--term-cyan);">backoff</strong>                : Runs Decorrelated Jitter Exponential Retry simulation (N=5).</div>
<div class="resp-line">// <strong style="color: var(--term-cyan);">inspect [key]</strong>          : Updates right pane with RFC 7946 raw hex wire frame.</div>
<div class="resp-line">// <strong style="color: var(--term-cyan);">keys</strong>                   : Queries Redis distributed idempotency lock ledger.</div>
<div class="resp-line">// <strong style="color: var(--term-cyan);">top</strong>                    : Refreshes background daemon worker process pool.</div>
<div class="resp-line">// <strong style="color: var(--term-cyan);">export</strong>                 : Exports complete delivery & audit trail to JSON.</div>
<div class="resp-line">// <strong style="color: var(--term-cyan);">clear</strong>                  : Clears terminal scrollback buffer.</div>
  `,

  "status": () => `
<div class="resp-line resp-success">// [CLUSTER STATUS] All 16 daemon workers active in regional queue (ap-southeast-1).</div>
<div class="resp-line">// Ingress Throughput: 4,280 req/s // P99 Wire Latency: 1.42 ms</div>
<div class="resp-line">// Redis Idempotency Ledger: ${IdempotencyLedger.size} active locks cached (TTL: 86400s).</div>
<div class="resp-line">// Replay Protection Guard: 100% ATOMIC // Rejection Rate: 0.00%</div>
  `,

  "dispatch": (args) => {
    const topic = args[0] || "invoice.payment_settled";
    const key = args[1] || ("idem_cdo_" + Math.random().toString(16).substring(2, 8));

    // Idempotency Check
    if (IdempotencyLedger.has(key)) {
      const cached = IdempotencyLedger.get(key);
      return `
<div class="resp-line resp-alert">// [HTTP 409 CONFLICT] REPLAY BLOCKED // Duplicate Idempotency Key: <code>${key}</code></div>
<div class="resp-line resp-warn">// [REPLAY GUARD] Replay attempt rejected. Returning cached delivery: <code>${cached.deliveryId}</code></div>
<div class="resp-line resp-dim">// Original Timestamp: ${cached.timestamp} // Cached Status: ${cached.status}</div>
      `;
    }

    const delivId = "deliv_" + Math.random().toString(16).substring(2, 10);
    const ts = Math.floor(Date.now() / 1000);
    const hmacSig = "t=" + ts + ",v1=" + Math.random().toString(16).substring(2, 14);

    IdempotencyLedger.set(key, {
      topic: topic,
      deliveryId: delivId,
      signature: hmacSig,
      status: "DELIVERED_200",
      ttl: 86400,
      timestamp: new Date().toISOString()
    });

    lastDispatchedKey = key;
    renderHexDump(topic, key, delivId, hmacSig);

    return `
<div class="resp-line resp-success">// [INGEST] Inbound event queued: <code>${topic}</code></div>
<div class="resp-line">// [HMAC-SHA256] Wire Signature: <code>${hmacSig}</code></div>
<div class="resp-line">// [IDEMPOTENCY] Acquired distributed lock: <code>${key}</code> (TTL: 86400s)</div>
<div class="resp-line resp-success">// [HTTP 200 OK] Delivered to <code>api.subscriber.ph</code> in 1.42ms (Delivery: <code>${delivId}</code>)</div>
    `;
  },

  "replay": (args) => {
    const targetKey = args[0] || lastDispatchedKey;
    if (!IdempotencyLedger.has(targetKey)) {
      return `<div class="resp-line resp-warn">// Key <code>${targetKey}</code> not found in ledger. Dispatching first.</div>`;
    }

    const cached = IdempotencyLedger.get(targetKey);
    return `
<div class="resp-line resp-alert">// [SIMULATED NETWORK REPLAY] Resending event with key: <code>${targetKey}</code></div>
<div class="resp-line resp-alert">// [HTTP 409 CONFLICT] ATOMIC IDEMPOTENCY GUARD TRIPPED!</div>
<div class="resp-line resp-warn">// Idempotent Lock Active: Event already settled at ${cached.timestamp}.</div>
<div class="resp-line resp-success">// Redundant downstream processing averted. Zero duplicate charge.</div>
    `;
  },

  "backoff": (args) => {
    const attempts = parseInt(args[0], 10) || 5;
    let baseDelay = 1.0;
    let lines = [`<div class="resp-line resp-warn">// SIMULATING SUBSCRIBER 504 TIMEOUT (Decorrelated Exponential Jitter):</div>`];

    let currentSleep = baseDelay;
    let totalTime = 0.0;

    for (let i = 1; i <= attempts; i++) {
      if (i === 1) {
        lines.push(`<div class="resp-line resp-dim">  [Attempt 1] t = 0.0s // Immediate Dispatch -> HTTP 504 Gateway Timeout</div>`);
      } else if (i < attempts) {
        // Decorrelated jitter: sleep = min(cap, random(base, sleep * 3))
        const jitter = (Math.random() * (currentSleep * 3 - baseDelay) + baseDelay).toFixed(2);
        totalTime += parseFloat(jitter);
        currentSleep = parseFloat(jitter);
        lines.push(`<div class="resp-line resp-dim">  [Attempt ${i}] t = ${totalTime.toFixed(1)}s // Exponential Step ${i-1} (${currentSleep}s Jitter Delay) -> HTTP 503 Service Unavailable</div>`);
      } else {
        const jitter = (Math.random() * (currentSleep * 3 - baseDelay) + baseDelay).toFixed(2);
        totalTime += parseFloat(jitter);
        lines.push(`<div class="resp-line resp-success">  [Attempt ${i}] t = ${totalTime.toFixed(1)}s // Retry Step ${i-1} -> HTTP 200 OK (Subscriber Circuit Restored!)</div>`);
      }
    }

    return lines.join("\n");
  },

  "inspect": (args) => {
    const key = args[0] || lastDispatchedKey;
    const entry = IdempotencyLedger.get(key) || {
      topic: "invoice.payment_settled",
      deliveryId: "deliv_948f2c010a",
      signature: "t=1725482900,v1=9fa8e3b211dc"
    };

    renderHexDump(entry.topic, key, entry.deliveryId, entry.signature);
    return `
<div class="resp-line resp-cyan">// [WIRE BUFFER INSPECTOR] Frame RFC 7946:</div>
<div class="resp-line">  POST /v1/webhooks HTTP/1.1</div>
<div class="resp-line">  Host: api.subscriber.ph</div>
<div class="resp-line">  X-Relay-Event: ${entry.topic}</div>
<div class="resp-line">  Idempotency-Key: ${key}</div>
<div class="resp-line">  X-Relay-Signature: ${entry.signature}</div>
<div class="resp-line resp-dim">  (See right pane for raw 16-byte hex dump and ASCII offsets)</div>
    `;
  },

  "keys": () => {
    let lines = [`<div class="resp-line resp-cyan">// [REDIS IDEMPOTENCY LEDGER] Active Distributed Locks:</div>`];
    IdempotencyLedger.forEach((val, key) => {
      lines.push(`<div class="resp-line">  KEY: <code>${key}</code> // TOPIC: ${val.topic} // STATUS: <span style="color:var(--term-green);">${val.status}</span> // TTL: ${val.ttl}s</div>`);
    });
    return lines.join("\n");
  },

  "top": () => {
    refreshWorkers();
    return `<div class="resp-line resp-success">// Refreshed 16 worker threads. All daemon queues synchronized.</div>`;
  },

  "export": () => {
    exportRelayAuditJSON();
    return `<div class="resp-line resp-success">// [AUDIT LOG EXPORTED] Downloaded relay_audit_ledger.json.</div>`;
  },

  "clear": () => {
    document.getElementById("termStage").innerHTML = `
<pre class="term-banner">
+--------------------------------------------------------------+
|  RELAY CORE CLI // DISTRIBUTED EVENT ENGINE (v2.4.0)         |
|  Type '<span class="highlight">help</span>' for available commands or use quick actions.   |
+--------------------------------------------------------------+</pre>
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
      if (val) {
        commandHistory.push(val);
        historyIndex = commandHistory.length;
        handleCommand(val);
      }
    } else if (e.key === "ArrowUp") {
      if (historyIndex > 0) {
        historyIndex--;
        input.value = commandHistory[historyIndex];
      }
    } else if (e.key === "ArrowDown") {
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        input.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        input.value = "";
      }
    }
  });

  // Global Keyboard shortcuts F1-F4, F10
  window.addEventListener("keydown", (e) => {
    if (e.key === "F1") { e.preventDefault(); runCommand("help"); }
    if (e.key === "F2") { e.preventDefault(); runCommand("dispatch"); }
    if (e.key === "F3") { e.preventDefault(); runCommand("backoff"); }
    if (e.key === "F4") { e.preventDefault(); runCommand("inspect"); }
    if (e.key === "F10") { e.preventDefault(); runCommand("export"); }
  });

  // Jitter Throughput Rate
  setInterval(() => {
    const rateEl = document.getElementById("reqSec");
    if (rateEl) {
      const jitter = Math.floor(Math.random() * 200 - 100);
      rateEl.innerText = (4280 + jitter).toLocaleString();
    }
    const sparkEl = document.getElementById("sparkline");
    if (sparkEl) {
      const bars = ["||||||||||||", "|||||||||||.", "||||||||||..", "||||||||||||", "|||||||||||#"];
      sparkEl.innerText = `[ ${bars[Math.floor(Math.random() * bars.length)]} ]`;
    }
  }, 1800);
});

function handleCommand(cmdString) {
  const stage = document.getElementById("termStage");
  const parts = cmdString.split(" ");
  const root = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Echo Command
  const block = document.createElement("div");
  block.className = "term-output-block";
  block.innerHTML = `
    <div class="cmd-echo">
      <span class="prompt-user">relay@worker-01</span><span class="prompt-sep">:</span><span class="prompt-path">~</span>$ <span class="cmd-txt">${cmdString}</span>
    </div>
  `;

  if (COMMANDS[root]) {
    const resp = COMMANDS[root](args);
    if (resp) block.innerHTML += resp;
  } else {
    block.innerHTML += `
      <div class="resp-line resp-alert">// relayctl: command not found: <code>${root}</code>. Type <strong>help</strong> for options.</div>
    `;
  }

  stage.appendChild(block);
  stage.scrollTop = stage.scrollHeight;
}

function runCommand(cmd) {
  handleCommand(cmd);
}

// Generate Real Hex Dump from Wire Frame
function renderHexDump(topic, key, delivId, sig) {
  const wireText = `POST /v1/webhooks HTTP/1.1\r\nHost: api.subscriber.ph\r\nX-Relay-Event: ${topic}\r\nIdempotency-Key: ${key}\r\nX-Relay-Delivery: ${delivId}\r\nX-Signature: ${sig}\r\nContent-Type: application/json\r\n\r\n{"status":"settled","cur":"PHP"}`;

  const hexLines = [];
  const bytes = [];
  for (let i = 0; i < wireText.length; i++) {
    bytes.push(wireText.charCodeAt(i));
  }

  for (let offset = 0; offset < Math.min(192, bytes.length); offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    const addr = offset.toString(16).padStart(8, "0");

    let hexPart1 = "";
    let hexPart2 = "";
    let asciiPart = "";

    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        const b = chunk[j];
        const h = b.toString(16).padStart(2, "0");
        if (j < 8) hexPart1 += h + " ";
        else hexPart2 += h + " ";
        asciiPart += (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".";
      } else {
        if (j < 8) hexPart1 += "   ";
        else hexPart2 += "   ";
        asciiPart += " ";
      }
    }

    hexLines.push(`<span class="hex-addr">${addr}</span>  <span class="hex-bytes">${hexPart1.trim()}  ${hexPart2.trim()}</span>  |<span class="hex-ascii">${asciiPart}</span>|`);
  }

  const dumpEl = document.getElementById("hexDump");
  if (dumpEl) dumpEl.innerHTML = hexLines.join("\n");
}

function refreshWorkers() {
  const tbody = document.getElementById("workerTableBody");
  const timeEl = document.getElementById("topTime");
  const now = new Date().toTimeString().split(" ")[0];
  if (timeEl) timeEl.innerText = `TOP - ${now}`;

  const workers = [
    { pid: 4091, thread: "worker-tx-0", queue: "billing.settled", state: "POLLING", cls: "status-active" },
    { pid: 4092, thread: "worker-tx-1", queue: "grid.telemetry", state: "POLLING", cls: "status-active" },
    { pid: 4093, thread: "worker-retry", queue: "backoff.jitter", state: "DELAY (" + (Math.random() * 2 + 1).toFixed(1) + "s)", cls: "status-retry" },
    { pid: 4094, thread: "worker-crypto", queue: "hmac.sha256", state: "ACTIVE", cls: "status-active" },
    { pid: 4095, thread: "worker-idemp", queue: "redis.lru", state: "LOCK_ACQUIRED", cls: "status-active" }
  ];

  if (tbody) {
    tbody.innerHTML = workers.map(w => `
      <tr>
        <td><code>${w.pid}</code></td>
        <td>${w.thread}</td>
        <td>${w.queue}</td>
        <td><span class="${w.cls}">${w.state}</span></td>
      </tr>
    `).join("");
  }
}

function exportRelayAuditJSON() {
  const ledgerArr = [];
  IdempotencyLedger.forEach((v, k) => {
    ledgerArr.push({ key: k, ...v });
  });

  const payload = {
    client: "relayctl - Distributed Webhook Dispatch CLI",
    exportTimestamp: new Date().toISOString(),
    clusterStatus: {
      region: "ap-southeast-1",
      workersOnline: 16,
      p99LatencyMs: 1.42,
      replayGuard: "100% ATOMIC"
    },
    idempotencyLedger: ledgerArr
  };

  const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadLink = document.createElement("a");
  downloadLink.href = jsonStr;
  downloadLink.download = `relay_audit_ledger_${Date.now()}.json`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
}