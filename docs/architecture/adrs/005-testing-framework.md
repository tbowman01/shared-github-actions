# ADR-005: Testing Framework Architecture

## Status
**PROPOSED** - 2024-08-08

## Context

The Shared GitHub Actions repository requires a comprehensive testing strategy to ensure reliability, performance, and compatibility across different environments. Our testing framework must address:

1. **Unit Testing**: Individual action components and utilities
2. **Integration Testing**: Action interactions with GitHub APIs and Claude-Flow
3. **End-to-End Testing**: Complete workflow execution scenarios
4. **Performance Testing**: Action execution time and resource usage
5. **Compatibility Testing**: Multiple runner OS and Node.js versions
6. **Security Testing**: Vulnerability detection and secret handling
7. **Claude-Flow Testing**: Agent coordination and memory persistence

The framework must support test-driven development (TDD), continuous integration, and provide clear feedback for both developers and users.

## Decision

We will implement a **multi-layered testing architecture** using modern JavaScript testing tools with specialized testing utilities for GitHub Actions and Claude-Flow integration.

### Testing Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    End-to-End Tests                         │
│  • Complete workflow execution                              │
│  • Multi-action orchestration                              │
│  • Real GitHub API integration                             │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                  Integration Tests                          │
│  • Action-to-action interactions                           │
│  • GitHub API mocking                                      │
│  • Claude-Flow coordination                                │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Unit Tests                               │
│  • Individual functions                                     │
│  • Component isolation                                      │
│  • Utility libraries                                       │
└─────────────────────────────────────────────────────────────┘
```

### Testing Technology Stack

#### Core Testing Framework
- **Jest**: Primary testing framework with extensive ecosystem
- **TypeScript**: Full TypeScript support for test files
- **GitHub Actions Toolkit**: Native testing utilities
- **Testcontainers**: Docker-based integration testing
- **Playwright**: End-to-end browser-based testing when needed

#### Specialized Tools
- **act**: Local GitHub Actions testing
- **Mock Service Worker (MSW)**: API mocking for external services
- **nock**: HTTP request mocking for Node.js
- **claude-flow-test-utils**: Custom testing utilities for Claude-Flow

### Unit Testing Strategy

#### Test Structure and Organization
```typescript
// __tests__/unit/actions/code-quality/analyzer.test.ts
import { CodeAnalyzer } from '../../../../src/lib/code-quality/analyzer';
import { createMockGitHubContext } from '../../../utils/github-mock';
import { createMockClaudeFlowCoordinator } from '../../../utils/claude-flow-mock';

describe('CodeAnalyzer', () => {
  let analyzer: CodeAnalyzer;
  let mockGitHub: jest.MockedObject<GitHubContext>;
  let mockClaudeFlow: jest.MockedObject<ClaudeFlowCoordinator>;

  beforeEach(() => {
    mockGitHub = createMockGitHubContext();
    mockClaudeFlow = createMockClaudeFlowCoordinator();
    analyzer = new CodeAnalyzer(mockGitHub, mockClaudeFlow);
  });

  describe('analyzeRepository', () => {
    it('should identify code quality issues', async () => {
      // Arrange
      const repoPath = '/test/fixtures/sample-repo';
      const expectedIssues = [
        { type: 'complexity', severity: 'warning', file: 'src/complex.js' },
        { type: 'duplication', severity: 'info', file: 'src/duplicate.js' }
      ];

      mockGitHub.rest.repos.getContent.mockResolvedValue({
        data: createMockRepoContent(repoPath)
      });

      // Act
      const result = await analyzer.analyzeRepository('owner/repo');

      // Assert
      expect(result.issues).toHaveLength(2);
      expect(result.issues).toEqual(expect.arrayContaining(expectedIssues));
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty repositories gracefully', async () => {
      // Arrange
      mockGitHub.rest.repos.getContent.mockResolvedValue({ data: [] });

      // Act
      const result = await analyzer.analyzeRepository('owner/empty-repo');

      // Assert
      expect(result.issues).toHaveLength(0);
      expect(result.overallScore).toBe(100);
    });

    it('should integrate with Claude-Flow agents', async () => {
      // Arrange
      const mockAgent = createMockAgent('code-analyzer');
      mockClaudeFlow.spawnAgent.mockResolvedValue(mockAgent);
      mockAgent.execute.mockResolvedValue({
        analysis: { complexity: 'low', maintainability: 'high' }
      });

      // Act
      const result = await analyzer.analyzeRepository('owner/repo');

      // Assert
      expect(mockClaudeFlow.spawnAgent).toHaveBeenCalledWith('code-analyzer');
      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repository: 'owner/repo' })
      );
      expect(result.agentInsights).toBeDefined();
    });
  });
});
```

#### Test Utilities and Helpers
```typescript
// tests/utils/github-mock.ts
export function createMockGitHubContext(): jest.MockedObject<GitHubContext> {
  return {
    rest: {
      repos: {
        getContent: jest.fn(),
        createCommitStatus: jest.fn(),
        listPullRequestFiles: jest.fn()
      },
      pulls: {
        createReview: jest.fn(),
        listFiles: jest.fn(),
        createReviewComment: jest.fn()
      },
      checks: {
        create: jest.fn(),
        update: jest.fn()
      }
    },
    graphql: jest.fn(),
    log: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }
  } as any;
}

// tests/utils/claude-flow-mock.ts
export function createMockClaudeFlowCoordinator(): jest.MockedObject<ClaudeFlowCoordinator> {
  return {
    initializeSwarm: jest.fn().mockResolvedValue('swarm-123'),
    spawnAgent: jest.fn(),
    coordinateAgents: jest.fn(),
    getSwarmStatus: jest.fn(),
    terminateSwarm: jest.fn(),
    storeMemory: jest.fn(),
    retrieveMemory: jest.fn()
  } as any;
}

export function createMockAgent(type: string): jest.MockedObject<Agent> {
  return {
    id: `agent-${type}-123`,
    type,
    execute: jest.fn(),
    getStatus: jest.fn().mockReturnValue('active'),
    getMetrics: jest.fn(),
    terminate: jest.fn()
  } as any;
}

// tests/utils/assertion-helpers.ts
export const customMatchers = {
  toHaveValidActionOutputs(received: ActionResult) {
    const requiredFields = ['success', 'status', 'results'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length > 0) {
      return {
        pass: false,
        message: () => `Expected action result to have required fields: ${missingFields.join(', ')}`
      };
    }
    
    return {
      pass: true,
      message: () => 'Action result has all required fields'
    };
  },

  toHaveExecutedWithinTimeout(received: number, timeout: number) {
    const pass = received <= timeout;
    return {
      pass,
      message: () => pass
        ? `Expected ${received}ms to be greater than ${timeout}ms`
        : `Expected ${received}ms to be within ${timeout}ms timeout`
    };
  }
};
```

### Integration Testing Strategy

#### Cross-Component Integration
```typescript
// tests/integration/action-integration.test.ts
describe('Action Integration Tests', () => {
  let testEnvironment: TestEnvironment;

  beforeAll(async () => {
    testEnvironment = await TestEnvironment.setup({
      githubToken: process.env.GITHUB_TEST_TOKEN,
      claudeFlowConfig: {
        enabled: true,
        swarmTopology: 'mesh'
      }
    });
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  describe('Code Quality Suite Integration', () => {
    it('should execute complete code quality analysis', async () => {
      // Arrange
      const testRepo = await testEnvironment.createTestRepository({
        name: 'integration-test-repo',
        files: {
          'src/main.js': SAMPLE_JS_CODE,
          'package.json': SAMPLE_PACKAGE_JSON,
          '.eslintrc.js': ESLINT_CONFIG
        }
      });

      // Act
      const result = await testEnvironment.runAction('code-quality-suite', {
        repository: testRepo.fullName,
        'claude-flow-enabled': true,
        'agent-types': ['code-analyzer', 'reviewer']
      });

      // Assert
      expect(result).toHaveValidActionOutputs();
      expect(result.success).toBe(true);
      expect(result.results.linting).toBeDefined();
      expect(result.results.complexity).toBeDefined();
      expect(result.agentMetrics).toBeDefined();
      expect(result.agentMetrics.agents).toHaveLength(2);

      // Verify GitHub integration
      const checkRuns = await testEnvironment.getCheckRuns(testRepo.fullName);
      expect(checkRuns).toContainEqual(
        expect.objectContaining({
          name: 'Code Quality Analysis',
          conclusion: 'success'
        })
      );
    });

    it('should coordinate multiple agents effectively', async () => {
      // Test agent coordination and result aggregation
      const result = await testEnvironment.runAction('security-scanner', {
        repository: 'test/vulnerable-repo',
        'swarm-topology': 'hierarchical',
        'max-agents': 5
      });

      expect(result.agentMetrics.coordination.efficiency).toBeGreaterThan(0.8);
      expect(result.agentMetrics.coordination.conflicts).toBe(0);
    });
  });
});
```

#### API Integration Testing
```typescript
// tests/integration/github-api-integration.test.ts
describe('GitHub API Integration', () => {
  let mockServer: SetupServerApi;

  beforeAll(() => {
    mockServer = setupServer(
      // Mock GitHub API endpoints
      rest.get('https://api.github.com/repos/:owner/:repo/contents/*', (req, res, ctx) => {
        return res(ctx.json(MOCK_REPO_CONTENTS));
      }),
      rest.post('https://api.github.com/repos/:owner/:repo/check-runs', (req, res, ctx) => {
        return res(ctx.json({ id: 123, status: 'queued' }));
      }),
      rest.patch('https://api.github.com/repos/:owner/:repo/check-runs/:id', (req, res, ctx) => {
        return res(ctx.json({ id: 123, status: 'completed', conclusion: 'success' }));
      })
    );
    mockServer.listen();
  });

  afterAll(() => {
    mockServer.close();
  });

  it('should handle GitHub API rate limiting gracefully', async () => {
    // Simulate rate limiting
    mockServer.use(
      rest.get('https://api.github.com/repos/:owner/:repo/contents/*', (req, res, ctx) => {
        return res(
          ctx.status(403),
          ctx.json({
            message: 'API rate limit exceeded',
            documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
          })
        );
      })
    );

    const action = new CodeQualityAction();
    const result = await action.run({
      repository: 'owner/repo',
      token: 'test-token'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('rate limit');
    expect(result.retryAfter).toBeDefined();
  });
});
```

### End-to-End Testing Strategy

#### Complete Workflow Testing
```typescript
// tests/e2e/complete-workflow.test.ts
describe('Complete Workflow E2E Tests', () => {
  let runner: ActionRunner;

  beforeAll(async () => {
    runner = new ActionRunner({
      platform: process.env.RUNNER_OS || 'ubuntu-latest',
      nodeVersion: process.env.NODE_VERSION || '18'
    });
    await runner.setup();
  });

  afterAll(async () => {
    await runner.cleanup();
  });

  it('should execute PR validation workflow end-to-end', async () => {
    // Create a real test repository
    const testRepo = await createTestRepository('e2e-pr-validation');
    
    // Create a PR with changes
    const pr = await testRepo.createPullRequest({
      title: 'Test PR for E2E validation',
      changes: {
        'src/new-feature.js': NEW_FEATURE_CODE,
        'tests/new-feature.test.js': NEW_FEATURE_TESTS
      }
    });

    // Wait for workflow completion
    const workflowRun = await testRepo.waitForWorkflowCompletion(pr.number);

    // Verify workflow results
    expect(workflowRun.conclusion).toBe('success');
    expect(workflowRun.jobs).toHaveLength(4); // lint, test, security, review

    // Verify PR comments and reviews
    const prComments = await testRepo.getPullRequestComments(pr.number);
    expect(prComments).toContainEqual(
      expect.objectContaining({
        body: expect.stringContaining('Code quality analysis completed')
      })
    );

    // Verify check runs
    const checkRuns = await testRepo.getCheckRuns(pr.headSha);
    expect(checkRuns).toHaveLength(4);
    expect(checkRuns.every(run => run.conclusion === 'success')).toBe(true);

    // Cleanup
    await testRepo.delete();
  });

  it('should handle failure scenarios gracefully', async () => {
    const testRepo = await createTestRepository('e2e-failure-handling');
    
    const pr = await testRepo.createPullRequest({
      title: 'PR with intentional failures',
      changes: {
        'src/buggy-code.js': INTENTIONALLY_BUGGY_CODE
      }
    });

    const workflowRun = await testRepo.waitForWorkflowCompletion(pr.number);

    expect(workflowRun.conclusion).toBe('failure');
    
    // Verify failure handling
    const failedJobs = workflowRun.jobs.filter(job => job.conclusion === 'failure');
    expect(failedJobs.length).toBeGreaterThan(0);

    // Verify error reporting
    const prComments = await testRepo.getPullRequestComments(pr.number);
    expect(prComments.some(comment => 
      comment.body.includes('Action failed') && 
      comment.body.includes('troubleshooting guide')
    )).toBe(true);

    await testRepo.delete();
  });
});
```

### Performance Testing Strategy

#### Performance Benchmarking
```typescript
// tests/performance/action-performance.test.ts
describe('Action Performance Tests', () => {
  const performanceThresholds = {
    'code-quality-suite': { maxDuration: 120000, maxMemory: '1GB' },
    'security-scanner': { maxDuration: 180000, maxMemory: '2GB' },
    'test-runner': { maxDuration: 300000, maxMemory: '4GB' }
  };

  Object.entries(performanceThresholds).forEach(([actionName, thresholds]) => {
    describe(`${actionName} Performance`, () => {
      it('should complete within performance thresholds', async () => {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();

        const result = await runActionWithProfiling(actionName, {
          repository: 'performance-test/medium-repo',
          profiling: true
        });

        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

        expect(result).toHaveValidActionOutputs();
        expect(duration).toHaveExecutedWithinTimeout(thresholds.maxDuration);
        expect(memoryUsed).toBeLessThan(parseMemoryString(thresholds.maxMemory));

        // Log performance metrics for monitoring
        console.log(`${actionName} Performance:`, {
          duration: `${duration}ms`,
          memory: `${Math.round(memoryUsed / 1024 / 1024)}MB`,
          agentEfficiency: result.agentMetrics?.efficiency || 'N/A'
        });
      });

      it('should scale linearly with repository size', async () => {
        const testCases = [
          { size: 'small', expectedMaxDuration: thresholds.maxDuration * 0.3 },
          { size: 'medium', expectedMaxDuration: thresholds.maxDuration * 0.6 },
          { size: 'large', expectedMaxDuration: thresholds.maxDuration }
        ];

        for (const testCase of testCases) {
          const startTime = Date.now();
          await runActionWithProfiling(actionName, {
            repository: `performance-test/${testCase.size}-repo`
          });
          const duration = Date.now() - startTime;

          expect(duration).toBeLessThanOrEqual(testCase.expectedMaxDuration);
        }
      });
    });
  });
});
```

### Claude-Flow Testing Strategy

#### Agent Coordination Testing
```typescript
// tests/claude-flow/agent-coordination.test.ts
describe('Claude-Flow Agent Coordination', () => {
  let claudeFlowTestEnv: ClaudeFlowTestEnvironment;

  beforeAll(async () => {
    claudeFlowTestEnv = await ClaudeFlowTestEnvironment.setup({
      mode: 'testing',
      enableMemoryPersistence: true
    });
  });

  afterAll(async () => {
    await claudeFlowTestEnv.cleanup();
  });

  it('should coordinate agents in hierarchical topology', async () => {
    const swarmId = await claudeFlowTestEnv.initializeSwarm('hierarchical');
    
    const agents = await Promise.all([
      claudeFlowTestEnv.spawnAgent('code-analyzer', swarmId),
      claudeFlowTestEnv.spawnAgent('reviewer', swarmId),
      claudeFlowTestEnv.spawnAgent('tester', swarmId)
    ]);

    const coordinationResult = await claudeFlowTestEnv.coordinateTask({
      swarmId,
      task: 'analyze-and-review-code',
      data: { repository: 'test/sample-repo' }
    });

    expect(coordinationResult.success).toBe(true);
    expect(coordinationResult.agentResults).toHaveLength(3);
    expect(coordinationResult.coordination.conflicts).toBe(0);
    expect(coordinationResult.coordination.efficiency).toBeGreaterThan(0.8);
  });

  it('should persist and retrieve memory correctly', async () => {
    const memoryNamespace = 'test-memory';
    const testData = {
      codePatterns: ['singleton', 'factory'],
      qualityMetrics: { complexity: 3.2, coverage: 85 }
    };

    await claudeFlowTestEnv.storeMemory(memoryNamespace, 'test-key', testData);
    const retrievedData = await claudeFlowTestEnv.retrieveMemory(memoryNamespace, 'test-key');

    expect(retrievedData).toEqual(testData);
  });

  it('should handle agent failures gracefully', async () => {
    const swarmId = await claudeFlowTestEnv.initializeSwarm('mesh');
    const agents = await claudeFlowTestEnv.spawnAgents(['code-analyzer', 'reviewer'], swarmId);

    // Simulate agent failure
    await claudeFlowTestEnv.simulateAgentFailure(agents[0].id, 'network-timeout');

    const result = await claudeFlowTestEnv.coordinateTask({
      swarmId,
      task: 'analyze-code',
      data: { repository: 'test/sample-repo' }
    });

    expect(result.success).toBe(true);
    expect(result.recoveryActions).toContainEqual(
      expect.objectContaining({
        type: 'agent-replacement',
        originalAgent: agents[0].id
      })
    );
  });
});
```

### Testing Configuration

#### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/tests/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,js}',
    '!src/fixtures/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],
  testTimeout: 60000,
  maxWorkers: '50%',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  }
};
```

#### GitHub Actions Testing Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      redis:
        image: redis
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run integration tests
        run: npm run test:integration
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CLAUDE_FLOW_CONFIG: ${{ secrets.CLAUDE_FLOW_TEST_CONFIG }}

  e2e-tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - name: Setup test environment
        run: ./scripts/setup-e2e-env.sh
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          RUNNER_OS: ${{ matrix.os }}

  performance-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - name: Setup performance testing
        run: ./scripts/setup-perf-env.sh
      - name: Run performance benchmarks
        run: npm run test:performance
      - name: Report performance metrics
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'benchmarkjs'
          output-file-path: performance-results.json
```

## Alternatives Considered

### Alternative 1: Single Testing Framework (Mocha/Chai)
**Rejected**: Less integrated ecosystem, requires more manual setup for TypeScript and GitHub Actions testing.

### Alternative 2: Go-based Testing (since some actions might be in Go)
**Rejected**: Adds complexity with multiple testing ecosystems, JavaScript ecosystem is more mature for GitHub Actions.

### Alternative 3: Docker-only Testing Environment
**Rejected**: Slower feedback loop, more complex local development setup, not necessary for all test types.

## Consequences

### Positive
- Comprehensive test coverage across all action types
- Fast feedback loop with unit tests
- Realistic integration testing with mocked services
- Full end-to-end validation of workflows
- Performance monitoring and regression detection
- Claude-Flow specific testing capabilities

### Negative
- Complex test setup and maintenance
- Longer CI/CD pipeline execution times
- Multiple testing tools and configurations to manage
- Higher resource requirements for comprehensive testing

### Mitigation Strategies
- Parallel test execution where possible
- Smart test selection based on changed files
- Cached dependencies and test environments
- Clear documentation and examples for test writing
- Automated test maintenance and cleanup

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
- Set up Jest and TypeScript testing environment
- Create basic test utilities and helpers
- Implement unit testing framework

### Phase 2: Integration (Week 2-3)
- Add GitHub API mocking capabilities
- Create Claude-Flow testing utilities
- Implement integration testing framework

### Phase 3: End-to-End (Week 3-4)
- Set up complete workflow testing
- Add performance benchmarking
- Create CI/CD integration

### Phase 4: Advanced Features (Week 4-5)
- Add specialized Claude-Flow testing
- Implement comprehensive reporting
- Create testing documentation and guides

## Related Decisions
- ADR-001: Directory Structure
- ADR-002: Action Types Strategy
- ADR-003: Version Management
- ADR-004: Configuration Management