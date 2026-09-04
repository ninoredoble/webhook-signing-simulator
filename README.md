# relayctl: Distributed Webhook Dispatch & TUI Terminal Console

> **Interactive Terminal Emulator, Idempotency Engine & Wire Frame Inspector**  
> An authentic UNIX terminal workstation (`relayctl`) modeling distributed webhook dispatch, atomic idempotency replay protection, RFC 7946 wire hex framing, and decorrelated exponential retry backoff.

---

## Overview

High-throughput distributed webhook systems require strict idempotency guarantees, cryptographic signature verification, and robust retry backoff strategies to prevent duplicate payment settlements or data corruption across unreliable subscriber endpoints.

**relayctl** provides a terminal user interface (TUI) and interactive REPL to test, inspect, and evaluate event dispatching pipelines in real time. Built in pure vanilla web technologies with zero runtime overhead, it simulates multi-worker queuing, Redis-backed idempotency caching, and wire frame packet inspection.

---

## Core Systems & Capabilities

### 1. In-Memory Distributed Idempotency Ledger
- **Atomic Replay Guard**:
  Every inbound event is verified against an in-memory distributed key-value store.
  - If a key is new: acquires distributed lock, generates delivery ID, signs payload, and returns `[HTTP 200 OK]`.
  - If a key was previously settled: detects the duplicate dispatch, halts execution, returns `[HTTP 409 CONFLICT] // REPLAY BLOCKED`, and outputs the cached response.

### 2. RFC 7946 Wire Frame Hex Dump Inspector
- Dynamic 16-byte hex dump pane displaying memory address offsets (`00000000` to `00000070`), raw hexadecimal byte pairs, and printable ASCII wire representations.
- Dynamically parses HTTP headers, `Idempotency-Key`, `X-Relay-Event`, and `X-Signature` timestamps.

### 3. Decorrelated Jitter Exponential Retry Backoff
- Simulates subscriber HTTP 504 gateway timeouts using the AWS/Full-Jitter algorithm:
  `sleep = min(cap, random(base, sleep * 3))`
- Demonstrates how decorrelated random noise prevents "thundering herd" concurrency stampedes against recovering subscriber servers.

### 4. Daemon Worker Pool Monitor (`top`)
- Live table monitoring 16 background daemon worker threads across `billing.settled`, `grid.telemetry`, and `backoff.jitter` queues with status indicators (`POLLING`, `DELAY`, `ACTIVE`).

---

## Command Reference

| Command | Syntax | Description |
|:---|:---|:---|
| **help** | `help` | Displays available commands and keybindings |
| **status** | `status` | Checks cluster health, throughput, and Redis ledger size |
| **dispatch** | `dispatch [topic] [key]` | Dispatches signed webhook with idempotency check |
| **replay** | `replay [key]` | Simulates network replay to trigger 409 Conflict guard |
| **backoff** | `backoff [attempts]` | Runs exponential retry simulation with decorrelated jitter |
| **inspect** | `inspect [key]` | Formats RFC 7946 wire frame and raw hex dump |
| **keys** | `keys` | Queries Redis distributed idempotency lock cache |
| **top** | `top` | Refreshes daemon worker thread status |
| **export** | `export` | Downloads complete JSON audit trail of deliveries |
| **clear** | `clear` | Clears terminal scrollback buffer |

---

## Keyboard Shortcuts

- `F1`: Open help menu
- `F2`: Quick dispatch
- `F3`: Run backoff simulation
- `F4`: Inspect wire frame hex dump
- `F10`: Export audit ledger to JSON
- `Arrow Up / Down`: Navigate command history

---

## Technical Specifications

- **Stack**: Vanilla HTML5, Vanilla ES6+ JavaScript, Pure CSS3 TUI styling.
- **Character Encoding**: 100% 7-bit ASCII (zero mojibake / corrupted box-drawing bytes).
- **Zero Runtime Dependencies**: Runs natively in any modern browser without node or npm.

---

## Running Locally

```bash
# Clone the repository
git clone https://github.com/ninoredoble/relay-core-api.git

# Navigate to directory
cd relay-core-api

# Open index.html in any modern browser
# (Windows)
start index.html

# (macOS)
open index.html

# (Linux)
xdg-open index.html
```