# Relay Core API

> **High-Throughput Distributed Webhook Dispatcher & Idempotency Sandbox**  
> An open-source distributed event delivery engine architected for asynchronous microservices, guaranteed at-least-once delivery with exactly-once consumer execution, and live HMAC cryptographic verification.

---

## ⚡ Architecture Overview

In distributed systems and microservice architectures, webhook deliveries are vulnerable to network partition timeouts, endpoint rate-limits, and replay attacks. 

**Relay Core** guarantees resilient event transmission via:
1. **Idempotency Keys (`Idempotency-Key`)**: Enforces atomic distributed locking in Redis to protect subscriber endpoints from executing duplicate business logic upon network retries.
2. **Truncated Exponential Backoff with Decorrelated Jitter**: Prevents downstream thundering herd problems during subscriber outages ($t = 2^N + \text{jitter}$).
3. **Cryptographic Payload Signing (`X-Relay-Signature`)**: Computes SHA-256 HMAC message authentication codes incorporating a transmission timestamp to defeat replay attacks.

---

## 🛠️ Sandbox Capabilities

- **Interactive Event Builder**: Select from production event topics (CEPALCO utility settlements, grid meter threshold alarms, OAuth identity revocation).
- **HTTP Wire Inspector**: Live visualization of outgoing HTTP headers (`POST`, `Content-Type`, `X-Relay-Delivery`, `X-Relay-Signature`) alongside subscriber JSON acknowledgements.
- **Exponential Backoff Simulator**: Explores retry delays across attempts 1 through 5 with randomized jitter offsets.
- **Redis Idempotency Ledger**: Real-time inspection of active distributed keys, time-to-live expirations, and replay guards.

---

## 💻 Technical Standards

- **Aesthetic**: Minimalist developer reference design inspired by Stripe API Reference, Cloudflare Edge Workers, and Vercel Dashboard.
- **Color Palette**: Pitch slate (`#090b0e`), hairline grid borders (`#212833`), emerald success readouts (`#2ea043`), and high-contrast monospaced typography (`Geist Mono`).
- **Performance**: Zero external dependencies; zero runtime layout shifts.

---

## 🚀 Running Locally

```bash
# Clone the repository
git clone https://github.com/ninoredoble/relay-core-api.git

# Navigate into directory
cd relay-core-api

# Open index.html in any browser
open index.html
```
