#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

/**
 * Validate GitHub Actions schema and structure
 */
class ActionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate a single action directory
   */
  validateAction(actionPath) {
    console.log(`🔍 Validating action: ${actionPath}`);
    
    const actionYmlPath = path.join(actionPath, 'action.yml');
    const readmePath = path.join(actionPath, 'README.md');
    
    // Check if action.yml exists
    if (!fs.existsSync(actionYmlPath)) {
      this.errors.push(`Missing action.yml in ${actionPath}`);
      return false;
    }
    
    // Parse and validate action.yml
    try {
      const actionContent = fs.readFileSync(actionYmlPath, 'utf8');
      const action = yaml.parse(actionContent);
      
      this.validateActionSchema(action, actionPath);
      this.validateCompositeAction(action, actionPath);
      
    } catch (error) {
      this.errors.push(`Invalid YAML in ${actionYmlPath}: ${error.message}`);
      return false;
    }
    
    // Check for README
    if (!fs.existsSync(readmePath)) {
      this.warnings.push(`Missing README.md in ${actionPath}`);
    } else {
      this.validateReadme(readmePath, actionPath);
    }
    
    return this.errors.length === 0;
  }

  /**
   * Validate basic action schema
   */
  validateActionSchema(action, actionPath) {
    const required = ['name', 'description', 'runs'];
    
    required.forEach(field => {
      if (!action[field]) {
        this.errors.push(`Missing required field '${field}' in ${actionPath}/action.yml`);
      }
    });
    
    // Validate runs configuration
    if (action.runs) {
      if (!action.runs.using) {
        this.errors.push(`Missing 'runs.using' in ${actionPath}/action.yml`);
      }
      
      const validUsing = ['composite', 'node20', 'node16', 'docker'];
      if (action.runs.using && !validUsing.includes(action.runs.using)) {
        this.errors.push(`Invalid 'runs.using' value in ${actionPath}/action.yml. Must be one of: ${validUsing.join(', ')}`);
      }
    }
    
    // Validate inputs
    if (action.inputs) {
      Object.entries(action.inputs).forEach(([name, input]) => {
        if (!input.description) {
          this.warnings.push(`Input '${name}' missing description in ${actionPath}/action.yml`);
        }
      });
    }
    
    // Validate outputs
    if (action.outputs) {
      Object.entries(action.outputs).forEach(([name, output]) => {
        if (!output.description) {
          this.warnings.push(`Output '${name}' missing description in ${actionPath}/action.yml`);
        }
      });
    }
  }

  /**
   * Validate composite action specific requirements
   */
  validateCompositeAction(action, actionPath) {
    if (action.runs.using === 'composite') {
      if (!action.runs.steps || !Array.isArray(action.runs.steps)) {
        this.errors.push(`Composite action must have 'runs.steps' array in ${actionPath}/action.yml`);
        return;
      }
      
      action.runs.steps.forEach((step, index) => {
        if (!step.shell && !step.uses) {
          this.errors.push(`Step ${index + 1} must have either 'shell' or 'uses' in ${actionPath}/action.yml`);
        }
        
        if (step.shell && !step.run) {
          this.errors.push(`Step ${index + 1} with 'shell' must have 'run' in ${actionPath}/action.yml`);
        }
      });
    }
  }

  /**
   * Validate README documentation
   */
  validateReadme(readmePath, actionPath) {
    const content = fs.readFileSync(readmePath, 'utf8');
    const requiredSections = ['# ', '## Usage', '## Inputs', '## Outputs'];
    
    requiredSections.forEach(section => {
      if (!content.includes(section)) {
        this.warnings.push(`README missing '${section}' section in ${actionPath}`);
      }
    });
    
    // Check for usage example
    if (!content.includes('```yaml')) {
      this.warnings.push(`README missing YAML usage example in ${actionPath}`);
    }
  }

  /**
   * Find and validate all actions in the repository
   */
  async validateAllActions() {
    const actionsDir = path.join(__dirname, '../src/actions');
    
    if (!fs.existsSync(actionsDir)) {
      console.log('📂 No actions directory found');
      return true;
    }
    
    const actionTypes = ['composite', 'javascript', 'docker'];
    let totalActions = 0;
    let validActions = 0;
    
    for (const actionType of actionTypes) {
      const typeDir = path.join(actionsDir, actionType);
      
      if (!fs.existsSync(typeDir)) {
        console.log(`📂 No ${actionType} actions directory found`);
        continue;
      }
      
      const actions = fs.readdirSync(typeDir).filter(item => {
        return fs.statSync(path.join(typeDir, item)).isDirectory();
      });
      
      for (const actionName of actions) {
        const actionPath = path.join(typeDir, actionName);
        totalActions++;
        
        if (this.validateAction(actionPath)) {
          validActions++;
          console.log(`✅ ${actionType}/${actionName} - Valid`);
        } else {
          console.log(`❌ ${actionType}/${actionName} - Invalid`);
        }
      }
    }
    
    // Print summary
    console.log('\n📊 Validation Summary');
    console.log('='.repeat(50));
    console.log(`Total actions: ${totalActions}`);
    console.log(`Valid actions: ${validActions}`);
    console.log(`Invalid actions: ${totalActions - validActions}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (this.errors.length === 0) {
      console.log('\n🎉 All actions are valid!');
    }
    
    return this.errors.length === 0;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ActionValidator();
  
  validator.validateAllActions().then(isValid => {
    process.exit(isValid ? 0 : 1);
  }).catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ActionValidator;