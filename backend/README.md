# Backend (Node.js + Prisma + PostgreSQL)

## Start PostgreSQL locally

```bash
docker compose up -d
```

## Prisma setup

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

## Run API

```bash
npm run dev
```
