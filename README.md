# Digital Television Solution

Fresh rebuild of the television automation platform.

## Architecture

- Next.js web control panel
- Android broadcast engine (next stage)
- Cloud media storage
- Automated schedule
- Automated news
- Multi-destination streaming
- Analytics and audience tools
- Failsafe/reconnect/watchdog

The web app is intentionally a clean foundation. Real publishing credentials and external APIs are added through environment variables and official OAuth/API flows rather than hard-coded secrets.

Deploy this repository as a Next.js project on Vercel with the repository root as the Root Directory. Vercel supports zero-configuration Next.js deployment and Git pushes can trigger automatic deployments.

## Broadcast engine

LiveKit Cloud is configured as the server-side media/egress engine for real RTMPS broadcasting.
