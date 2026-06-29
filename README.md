# nodejs-openhab-test-suite-backend

Stateless Express backend for the
[nodejs-openhab-test-suite](https://github.com/Michdo93/nodejs-openhab-test-suite)
web frontend.

Every request carries credentials in the body — no session state is stored.
The backend instantiates the requested tester class per call, runs the method,
captures `console.log`/`console.error`/`console.warn` output, and returns the
result as JSON.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check / wake-up |
| `POST` | `/api/connect` | Verify credentials → `{ loggedIn, isCloud }` |
| `POST` | `/api/test` | Run a tester method → `{ result, output }` |

### `POST /api/test`

```json
{
  "url":      "https://myopenhab.org",
  "username": "user@example.com",
  "password": "secret",
  "tester":   "ItemTester",
  "method":   "testSwitch",
  "params":   ["MySwitch", "ON", "ON", 10]
}
```

Response:

```json
{ "result": true, "output": "OK: MySwitch reached state ON" }
```

Available testers: `ItemTester`, `ThingTester`, `RuleTester`,
`ChannelTester`, `PersistenceTester`, `SitemapTester`.

## npm Dependencies

- `nodejs-openhab-rest-client` — npm
- `nodejs-openhab-test-suite`  — npm
- `express`                     — npm
- `cors`                        — npm

Both openHAB libraries must be published to npm before
`npm install` can succeed during the Docker build.

## Local development

```bash
npm install
npm start
# → http://localhost:8080
```

Or with auto-restart:

```bash
npm run dev
```

## Docker

```bash
docker build -t nodejs-openhab-test-suite-backend .
docker run -p 8080:8080 nodejs-openhab-test-suite-backend
```

## Deploy on Render.com

1. Publish `nodejs-openhab-rest-client` and `nodejs-openhab-test-suite` to npm.
2. Push this repository to GitHub.
3. On [render.com](https://render.com): **New → Web Service → Connect repository**.
4. Settings:
   - **Language:** Docker
   - **Region:** Frankfurt (EU Central)
   - **Plan:** Free
   - **Environment variable:** `PORT = 8080`
5. Click **Deploy**.

Live URL: `https://nodejs-openhab-test-suite-backend.onrender.com`

## License

MIT
