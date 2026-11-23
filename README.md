# Citizen client

The Vite + React client for Citizen.ng. Tailwind CSS is integrated through its Vite plugin. It owns the public landing page (`/`), document-grounded chat (`/chat`), and admin content workspace (`/admin/*`).

## Local development

```sh
npm install
npm run dev
```

Vite proxies `/api/*` and `/auth/*` to the local core API at `http://localhost:8081`. Set `VITE_API_URL` only when the API is hosted separately from the page in development or production. Browser requests use credentials for the allowlisted admin session.

## Hosting

Serve this app at `citizen.ng`. The separately maintained mini apps can be routed under paths such as `/hotlines` and `/december` by the deployment proxy. Keep their bundles and release flow independent. Route `/api/*` and `/auth/*` to `api.citizen.ng` or configure `VITE_API_URL` accordingly.

The admin screen and chat are wired to API contracts, but document management and chat retrieval remain inactive until those core services are implemented and configured. The production host must serve the client entry point for `/chat` and `/admin/*`; mini app prefixes should be routed to their own deployments before the client fallback.
