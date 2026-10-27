# Kiru's Blueprint 📐

System design and delivery planning in one place. Describe a system in plain English, get an editable architecture plus a design doc, then turn it into sized, assigned tasks.

## Design Studio
- **Chat assistant:** "Design a ride-hailing app for 5M daily users with live tracking and payments." It draws the architecture and asks follow-ups (scale, read/write mix, consistency, regions).
- **Change it by talking:** "add Kafka", "use DynamoDB instead of Postgres", "remove the CDN", "scale to 50M users", "make it multi-region", "make it banking grade".
- **Interactive canvas:** drag, pan, zoom, connect, add from a component palette, tidy layout, undo.
- **High-level vs detailed design:** the canvas shows the HLD; "detailed design of the payment service" (or **📖 Full detailed design**) shows interfaces, scaling, failure handling, security and observability per component.
- **Design doc:** requirements, capacity estimates (live math), APIs, data model, trade-offs, risks; all editable.
- **Security & compliance:** banking profile adds WAF, HSM-backed keys, immutable audit log, and controls for PCI DSS, SOX, GLBA, data residency and third-party risk.
- **GenAI & models:** model routing (Claude Haiku / Sonnet / Opus, self-hosted option), private access and governance, plus practices against hallucination: grounding, citations, abstention, faithfulness checks, injection defence and evals.
- **Tests & edge cases:** generated per design (functional, negative, edge, performance, resilience, security, compliance, GenAI), plus your own.

## ▶ Data flow demo
Pick a critical workflow (answer a customer question with RAG, core request, payment, background job, document ingestion) and watch it play on the diagram: a dot travels between components, each one lights up as it's reached, and a panel explains what happens there with guardrail and health metrics. Try the scenarios: **PII in the question**, **prompt-injection attack** (blocked at the guardrail), **low-confidence answer** (abstains instead of hallucinating) and **model outage** (fails over). Metric values are illustrative.

Connectors can be **straight**, **elbow** or **curved**, and components are grouped into dashed, labelled **architecture layers**.

## Delivery Board
- Paste user stories in your own words; each is broken into small tasks with story points and acceptance criteria.
- **Backlog from design:** one epic per service plus platform and client epics.
- **Auto-assign** by skill level (1–5) and sprint capacity, with the reason shown on each task; rebalance any time.
- Kanban with drag and drop, filters, workload bars, and an editable team.

## Save & share
Autosaves to your browser; a library of designs; export **JSON** (re-importable), **Markdown** design doc (HLD + LLD + tests), **PNG/SVG** diagram, and a **CSV** for Jira import.

## AI mode (optional)
Works fully offline with the built-in engine. Add your own Anthropic API key in ⚙ settings for free-form design conversations; the key stays in your browser.

Static site: `index.html`, `engine.js`, `knowledge.js`, `app.js`. No build step.
