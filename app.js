// Relay Core API — Client Webhook Sandbox Controller

const TOPIC_PAYLOADS = {
  "payment.settled": {
    "event": "invoice.payment_settled",
    "timestamp": 1734509122,
    "data": {
      "invoice_id": "inv_cdo_cepalco_84920",
      "account_number": "08-4192-019",
      "billing_district": "Carmen Urban Feeder",
      "amount_php": 4850.50,
      "currency": "PHP",
      "settlement_gateway": "BPI_DIRECT_DEBIT",
      "reconciliation_hash": "a48f09bc12d847"
    }
  },
  "meter.threshold_breach": {
    "event": "grid.meter_threshold_breach",
    "timestamp": 1734509180,
    "data": {
      "substation": "Lugait 138kV Substation",
      "feeder_id": "FDR-01-HOLCIM-69KV",
      "phase_current_a": 418.2,
      "threshold_limit_a": 400.0,
      "voltage_sag_pu": 0.942,
      "auto_trip_armed": true
    }
  },
  "auth.session_revoked": {
    "event": "identity.auth_session_revoked",
    "timestamp": 1734509210,
    "data": {
      "user_id": "usr_gnegr_7842",
      "session_id": "sess_tok_948f2190bb",
      "reason": "ADMINISTRATIVE_ROTATION",
      "origin_ip": "120.29.74.18",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  },
  "drone.telemetry_anomaly": {
    "event": "iot.drone_telemetry_anomaly",
    "timestamp": 1734509295,
    "data": {
      "aircraft_id": "UAV-CDO-BASIN-03",
      "gps_latitude": 8.4829,
      "gps_longitude": 124.6412,
      "altitude_agl_meters": 118.4,
      "wind_shear_knots": 28.6,
      "failsafe_engaged": "RETURN_TO_HOME_MACASANDIG"
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  onTopicChange();
});

function onTopicChange() {
  const topic = document.getElementById("eventSelect").value;
  const payload = TOPIC_PAYLOADS[topic];
  document.getElementById("payloadEditor").value = JSON.stringify(payload, null, 2);
  computeMockHMAC();
}

function generateNewKey() {
  const rand = Math.random().toString(16).substring(2, 10);
  document.getElementById("idempotencyKey").value = `idem_cdo_${rand}`;
  computeMockHMAC();
}

function computeMockHMAC() {
  const randHex = Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = `t=${timestamp},v1=${randHex}`;
  document.getElementById("hmacSigOutput").innerText = signature;
}

function switchView(tabId, el) {
  document.querySelectorAll(".view-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".view-tab-content").forEach(c => c.classList.remove("active"));

  el.classList.add("active");
  document.getElementById(`view-${tabId}`).classList.add("active");
}

function dispatchWebhook() {
  const topic = document.getElementById("eventSelect").value;
  const key = document.getElementById("idempotencyKey").value;
  const url = document.getElementById("targetUrl").value;
  const sig = document.getElementById("hmacSigOutput").innerText;
  const payloadStr = document.getElementById("payloadEditor").value;

  let parsed;
  try {
    parsed = JSON.parse(payloadStr);
  } catch(e) {
    alert("Invalid JSON in payload editor. Please check syntax.");
    return;
  }

  // Update wire transmission view
  const now = new Date();
  const utcStr = now.toISOString().replace("T", " ").replace("Z", " UTC");
  document.getElementById("wireTimestamp").innerText = utcStr;

  const path = new URL(url).pathname || "/v1/webhooks/listener";
  const host = new URL(url).host || "api.subscriber.ph";
  const delivId = `deliv_${Math.random().toString(16).substring(2, 14)}`;

  document.getElementById("reqHeadersBlock").innerText = `POST ${path} HTTP/1.1
Host: ${host}
Content-Type: application/json
User-Agent: RelayCore/2.4 (Distributed Webhook Engine)
X-Relay-Event: ${topic}
X-Relay-Delivery: ${delivId}
X-Relay-Signature: ${sig}
Idempotency-Key: ${key}`;

  document.getElementById("ackBlock").innerText = JSON.stringify({
    "acknowledged": true,
    "received_at": now.toISOString(),
    "idempotency_cached": true,
    "delivery_id": delivId,
    "status": "processed"
  }, null, 2);

  // Update Tail Logs
  const timeStr = now.toTimeString().split(" ")[0] + "." + now.getMilliseconds().toString().padStart(3, '0');
  const tail = document.getElementById("tailLogs");
  tail.innerHTML = `
    <div class="log-line text-success"><code>[${timeStr}]</code> &bull; DISPATCH: HTTP 200 OK &bull; ${delivId} acknowledged by ${host}</div>
    <div class="log-line"><code>[${timeStr}]</code> &bull; IDEMPOTENCY: Cached ${key} in Redis with 86400s TTL</div>
  ` + tail.innerHTML;

  // Append to Idempotency vault table
  const tbody = document.getElementById("vaultTableBody");
  const newRow = `
    <tr>
      <td><code>${key}</code></td>
      <td>${topic}</td>
      <td>Just now</td>
      <td><span class="status-pill pill-fresh">FRESH LOCK</span></td>
    </tr>
  `;
  tbody.innerHTML = newRow + tbody.innerHTML;
}
