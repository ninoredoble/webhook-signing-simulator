# relay-core-api

An interactive browser study of two things every webhook sender has to get right: **signing** each request so the receiver can trust it, and **retrying** failures without overwhelming the receiver.

It is a simulator. It is a static page that runs entirely in your browser. There is no server, queue, database or cache behind it, it makes no network requests of its own, and the sample events, amounts and secret are made up. It is not a webhook delivery service, an API, or a production system.

## What you can do

1. **Sign a payload.** Edit the secret, timestamp and body. The page computes a real HMAC-SHA256 of `timestamp.body` with the browser's Web Crypto API and shows the request a receiver would see. Characters that change in the signature as you type are highlighted. A button checks the same code against the RFC 4231 test case 2 vector.
2. **Verify as the receiver.** Alter the body in transit, give the receiver a different secret, or make the request arrive late. Three checks run (read the header, check the timestamp is recent, recompute and compare the signature) and the receiver accepts or rejects.
3. **Retry with backoff.** Set a base wait, a maximum wait, a multiplier, how many attempts are allowed and how many of them fail. Four strategies run on the same seed so you can compare them: no jitter, full jitter, equal jitter and decorrelated jitter. Play the clock to watch them unfold, or read the table of send times.
4. **See why the jitter matters.** 200 simulated subscribers fail every attempt. Four histograms show how their first four retries pile up in time under each strategy, on one shared scale.

## The four waits

After the *k*th failure, let `d = min(cap, base × multiplier^(k−1))`.

| Strategy | Wait |
| --- | --- |
| No jitter | `d` |
| Full jitter | random between 0 and `d` |
| Equal jitter | `d/2` plus random between 0 and `d/2` |
| Decorrelated jitter | random between `base` and 3 × the previous wait, never above `cap` |

These are the strategies compared in the AWS Architecture Blog post "Exponential Backoff and Jitter". The code here is written from that description for this study. Randomness comes from a small seeded generator, so the same seed gives the same run.

## Honest limits

- `Relay-Signature` and the header layout are modelled on common webhook conventions; the name is made up for this study.
- The signature comparison is written to be constant-time, but JavaScript makes no timing guarantee. Use your platform's own helper in real code.
- The retry simulator models one endpoint that fails its first N attempts and then recovers. Real endpoints, networks and queues are messier.
- Do not paste a real secret into the page.

## Run it

Open `index.html` in a current browser, or serve the folder with any static server (Web Crypto needs a secure context, which `localhost` and GitHub Pages both provide):

```bash
git clone https://github.com/ninoredoble/relay-core-api.git
cd relay-core-api
python3 -m http.server 8000   # then open http://localhost:8000
```

Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Fonts

Schibsted Grotesk and Spline Sans Mono, both under the SIL Open Font License, are served from `fonts/` with their licences alongside.
