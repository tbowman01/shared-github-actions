# ADR-003: Version Management and Release Strategy

## Status
**PROPOSED** - 2024-08-08

## Context

GitHub Actions require careful version management to ensure backward compatibility, enable controlled rollouts, and provide users with stable, predictable interfaces. Our shared actions repository must support:

1. **Multiple concurrent versions** in production
2. **Semantic versioning** for clear compatibility signals
3. **Automated release processes** to reduce manual overhead
4. **Rollback capabilities** for quick issue resolution
5. **Migration paths** between major versions
6. **Claude-Flow integration** version coordination

## Decision

We will implement a **comprehensive version management strategy** based on semantic versioning with automated release processes and sophisticated rollback capabilities.

### Version Numbering Scheme

We adopt **Semantic Versioning 2.0.0** with the following interpretation:

#### Format: `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`

- **MAJOR**: Incompatible API changes, breaking workflows
- **MINOR**: Backward-compatible functionality additions
- **PATCH**: Backward-compatible bug fixes
- **PRERELEASE**: Alpha, beta, or release candidate versions
- **BUILD**: Build metadata (commit hash, build number)

#### Examples:
- `1.0.0` - Initial stable release
- `1.1.0` - New features, backward compatible
- `1.1.1` - Bug fixes
- `2.0.0-beta.1` - Major version beta
- `1.2.3+abc123` - With build metadata

### Git Tagging Strategy

#### Tag Patterns
```bash
# Full semantic version tags
v1.2.3
v2.0.0-beta.1
v1.1.1+build.123

# Major version aliases (auto-updated)
v1      # Points to latest v1.x.x
v2      # Points to latest v2.x.x

# Minor version aliases (auto-updated)
v1.1    # Points to latest v1.1.x
v1.2    # Points to latest v1.2.x
```

#### Branch Strategy
```
main                    # Latest stable code
release/v1.x           # v1.x maintenance branch
release/v2.x           # v2.x maintenance branch
develop                # Integration branch
feature/feature-name   # Feature development
hotfix/issue-id        # Critical bug fixes
```

### Release Automation

#### Automated Release Workflow
```yaml
# .github/workflows/release.yml
name: Release Management

on:
  push:
    tags: ['v*']
    branches: [main]
  pull_request:
    types: [closed]

jobs:
  determine-version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      version-type: ${{ steps.version.outputs.type }}
    steps:
      - name: Determine Version
        id: version
        uses: ./actions/javascript/version-manager
        with:
          base-branch: main
          version-strategy: conventional-commits

  build-and-test:
    needs: determine-version
    runs-on: ubuntu-latest
    strategy:
      matrix:
        action-type: [composite, javascript, docker]
    steps:
      - name: Build Actions
        uses: ./actions/composite/build-suite
        with:
          action-type: ${{ matrix.action-type }}
          version: ${{ needs.determine-version.outputs.version }}

  release:
    needs: [determine-version, build-and-test]
    if: needs.determine-version.outputs.version-type != 'none'
    runs-on: ubuntu-latest
    steps:
      - name: Create Release
        uses: ./actions/javascript/release-manager
        with:
          version: ${{ needs.determine-version.outputs.version }}
          claude-flow-coordination: true
          notify-channels: slack,email
```

#### Version Determination Logic
```typescript
interface VersionStrategy {
  determineNextVersion(
    commits: Commit[],
    currentVersion: string,
    strategy: 'conventional-commits' | 'manual' | 'claude-flow'
  ): Promise<VersionBump>;
}

class ConventionalCommitStrategy implements VersionStrategy {
  async determineNextVersion(
    commits: Commit[],
    currentVersion: string,
    strategy: string
  ): Promise<VersionBump> {
    let bumpType: 'major' | 'minor' | 'patch' | 'none' = 'none';
    
    for (const commit of commits) {
      if (commit.message.includes('BREAKING CHANGE:')) {
        bumpType = 'major';
        break;
      } else if (commit.message.startsWith('feat:')) {
        if (bumpType !== 'major') bumpType = 'minor';
      } else if (commit.message.startsWith('fix:')) {
        if (bumpType === 'none') bumpType = 'patch';
      }
    }
    
    return {
      type: bumpType,
      version: this.calculateNewVersion(currentVersion, bumpType),
      changelog: await this.generateChangelog(commits)
    };
  }
}
```

### Compatibility Management

#### Backward Compatibility Matrix
```typescript
interface CompatibilityMatrix {
  [version: string]: {
    supportedInputs: string[];
    deprecatedInputs: DeprecatedInput[];
    requiredOutputs: string[];
    supportedRunners: string[];
    minimumGitHubActionsVersion: string;
  };
}

const compatibilityMatrix: CompatibilityMatrix = {
  'v1.0.0': {
    supportedInputs: ['token', 'repository'],
    deprecatedInputs: [],
    requiredOutputs: ['success', 'results'],
    supportedRunners: ['ubuntu-latest', 'windows-latest'],
    minimumGitHubActionsVersion: '1.0.0'
  },
  'v1.1.0': {
    supportedInputs: ['token', 'repository', 'claude-flow-enabled'],
    deprecatedInputs: [],
    requiredOutputs: ['success', 'results', 'metrics'],
    supportedRunners: ['ubuntu-latest', 'windows-latest', 'macos-latest'],
    minimumGitHubActionsVersion: '1.0.0'
  },
  'v2.0.0': {
    supportedInputs: ['token', 'repository', 'agent-config'],
    deprecatedInputs: [
      { name: 'claude-flow-enabled', replacedBy: 'agent-config', removalVersion: 'v3.0.0' }
    ],
    requiredOutputs: ['success', 'results', 'metrics', 'agent-data'],
    supportedRunners: ['ubuntu-latest', 'windows-latest', 'macos-latest'],
    minimumGitHubActionsVersion: '1.1.0'
  }
};
```

#### Migration Assistance
```typescript
class MigrationManager {
  async generateMigrationGuide(
    fromVersion: string,
    toVersion: string
  ): Promise<MigrationGuide> {
    const fromCompat = compatibilityMatrix[fromVersion];
    const toCompat = compatibilityMatrix[toVersion];
    
    return {
      breaking_changes: this.identifyBreakingChanges(fromCompat, toCompat),
      deprecated_features: this.identifyDeprecations(toCompat),
      new_features: this.identifyNewFeatures(fromCompat, toCompat),
      migration_steps: await this.generateMigrationSteps(fromVersion, toVersion),
      examples: await this.generateMigrationExamples(fromVersion, toVersion)
    };
  }
  
  async validateMigration(
    workflow: WorkflowFile,
    targetVersion: string
  ): Promise<ValidationResult> {
    const issues: MigrationIssue[] = [];
    const actionUsages = this.extractActionUsages(workflow);
    
    for (const usage of actionUsages) {
      const validation = await this.validateActionUsage(usage, targetVersion);
      if (!validation.valid) {
        issues.push(...validation.issues);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      suggestions: await this.generateSuggestions(issues)
    };
  }
}
```

### Rollback Strategy

#### Automated Rollback Triggers
```typescript
interface RollbackTrigger {
  name: string;
  condition: (metrics: ReleaseMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoRollback: boolean;
}

const rollbackTriggers: RollbackTrigger[] = [
  {
    name: 'high-failure-rate',
    condition: (metrics) => metrics.failureRate > 0.1,
    severity: 'high',
    autoRollback: true
  },
  {
    name: 'performance-degradation',
    condition: (metrics) => metrics.avgExecutionTime > metrics.baseline * 2,
    severity: 'medium',
    autoRollback: false
  },
  {
    name: 'critical-security-issue',
    condition: (metrics) => metrics.securityIssues.some(i => i.severity === 'critical'),
    severity: 'critical',
    autoRollback: true
  }
];
```

#### Rollback Execution
```yaml
# .github/workflows/rollback.yml
name: Automated Rollback

on:
  repository_dispatch:
    types: [rollback-triggered]

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Validate Rollback Request
        uses: ./actions/javascript/rollback-validator
        with:
          version: ${{ github.event.client_payload.version }}
          reason: ${{ github.event.client_payload.reason }}
          
      - name: Execute Rollback
        uses: ./actions/javascript/rollback-executor
        with:
          target-version: ${{ github.event.client_payload.target_version }}
          notify-users: true
          update-documentation: true
          
      - name: Coordinate Claude-Flow Rollback
        uses: ./actions/javascript/claude-flow-coordinator
        with:
          action: rollback
          version: ${{ github.event.client_payload.version }}
```

### Claude-Flow Version Coordination

#### Agent Version Compatibility
```typescript
interface AgentVersionRequirements {
  minimumClaudeFlowVersion: string;
  supportedAgentTypes: AgentType[];
  requiredCapabilities: string[];
  memorySchemaVersion: string;
}

class ClaudeFlowVersionCoordinator {
  async validateAgentCompatibility(
    actionVersion: string,
    claudeFlowVersion: string
  ): Promise<CompatibilityResult> {
    const requirements = this.getVersionRequirements(actionVersion);
    
    const compatible = semver.gte(claudeFlowVersion, requirements.minimumClaudeFlowVersion);
    
    if (!compatible) {
      return {
        compatible: false,
        issues: [`Requires Claude-Flow >= ${requirements.minimumClaudeFlowVersion}`],
        recommendation: `Update Claude-Flow to ${requirements.minimumClaudeFlowVersion}+`
      };
    }
    
    return {
      compatible: true,
      supportedFeatures: await this.detectSupportedFeatures(claudeFlowVersion),
      optimizations: await this.suggestOptimizations(actionVersion, claudeFlowVersion)
    };
  }
}
```

## Alternatives Considered

### Alternative 1: Calendar Versioning (CalVer)
**Example**: 2024.08.1
**Rejected**: Less semantic meaning, doesn't communicate compatibility, harder for automation.

### Alternative 2: Git SHA-based Versioning
**Example**: abc123f
**Rejected**: No semantic meaning, difficult for users to understand stability and compatibility.

### Alternative 3: Feature-based Versioning
**Example**: v1-code-quality, v2-security-enhanced
**Rejected**: Doesn't follow industry standards, difficult to automate, unclear compatibility.

## Consequences

### Positive
- Clear compatibility communication through semantic versioning
- Automated release processes reduce manual errors
- Rollback capabilities provide safety net
- Migration tools ease version transitions
- Claude-Flow integration maintains coordination

### Negative
- Initial setup complexity for automation
- Requires discipline in commit message formatting
- Potential for version sprawl with multiple supported versions
- Additional maintenance overhead for multiple release branches

### Mitigation Strategies
- Comprehensive documentation and training
- Automated validation of commit messages
- Clear deprecation policies and timelines
- Regular cleanup of unsupported versions

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
- Implement semantic versioning scheme
- Set up automated version determination
- Create release workflows

### Phase 2: Automation (Week 3-4)
- Build release automation
- Implement rollback mechanisms
- Create migration tools

### Phase 3: Integration (Week 5-6)
- Integrate with Claude-Flow coordination
- Implement monitoring and metrics
- Create documentation and guides

## Related Decisions
- ADR-001: Directory Structure
- ADR-002: Action Types Strategy
- ADR-004: Testing and Quality Assurance
- ADR-005: Configuration Management