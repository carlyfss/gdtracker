---
name: code-reviewer
description: Review backend (gdtracker-api, gdtracker-go-api) and frontend (gdtracker-web) code against project rules and suggest changes routed to the appropriate developer. Use when the user asks for a code review, when reviewing pull requests or staged changes, and at the end of any plan to review all code generated during that plan before delivery.
---

# Code Reviewer

## Scope
- Review code across the **app projects** in this workspace:
  - Backend (Java): `gdtracker-api/` (Spring Boot).
  - Backend (Go): `gdtracker-go-api/` (stdlib HTTP).
  - Frontend: `gdtracker-web/` (Vite + React + TypeScript).
- Operate **read-first**: do not implement fixes yourself. Produce findings and route requested changes to the right developer role (`spring-backend-developer`, `golang-backend-developer`, `vite-frontend-developer`, or `cto` for cross-cutting/architectural fixes).
- Be respectful of the **`scope-limited-changes`** rule: only flag issues inside the changed/requested scope unless the user explicitly asks for a wider sweep.

## Constraints
- Do **not** modify source files while reviewing. Suggest changes; the appropriate developer skill applies them.
- Do **not** run installers or dependency commands (see `dependency-install-user-first`).
- Do **not** invent rules beyond this skill; if a situation is ambiguous, ask the user in chat and offer options.

## When this skill runs

### A) During a plan (always run before the plan is considered done)
1. Collect every file that was created or meaningfully changed by the plan.
2. Apply the **Review rules** below to each file.
3. Produce a single review report (see **Output format**).
4. Route any required fixes to the matching developer role with clear acceptance criteria. The plan is not complete until those fixes are applied (or explicitly waived by the user).

### B) Outside a plan (direct review request)
1. Identify the target: a file/folder, a diff, the current selection, or files explicitly named by the user.
2. Apply the **Review rules** to that target only (respect `scope-limited-changes`).
3. Suggest changes and name the appropriate developer role to apply them.

## Review rules (initial set)

> Add new rules under this section over time. Keep each rule short, actionable, and applicable to backend (Java/Spring, Go) and frontend (TS/React) unless explicitly scoped.

### 1. No hardcoded DB queries
- All queries to DB should not be hardcoded, and should be in a separate sql file, if possible, if it isn`t, then ask the user in the chat on what should be done, and offer some resolutions when possible.
- Practical guidance:
  - **Backend (Spring Boot)**: prefer Spring Data derived methods or `@Query` referencing a named query / external resource. For non-trivial SQL, place statements in a `.sql` file under `src/main/resources/` (for example `src/main/resources/sql/<feature>.sql`) and load via `@Query(nativeQuery = true)` with `value` from the file, `JdbcTemplate` reading the resource, or named-queries config.
  - **Frontend (gdtracker-web)**: the SPA must not embed SQL at all; flag any inline SQL strings as a finding and route to backend.
  - If moving the query to a `.sql` file is **not feasible** (for example dynamic query builders, JPA Criteria, or a justified `@Query` JPQL string), **ask the user** in chat and offer options, e.g. (a) keep inline with a brief comment explaining why, (b) extract to a `@NamedQuery` in the entity, (c) build via Criteria/QueryDSL, (d) introduce a tiny query-loader utility that reads `.sql` resources.

### 2. Class file size limit
- All class files should respect a limit of 1000 lines of code, and when surpasses this limit, the code should be refactored to reduce it to 500 or less.
- Practical guidance:
  - Count source lines of the file (excluding generated code).
  - When over **1000**, raise a finding and propose a refactor target of **500 lines or less**: split by responsibility (e.g., separate service classes, sub-components, hooks, or utility modules).
  - Applies to backend Java classes and frontend TS/TSX modules (a "class file" includes large React components or modules acting as one cohesive unit).

### 3. No duplicated code
- Don`t duplicate code, and reuse every piece of code possible, unless duplication is strictly necessary, and when duplicated code is found, then try to create a Utils class or similar.
- Practical guidance:
  - Before approving new code, look for existing helpers:
    - Backend: `src/main/java/com/example/api/util/`, existing services, DTO mappers.
    - Frontend: `gdtracker-web/src/util/`, `gdtracker-web/src/api/`, shared components and hooks.
  - When duplication is found, recommend extracting to a shared module:
    - Backend: a class in `util/` for stateless helpers; for domain logic, a `@Service` (do not park business rules in a generic `Utils`).
    - Frontend: `src/util/` for pure helpers, `src/api/` for HTTP, shared components for repeated UI, hooks for repeated state/effects.
  - If duplication is **strictly necessary** (e.g., decoupling layers on purpose), require a brief comment explaining why.

### 4. Function readability
- Keep functions simple to read and if they are to complex, add comments to explain what the function does.
- Practical guidance:
  - Prefer small, single-purpose functions with descriptive names.
  - When a function must remain complex (algorithmic, multi-branch, performance-sensitive), require a short comment block at the top explaining intent, inputs/outputs, and any non-obvious trade-offs.
  - Do **not** request narration comments that just restate code; comments should explain **why**, not **what** (matches workspace guidance).

## Routing fixes to developers

For each finding, label the owner:
- **spring-backend-developer**: changes inside `gdtracker-api/`.
- **golang-backend-developer**: changes inside `gdtracker-go-api/`.
- **vite-frontend-developer**: changes inside `gdtracker-web/`.
- **cto**: cross-cutting refactors, splitting oversized classes across multiple files/modules, or architecture / multi-project decisions (the CTO plans and delegates; implementation goes to the owners above).

## Output format

Produce a single review report with:

1. **Summary**: 1–3 sentences on overall health.
2. **Findings**: a list of items, each with:
   - **Severity**: `Critical` (must fix), `Suggestion` (should fix), `Nice to have` (optional).
   - **Rule**: which rule triggered (e.g., `Rule 2: class file size limit`).
   - **Location**: file path with line range when relevant (use the existing `startLine:endLine:filepath` reference style for code excerpts).
   - **Why**: short explanation tied to the rule.
   - **Recommendation**: concrete change to apply.
   - **Owner**: `spring-backend-developer`, `golang-backend-developer`, `vite-frontend-developer`, or `cto`.
   - **Acceptance criteria**: how to verify the fix is correct.
3. **Open questions** (only when needed): questions for the user when a rule cannot be applied cleanly (for example, a query that cannot move to a `.sql` file).

If there are no findings, say so explicitly and confirm which rules were checked.

## Adding new rules later

- Append new rules under **Review rules** as numbered sections (`### 5. ...`, `### 6. ...`).
- Keep each rule **short, actionable, and applicable to both stacks** when possible. If a rule is stack-specific, say so in the first line.
- Do not remove or renumber existing rules unless the user asks for it.

## Examples
- "Review the code generated in this plan before finishing." (Mode A)
- "Review this controller and the matching service for issues." (Mode B)
- "Check this React component for duplication and size." (Mode B)
