# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite, React, and Tailwind CSS (confirmed by the product owner).

## Users

- Nigerian citizens looking for understandable, source-backed civic information.
- The Citizen team, managing documents and mini app content through `/admin/*`.

## Product Purpose

Citizen.ng is a simple civic dashboard. The landing page explains the service; `/chat` helps people ask questions using a curated library of public documents.

## Positioning

Chat answers point to the documents and passages behind them. The product does not search the open web or provide news.

## Operating Context

- Public routes are `/` and `/chat`; administrator routes live under `/admin/*`.
- The core API runs at `api.citizen.ng`.
- Mini apps such as hotlines and December events are separately maintained React apps hosted under Citizen.ng paths and use the same API.
- The client repo owns the landing page, chat, and content admin shell. Mini app source is maintained separately.

## Capabilities and Constraints

- The chat must retrieve from approved indexed documents and make its sources inspectable.
- Google sign-in is restricted to an administrator email allowlist; public user registration is out of scope.
- Keep chat simple and do not add general web search or news retrieval.
- The API and document library are still being built; do not imply answers are live until the backend is connected.
- Public chat history and retention behavior have not been decided.

## Brand Commitments

- Citizen.ng should feel simple, approachable, and like a contemporary Nigerian civic guide.

## Evidence on Hand

- Agent architecture reference: `/home/sijirama/Desktop/me/coder/ferno/core`.
- Allowlisted Google auth reference: `/home/sijirama/Desktop/me/coder/work/ayo/core`.
- No Citizen document corpus or brand assets have been supplied.

## Product Principles

- Keep the source close to every answer.
- Use plain language for civic information.
- Keep content administration easy for a small team.
- Keep separately maintained mini apps out of the chat agent.
