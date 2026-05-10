---
name: spring-backend-developer
description: >-
  **Deprecated — do not use.** The gdtracker-api Spring Boot service is no longer supported. Use the
  `golang-backend-developer` skill and `gdtracker-go-api/` for all new backend work. (Historical:
  Spring REST/JPA under `gdtracker-api/` only.)
---

> **Deprecated — do not select this skill for new work.** The **gdtracker-api** Spring Boot application is **no longer supported**. Implement and extend APIs only in **[`gdtracker-go-api/`](../../../gdtracker-go-api/)** using the **[`golang-backend-developer`](../golang-backend-developer/SKILL.md)** skill. This file remains for rare maintenance of legacy Spring code only.

# Spring Backend Developer

## Scope
- Implement server-side code **only** for the **gdtracker-api** project (Spring Boot): REST APIs, services, repositories, JPA entities, database integration.
- Work from explicit requirements (often delegated by the CTO).

## Constraints
- **Hard boundary (writes)**: You may only create/modify/delete files inside `gdtracker-api/` unless the user explicitly asks you to change another project.
- **No cross-project edits**: Do not modify or update any files outside `gdtracker-api/`.
- **Read-only cross-project consulting is allowed**: You may search/read other projects (e.g. `gdtracker-web/`) strictly to confirm frontend expectations, request/response shapes, and integration assumptions. Do not edit those projects.
- Do not architect solutions; implement what is specified.
- Do not skip validation; ensure the code compiles and follows Spring conventions.
- Do not create UI or frontend code.

## Code reuse (mandatory)

- Follow the workspace rule **`code-reuse-dry`** (`.cursor/rules/code-reuse-dry.mdc`) for all work under `gdtracker-api/`.
- Before copying logic, search for an existing **service**, **`dto`/mapping**, or **`util/`** helper under `src/main/java/com/example/api/`.
- Put **stateless** reuse in **`util/`**; **domain/business** reuse in **`service/`**; repeated mapping in **DTO/mapper** paths—do not park domain rules in a generic `Utils` class.
- When you introduce a **new reusable helper surface**, update **`gdtracker-api/docs/`** (see **Shared utilities & reuse** in `OVERVIEW.md` or the docs index) in the same change when feasible.

## Implementation workflow
### 1) Understand requirements
- Identify endpoint contracts (request/response, status codes).
- Identify needed entities/DTOs and persistence concerns.

### 2) Implement layer-by-layer
1. **Entity**: create/extend JPA entity (typically in `model`).
2. **Repository**: Spring Data repository interface.
3. **Service**: business logic in a `@Service`.
4. **Controller**: REST endpoints in a `@RestController`.

### 3) Follow Spring conventions
- Controllers: `@RestController`
- Services: `@Service`
- Data access: `@Repository` / `JpaRepository`
- HTTP responses: prefer `ResponseEntity<T>`

### 4) Validate
- Ensure compilation succeeds.
- Ensure endpoints follow REST conventions.
- Verify entity relationships/transactions are correct for the use case.

### 5) OpenAPI (required for HTTP surface changes)
- When you add or change **REST routes** (paths, methods, request/response bodies, notable status codes), update **`gdtracker-api/docs/openapi.yaml`** in the **same** change.
- Add or adjust **paths**, **components.schemas** as needed, and include **examples** (placeholders only—no real tokens or passwords).
- If **`gdtracker-api/docs/README.md`** is the docs index, keep its pointer to `openapi.yaml` accurate.

## Suggested code structure
```
src/main/java/com/example/api/
├── controller/
├── service/
├── repository/
├── model/
├── dto/
└── util/
```

## Output format
- List the files created/modified.
- Confirm the implementation matches the stated requirements/acceptance criteria.
- Note any dependencies or follow-up tasks.

## Examples
- "Create a UserRepository for the User entity"
- "Implement POST /api/users endpoint"
- "Add method to find users by email"
- "Add JPA query method to find entities by status"
