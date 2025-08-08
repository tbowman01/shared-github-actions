# ADR-001: Repository Directory Structure

## Status
**PROPOSED** - 2024-08-08

## Context
The Shared GitHub Actions repository needs a well-organized structure to support multiple action types, Claude-Flow integration, comprehensive testing, and scalable development workflows. The structure must accommodate:

- Multiple action types (composite, JavaScript, Docker)
- Shared utilities and libraries
- Claude-Flow agent coordination
- Comprehensive testing strategies
- Documentation and examples
- Configuration management

## Decision

We will adopt a **domain-driven directory structure** that separates concerns by:

1. **Action type separation**: `/actions/{composite,javascript,docker}/`
2. **Shared utilities centralization**: `/src/lib/`
3. **Testing stratification**: Unit tests co-located, integration/e2e in `/tests/`
4. **Configuration centralization**: `/config/` with environment-specific overrides
5. **Documentation by audience**: `/docs/{architecture,user-guides,developer,api}/`

### Key Structural Decisions:

#### Actions Organization
```
actions/
├── composite/          # YAML-based actions
├── javascript/         # Node.js actions
└── docker/            # Container-based actions
```

**Rationale**: Different action types have distinct development workflows, tooling requirements, and testing needs.

#### Shared Code Strategy
```
src/
├── lib/               # Reusable libraries
├── types/             # TypeScript definitions
└── utils/             # Utility functions
```

**Rationale**: Centralizes common functionality, reduces duplication, enables consistent APIs across actions.

#### Testing Approach
```
actions/*/             # Unit tests co-located with source
tests/
├── integration/       # Cross-action integration tests
├── e2e/              # Full workflow end-to-end tests
└── fixtures/         # Shared test data
```

**Rationale**: Multi-layered testing strategy provides rapid feedback and comprehensive validation.

## Alternatives Considered

### Alternative 1: Flat Action Structure
```
actions/
├── code-quality-suite/
├── pr-analyzer/
├── security-scanner/
└── ...
```
**Rejected**: Difficult to scale, mixed action types create tooling complexity, harder to apply type-specific standards.

### Alternative 2: Feature-Based Organization
```
code-quality/
├── actions/
├── workflows/
└── docs/
security/
├── actions/
├── workflows/
└── docs/
```
**Rejected**: Creates silos, duplicates infrastructure, complicates shared utilities.

### Alternative 3: Monorepo with Separate Packages
```
packages/
├── composite-actions/
├── js-actions/
├── docker-actions/
├── shared-utils/
└── workflows/
```
**Rejected**: Overengineered for current scope, adds complexity without clear benefits, npm workspace overhead.

## Consequences

### Positive
- Clear separation of concerns
- Scalable action development
- Consistent development workflows
- Easy navigation and discovery
- Efficient shared code reuse
- Comprehensive testing coverage
- Type-specific optimizations

### Negative
- Initial setup complexity
- Requires discipline in file placement
- Multiple build processes for different action types
- Potential for configuration drift across environments

### Neutral
- Larger initial directory tree
- Need for clear documentation of structure conventions
- Requires onboarding for new contributors

## Implementation Plan

### Phase 1: Core Structure (Week 1)
- Create main directory skeleton
- Set up build tools for each action type
- Initialize shared utilities framework

### Phase 2: Action Migration (Week 2-3)
- Move existing actions to new structure
- Refactor to use shared utilities
- Update documentation

### Phase 3: Testing Infrastructure (Week 4)
- Implement testing frameworks
- Create fixture data
- Set up CI/CD pipelines

## Compliance

This ADR supports the following architectural principles:
- **Separation of Concerns**: Clear boundaries between action types
- **DRY Principle**: Shared utilities eliminate duplication
- **Testability**: Multi-layered testing approach
- **Maintainability**: Organized, navigable structure
- **Scalability**: Easy addition of new actions and types

## Related Decisions
- ADR-002: Action Type Standards
- ADR-003: Testing Strategy
- ADR-004: Shared Utilities Design
- ADR-005: Configuration Management