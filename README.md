# Funtime Messaging Platform

## Tech stack
- **Web client:** Next.js (React, TypeScript)
- **API server:** Node.js + Express (TypeScript)
- **Media services:** WebRTC with an SFU-style media relay
- **Data store:** PostgreSQL
- **Cache/queues:** Redis
- **Infrastructure:** Docker + Terraform (future)

## Repo layout
- `apps/web`: Next.js client application.
- `services/api`: Express API server, domain modules live here.
- `services/media-relay`: WebRTC media relay service.
- `docs/architecture.md`: system architecture and trust boundaries.

## Modules (API)
- Auth/Signup
- Messaging
- Key Management
- Admin Tooling
- Media Services

> This is a project skeleton intended to be expanded with implementation details.
