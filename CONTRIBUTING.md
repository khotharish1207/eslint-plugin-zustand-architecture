# Contributing

Thank you for contributing to `eslint-plugin-zustand-architecture`!

## Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd plugin\ 123

# Install dependencies
npm install

# Run the test suite
npm test

# Typecheck
npm run typecheck

# Build
npm run build

# Lint
npm run lint
```

## Project Structure

```
src/
  analyzer/     # Shared analysis engine (store discovery, registry, graph, resolution)
  parser/       # Parser utilities (reserved for future use)
  rules/        # ESLint rules (one file per rule)
  configs/      # Configs and schema validation
  types/        # Core type definitions
  utils/        # Shared utilities (AST walker, rule helper)
tests/
  rules/        # Rule tests (RuleTester)
  analyzer/     # Analyzer engine tests
  fixtures/     # Test fixtures
docs/
  rules/        # Per-rule documentation
```

## Adding a New Rule

1. Create `src/rules/no-new-rule.ts` following the pattern of existing rules:
   - Use `Rule.RuleModule` type
   - Export default rule object with `meta` and `create`
   - Use ESLint native visitor pattern
2. Add tests in `tests/rules/no-new-rule.test.ts` using RuleTester
3. Register the rule in `src/index.ts` (`rules` object + `recommended`/`strict` configs)
4. Add documentation in `docs/rules/no-new-rule.md`

## Testing

- All rules use Vitest + ESLint RuleTester
- Include valid and invalid cases for each rule
- Test TypeScript and JavaScript cases
- Test aliases, barrel exports, cross-file scenarios
- Test self-access exclusion and non-Zustand object exclusion

## Code Style

- TypeScript with strict mode
- Prettier-compatible formatting
- ESLint flat config for self-linting

## Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
5. Submit a pull request

## License

MIT