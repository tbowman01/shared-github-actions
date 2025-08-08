# ADR-002: Action Types and Implementation Strategy

## Status
**PROPOSED** - 2024-08-08

## Context
GitHub Actions can be implemented in three different ways, each with distinct advantages and use cases. Our shared actions repository must support all three types while maintaining consistency and leveraging Claude-Flow integration effectively.

The three action types are:
1. **Composite Actions**: YAML-based, using existing actions and shell commands
2. **JavaScript Actions**: Node.js-based, running directly on the runner
3. **Docker Actions**: Container-based, with full environment control

## Decision

We will implement a **multi-type action strategy** that leverages each action type for its optimal use cases:

### Action Type Selection Criteria

#### Composite Actions (YAML-based)
**Use for:**
- Workflow orchestration and step sequencing
- Combining existing actions into higher-level operations
- Simple shell script execution
- Actions that don't require complex logic

**Examples:**
- Code quality suites combining multiple linters
- Test automation workflows
- Basic reporting and notification

#### JavaScript Actions (Node.js)
**Use for:**
- GitHub API interactions
- Complex business logic
- Real-time data processing
- Integration with web services
- Performance-critical operations

**Examples:**
- PR analysis and automated reviews
- Issue triage and labeling
- Release management
- Metrics collection and reporting

#### Docker Actions (Container-based)
**Use for:**
- Language-specific tooling
- Complex environment requirements
- Security scanning tools
- Legacy tool integration
- Isolated execution environments

**Examples:**
- Multi-language linting and formatting
- Security vulnerability scanning
- Compliance checking
- Database migrations

### Implementation Standards

#### Composite Actions Structure
```yaml
# action.yml
name: 'Action Name'
description: 'Action description'
inputs:
  parameter:
    description: 'Parameter description'
    required: true
    default: 'default-value'
outputs:
  result:
    description: 'Output description'
    value: ${{ steps.step-id.outputs.value }}

runs:
  using: 'composite'
  steps:
    - name: Step Name
      shell: bash
      run: |
        echo "Step execution"
    - name: Claude-Flow Coordination
      uses: ./actions/javascript/claude-flow-coordinator
      with:
        agent-type: 'code-analyzer'
        task: ${{ inputs.task }}
```

#### JavaScript Actions Structure
```typescript
// src/main.ts
import * as core from '@actions/core';
import * as github from '@actions/github';
import { ClaudeFlowCoordinator } from '../lib/claude-flow';

async function run(): Promise<void> {
  try {
    const coordinator = new ClaudeFlowCoordinator();
    await coordinator.initializeSwarm('hierarchical');
    
    const agent = await coordinator.spawnAgent('code-analyzer');
    const results = await agent.execute(task);
    
    core.setOutput('results', JSON.stringify(results));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
```

#### Docker Actions Structure
```dockerfile
FROM python:3.11-slim

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY src/ /app/src/
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

### Claude-Flow Integration Strategy

#### Agent Coordination Pattern
1. **Initialization**: Each action initializes Claude-Flow coordination
2. **Agent Spawning**: Spawn appropriate specialized agents
3. **Task Distribution**: Distribute work across agent swarm
4. **Result Aggregation**: Collect and synthesize results
5. **Memory Persistence**: Store learnings for future runs

#### Agent Types by Action Category
- **Code Quality**: `code-analyzer`, `reviewer`, `formatter`
- **Testing**: `tester`, `coverage-analyzer`, `performance-benchmarker`
- **Security**: `security-scanner`, `vulnerability-analyzer`, `compliance-checker`
- **Documentation**: `doc-generator`, `api-documenter`, `content-validator`

## Alternatives Considered

### Alternative 1: Single Action Type
**Rejected**: Limits flexibility, forces suboptimal implementations, reduces performance for specialized tasks.

### Alternative 2: Language-Specific Separation
**Rejected**: Creates artificial boundaries, complicates multi-language projects, duplicates infrastructure.

### Alternative 3: Complexity-Based Separation
**Rejected**: Subjective criteria, difficult to maintain consistency, unclear boundaries.

## Consequences

### Positive
- Optimal tool selection for each use case
- Leverages strengths of each action type
- Maintains consistency across implementations
- Supports advanced Claude-Flow features
- Enables specialized optimizations

### Negative
- Increased complexity in build and test processes
- Multiple development workflows to maintain
- Potential for inconsistent patterns across types
- Learning curve for developers

### Mitigation Strategies
- Comprehensive documentation and examples
- Shared utilities and patterns
- Automated testing across all types
- Clear decision criteria for type selection

## Implementation Guidelines

### Development Workflow
1. **Planning**: Determine optimal action type based on criteria
2. **Scaffolding**: Use type-specific templates
3. **Implementation**: Follow established patterns and utilities
4. **Testing**: Type-specific and integration testing
5. **Documentation**: Consistent documentation standards

### Quality Gates
- All actions must include comprehensive tests
- All actions must integrate with Claude-Flow coordination
- All actions must follow semantic versioning
- All actions must include usage examples

### Performance Targets
- **Composite**: <30 seconds execution time
- **JavaScript**: <60 seconds for complex operations
- **Docker**: <90 seconds including container startup

## Related Decisions
- ADR-001: Directory Structure
- ADR-003: Testing Strategy
- ADR-004: Claude-Flow Integration
- ADR-005: Version Management Strategy