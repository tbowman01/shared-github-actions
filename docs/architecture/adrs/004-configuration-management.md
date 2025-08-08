# ADR-004: Configuration Management Strategy

## Status
**PROPOSED** - 2024-08-08

## Context

The Shared GitHub Actions repository requires sophisticated configuration management to handle:

1. **Environment-specific settings** (development, staging, production)
2. **Action-specific configurations** (linting rules, security policies, test parameters)
3. **Claude-Flow agent configurations** (swarm topology, agent capabilities, memory settings)
4. **Runtime configurations** (timeouts, resource limits, retry policies)
5. **User-customizable settings** (input parameters, feature flags, integration options)
6. **Secrets and sensitive data** (API keys, tokens, certificates)

The configuration system must support validation, versioning, inheritance, and secure handling of sensitive data.

## Decision

We will implement a **hierarchical configuration management system** with environment-specific overrides, schema validation, and integrated secrets management.

### Configuration Hierarchy

```
Default Configurations (Built-in)
├── Environment Overrides (Development/Staging/Production)
│   ├── Repository-level Configurations (.github/config/)
│   │   ├── Action-level Configurations (action-specific)
│   │   │   └── User Input Overrides (runtime parameters)
│   │   └── Workflow-level Configurations
│   └── Claude-Flow Configurations
└── Secrets and Sensitive Data (Environment Variables/GitHub Secrets)
```

### Configuration Structure

#### 1. Default Configurations (Built-in)
```typescript
// config/defaults/base-config.json
{
  "version": "1.0.0",
  "claudeFlow": {
    "enabled": true,
    "swarmTopology": "adaptive",
    "maxAgents": 5,
    "memoryPersistence": true,
    "sessionTimeout": 1800,
    "retryPolicy": {
      "maxRetries": 3,
      "backoffStrategy": "exponential",
      "baseDelay": 1000
    }
  },
  "actions": {
    "timeout": 600,
    "logLevel": "info",
    "caching": {
      "enabled": true,
      "ttl": 3600,
      "strategy": "aggressive"
    },
    "performance": {
      "maxExecutionTime": 900,
      "memoryLimit": "2GB",
      "cpuLimit": "2"
    }
  },
  "security": {
    "secretScanning": true,
    "vulnerabilityThreshold": "medium",
    "complianceChecks": ["SOC2", "GDPR"],
    "auditLogging": true
  },
  "notifications": {
    "enabled": true,
    "channels": ["github"],
    "severity": ["error", "warning"]
  }
}
```

#### 2. Environment-Specific Configurations
```typescript
// config/environments/production.json
{
  "claudeFlow": {
    "swarmTopology": "hierarchical",
    "maxAgents": 10,
    "sessionTimeout": 3600,
    "memoryPersistence": true,
    "enableTelemetry": true
  },
  "actions": {
    "logLevel": "warn",
    "timeout": 1200,
    "performance": {
      "maxExecutionTime": 1800,
      "memoryLimit": "4GB",
      "cpuLimit": "4"
    }
  },
  "security": {
    "vulnerabilityThreshold": "low",
    "strictMode": true,
    "auditLogging": true,
    "complianceChecks": ["SOC2", "GDPR", "NIST", "CMMC-L3"]
  },
  "notifications": {
    "channels": ["github", "slack", "email"],
    "severity": ["error", "warning", "info"]
  }
}

// config/environments/development.json
{
  "claudeFlow": {
    "swarmTopology": "mesh",
    "maxAgents": 3,
    "sessionTimeout": 900,
    "debugMode": true,
    "verboseLogging": true
  },
  "actions": {
    "logLevel": "debug",
    "timeout": 300,
    "caching": {
      "enabled": false
    }
  },
  "security": {
    "vulnerabilityThreshold": "high",
    "strictMode": false,
    "skipNonCritical": true
  }
}
```

#### 3. Action-Specific Configurations
```typescript
// config/actions/code-quality-suite.json
{
  "extends": "../defaults/base-config.json",
  "action": {
    "name": "code-quality-suite",
    "version": "2.1.0",
    "description": "Comprehensive code quality analysis"
  },
  "tools": {
    "eslint": {
      "enabled": true,
      "configFile": "configs/linting-rules/eslint.json",
      "extensions": [".js", ".ts", ".jsx", ".tsx"],
      "failOnWarnings": false
    },
    "prettier": {
      "enabled": true,
      "configFile": "configs/linting-rules/.prettierrc.json",
      "checkFormatting": true
    },
    "sonarqube": {
      "enabled": true,
      "qualityGate": "strict",
      "excludePaths": ["node_modules/**", "dist/**"]
    }
  },
  "claudeFlow": {
    "requiredAgents": ["code-analyzer", "reviewer"],
    "optionalAgents": ["performance-benchmarker"],
    "agentConfigs": {
      "code-analyzer": {
        "capabilities": ["syntax-analysis", "complexity-measurement", "pattern-detection"],
        "memoryNamespace": "code-quality",
        "learningEnabled": true
      }
    }
  },
  "outputs": {
    "reports": ["html", "json"],
    "artifacts": ["coverage-report", "quality-metrics"],
    "annotations": true
  }
}

// config/actions/security-scanner.json
{
  "extends": "../defaults/base-config.json",
  "action": {
    "name": "security-scanner",
    "version": "1.5.0",
    "description": "Multi-layered security analysis"
  },
  "tools": {
    "snyk": {
      "enabled": true,
      "severity": "medium",
      "failOnVulnerabilities": true,
      "ignoreDevDependencies": false
    },
    "codeql": {
      "enabled": true,
      "languages": ["javascript", "typescript", "python", "go"],
      "queries": ["security-extended", "security-and-quality"]
    },
    "gitleaks": {
      "enabled": true,
      "configFile": "configs/security-policies/gitleaks.toml"
    }
  },
  "claudeFlow": {
    "requiredAgents": ["security-scanner", "vulnerability-analyzer"],
    "agentConfigs": {
      "security-scanner": {
        "capabilities": ["vulnerability-detection", "secret-scanning", "compliance-checking"],
        "memoryNamespace": "security",
        "threatIntelligence": true
      }
    }
  },
  "compliance": {
    "frameworks": ["SOC2", "NIST-RMF", "CMMC-L3"],
    "reporting": true,
    "auditTrail": true
  }
}
```

### Configuration Loading Strategy

#### Configuration Manager
```typescript
interface ConfigurationSource {
  name: string;
  priority: number;
  loader: ConfigLoader;
}

class ConfigurationManager {
  private sources: ConfigurationSource[] = [
    { name: 'defaults', priority: 1, loader: new FileConfigLoader('config/defaults') },
    { name: 'environment', priority: 2, loader: new EnvironmentConfigLoader() },
    { name: 'repository', priority: 3, loader: new RepositoryConfigLoader('.github/config') },
    { name: 'action-specific', priority: 4, loader: new ActionConfigLoader('config/actions') },
    { name: 'user-input', priority: 5, loader: new InputConfigLoader() },
    { name: 'secrets', priority: 6, loader: new SecretsConfigLoader() }
  ];

  async loadConfiguration(
    actionName: string,
    environment: Environment,
    userInputs: Record<string, any>
  ): Promise<ActionConfiguration> {
    const configs: Partial<ActionConfiguration>[] = [];
    
    // Load configurations in priority order
    for (const source of this.sources.sort((a, b) => a.priority - b.priority)) {
      try {
        const config = await source.loader.load(actionName, environment, userInputs);
        if (config) {
          configs.push(config);
        }
      } catch (error) {
        this.logger.warn(`Failed to load config from ${source.name}: ${error.message}`);
      }
    }
    
    // Merge configurations with higher priority overriding lower priority
    const mergedConfig = this.mergeConfigurations(configs);
    
    // Validate final configuration
    await this.validateConfiguration(mergedConfig);
    
    return mergedConfig;
  }
  
  private mergeConfigurations(configs: Partial<ActionConfiguration>[]): ActionConfiguration {
    return configs.reduce((merged, config) => {
      return deepMerge(merged, config, {
        arrayMerge: (target, source) => source, // Replace arrays instead of concatenating
        customMerge: (key) => {
          if (key === 'secrets') {
            return (target, source) => ({ ...target, ...source });
          }
          return undefined;
        }
      });
    }, {} as ActionConfiguration);
  }
}
```

#### Configuration Validation
```typescript
interface ConfigurationSchema {
  version: string;
  schema: JSONSchema;
  migrations?: ConfigurationMigration[];
}

class ConfigurationValidator {
  private schemas: Map<string, ConfigurationSchema> = new Map();
  
  constructor() {
    this.loadSchemas();
  }
  
  async validateConfiguration(
    config: ActionConfiguration,
    actionType: string
  ): Promise<ValidationResult> {
    const schema = this.schemas.get(actionType);
    if (!schema) {
      throw new Error(`No schema found for action type: ${actionType}`);
    }
    
    // Check if migration is needed
    if (config.version !== schema.version) {
      config = await this.migrateConfiguration(config, schema);
    }
    
    // Validate against schema
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema.schema);
    const valid = validate(config);
    
    if (!valid) {
      return {
        valid: false,
        errors: validate.errors || [],
        suggestions: this.generateSuggestions(validate.errors || [])
      };
    }
    
    // Perform semantic validation
    const semanticValidation = await this.performSemanticValidation(config);
    
    return {
      valid: semanticValidation.valid,
      errors: semanticValidation.errors,
      warnings: semanticValidation.warnings
    };
  }
  
  private async performSemanticValidation(
    config: ActionConfiguration
  ): Promise<SemanticValidationResult> {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationWarning[] = [];
    
    // Validate Claude-Flow agent configurations
    if (config.claudeFlow?.enabled) {
      const agentValidation = await this.validateAgentConfigurations(config.claudeFlow);
      errors.push(...agentValidation.errors);
      warnings.push(...agentValidation.warnings);
    }
    
    // Validate resource limits
    const resourceValidation = this.validateResourceLimits(config.actions?.performance);
    errors.push(...resourceValidation.errors);
    warnings.push(...resourceValidation.warnings);
    
    // Validate security settings
    const securityValidation = this.validateSecuritySettings(config.security);
    errors.push(...securityValidation.errors);
    warnings.push(...securityValidation.warnings);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
```

### Secrets Management

#### Secrets Configuration
```typescript
interface SecretsConfiguration {
  vault: 'github' | 'aws-secrets-manager' | 'azure-key-vault' | 'hashicorp-vault';
  encryption: {
    enabled: boolean;
    algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
    keyRotation: boolean;
    rotationInterval: number; // days
  };
  access: {
    principleOfLeastPrivilege: boolean;
    auditAccess: boolean;
    temporaryAccess: boolean;
    accessTTL: number; // seconds
  };
}

class SecretsManager {
  async retrieveSecret(
    secretName: string,
    context: ActionContext
  ): Promise<string | undefined> {
    // Audit secret access
    await this.auditSecretAccess(secretName, context);
    
    // Check access permissions
    if (!await this.hasSecretAccess(secretName, context)) {
      throw new Error(`Access denied to secret: ${secretName}`);
    }
    
    // Retrieve from vault
    const secret = await this.vault.getSecret(secretName);
    
    // Decrypt if necessary
    if (secret.encrypted) {
      return await this.decryptSecret(secret.value, context);
    }
    
    return secret.value;
  }
  
  async storeSecret(
    secretName: string,
    value: string,
    context: ActionContext,
    options: SecretStorageOptions = {}
  ): Promise<void> {
    // Validate secret format
    this.validateSecretFormat(secretName, value);
    
    // Encrypt sensitive data
    const encryptedValue = await this.encryptSecret(value, context);
    
    // Store in vault with metadata
    await this.vault.storeSecret(secretName, {
      value: encryptedValue,
      encrypted: true,
      createdBy: context.actor,
      createdAt: new Date(),
      ttl: options.ttl,
      tags: options.tags || []
    });
    
    // Audit secret creation
    await this.auditSecretCreation(secretName, context);
  }
}
```

### Runtime Configuration Override

#### Action Input Configuration
```typescript
interface ActionInputOverrides {
  // Claude-Flow overrides
  'claude-flow-enabled'?: boolean;
  'swarm-topology'?: 'hierarchical' | 'mesh' | 'star' | 'adaptive';
  'max-agents'?: number;
  'agent-types'?: string[];
  'memory-namespace'?: string;
  
  // Performance overrides
  'timeout'?: number;
  'memory-limit'?: string;
  'cpu-limit'?: string;
  'retry-count'?: number;
  
  // Feature flags
  'enable-caching'?: boolean;
  'enable-telemetry'?: boolean;
  'debug-mode'?: boolean;
  'dry-run'?: boolean;
  
  // Tool-specific overrides
  'linting-config'?: string;
  'security-threshold'?: 'low' | 'medium' | 'high' | 'critical';
  'compliance-frameworks'?: string[];
}

class RuntimeConfigurationManager {
  async applyInputOverrides(
    baseConfig: ActionConfiguration,
    inputs: ActionInputOverrides
  ): Promise<ActionConfiguration> {
    const config = deepClone(baseConfig);
    
    // Apply Claude-Flow overrides
    if (inputs['claude-flow-enabled'] !== undefined) {
      config.claudeFlow.enabled = inputs['claude-flow-enabled'];
    }
    
    if (inputs['swarm-topology']) {
      config.claudeFlow.swarmTopology = inputs['swarm-topology'];
    }
    
    if (inputs['max-agents']) {
      config.claudeFlow.maxAgents = inputs['max-agents'];
    }
    
    // Apply performance overrides
    if (inputs['timeout']) {
      config.actions.timeout = inputs['timeout'];
    }
    
    if (inputs['memory-limit']) {
      config.actions.performance.memoryLimit = inputs['memory-limit'];
    }
    
    // Apply feature flag overrides
    if (inputs['enable-caching'] !== undefined) {
      config.actions.caching.enabled = inputs['enable-caching'];
    }
    
    if (inputs['debug-mode'] !== undefined) {
      config.actions.logLevel = inputs['debug-mode'] ? 'debug' : config.actions.logLevel;
      config.claudeFlow.verboseLogging = inputs['debug-mode'];
    }
    
    // Validate final configuration
    await this.validateRuntimeConfiguration(config);
    
    return config;
  }
}
```

## Alternatives Considered

### Alternative 1: Environment Variables Only
**Rejected**: Limited hierarchy support, difficult to manage complex configurations, no validation capabilities.

### Alternative 2: Single Configuration File
**Rejected**: Doesn't support environment-specific overrides, difficult to maintain for multiple actions.

### Alternative 3: Database-Driven Configuration
**Rejected**: Adds infrastructure complexity, not suitable for GitHub Actions environment, potential latency issues.

## Consequences

### Positive
- Hierarchical configuration with clear precedence rules
- Environment-specific customization without duplication
- Schema-based validation prevents configuration errors
- Secure secrets management with audit trails
- Runtime configuration flexibility through inputs
- Version-controlled configuration changes

### Negative
- Initial complexity in setup and understanding
- Multiple configuration sources to manage
- Potential for configuration drift between environments
- Additional overhead in configuration loading and validation

### Mitigation Strategies
- Comprehensive documentation with examples
- Configuration validation tools and IDE support
- Automated configuration testing in CI/CD
- Regular configuration audits and cleanup
- Clear error messages for configuration issues

## Implementation Plan

### Phase 1: Core Framework (Week 1-2)
- Implement configuration manager and loaders
- Create base configuration schemas
- Build validation framework

### Phase 2: Environment Support (Week 2-3)
- Add environment-specific configuration support
- Implement configuration inheritance and merging
- Create migration framework

### Phase 3: Secrets Integration (Week 3-4)
- Integrate secrets management
- Add security validation
- Implement audit logging

### Phase 4: Runtime Overrides (Week 4-5)
- Add input-based configuration overrides
- Create runtime validation
- Build debugging and troubleshooting tools

## Related Decisions
- ADR-001: Directory Structure
- ADR-002: Action Types Strategy
- ADR-003: Version Management
- ADR-005: Testing and Quality Assurance