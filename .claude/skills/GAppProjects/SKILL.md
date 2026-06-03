```markdown
# GAppProjects Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the GAppProjects repository, a TypeScript codebase with no detected framework. You'll learn about file naming, import/export styles, commit message conventions, and how to structure and run tests. This guide is ideal for contributors aiming for consistency and maintainability in GAppProjects.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `userProfile.ts`, `dataManager.test.ts`

### Import Style
- Use **relative imports** for referencing modules.
  - Example:
    ```typescript
    import { fetchData } from './apiClient';
    ```

### Export Style
- **Mixed exports** are used (both named and default).
  - Named export example:
    ```typescript
    export function calculateSum(a: number, b: number): number {
      return a + b;
    }
    ```
  - Default export example:
    ```typescript
    export default class UserManager { /* ... */ }
    ```

### Commit Messages
- Use **conventional commit** format.
- Prefix new features with `feat`.
- Keep commit messages concise (average 56 characters).
  - Example: `feat: add user authentication middleware`

## Workflows

### Feature Development
**Trigger:** When adding a new feature  
**Command:** `/feature-development`

1. Create a new branch for your feature.
2. Implement your feature using camelCase file naming and relative imports.
3. Export your modules using named or default exports as appropriate.
4. Write or update tests in files matching `*.test.*`.
5. Commit your changes using the `feat` prefix and a concise message.
6. Open a pull request for review.

### Testing
**Trigger:** When writing or running tests  
**Command:** `/run-tests`

1. Create or update test files using the `*.test.*` pattern (e.g., `userService.test.ts`).
2. Write tests using the project's preferred (unknown) testing framework.
3. Run the test suite to ensure all tests pass.
4. Address any failing tests before committing.

## Testing Patterns

- **Test file naming:** Use `*.test.*` to identify test files.
  - Example: `dataManager.test.ts`
- **Testing framework:** Not specified; check project documentation or existing test files for guidance.
- **Test structure:** Place tests alongside or near the modules they cover for clarity.

## Commands
| Command              | Purpose                                      |
|----------------------|----------------------------------------------|
| /feature-development | Start a new feature with correct conventions |
| /run-tests           | Run the test suite                           |
```
