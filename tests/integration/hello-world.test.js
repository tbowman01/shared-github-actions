const path = require('path');

describe('Hello World Action Integration Tests', () => {
  const actionPath = path.join(__dirname, '../../src/actions/composite/hello-world');
  
  beforeEach(() => {
    // Set required GitHub environment variables
    process.env.GITHUB_WORKSPACE = path.join(__dirname, '../fixtures');
    process.env.GITHUB_OUTPUT = '/tmp/github_output';
    process.env.INPUT_NAME = 'Test User';
    process.env.INPUT_GREETING = 'Hello';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.INPUT_NAME;
    delete process.env.INPUT_GREETING;
  });

  test('should execute hello world action successfully', async () => {
    // This test would run the actual action in a simulated environment
    // For now, we'll test the action.yml structure
    
    const fs = require('fs');
    const yaml = require('yaml');
    
    const actionYml = fs.readFileSync(
      path.join(actionPath, 'action.yml'), 
      'utf8'
    );
    const action = yaml.parse(actionYml);
    
    expect(action.name).toBe('Hello World');
    expect(action.description).toContain('Hello World action');
    expect(action.runs.using).toBe('composite');
    
    // Validate inputs
    expect(action.inputs.name).toBeDefined();
    expect(action.inputs.name.required).toBe(true);
    expect(action.inputs.greeting).toBeDefined();
    expect(action.inputs.greeting.required).toBe(false);
    
    // Validate outputs
    expect(action.outputs.message).toBeDefined();
    expect(action.outputs.timestamp).toBeDefined();
  });

  test('should have valid action metadata', () => {
    const fs = require('fs');
    const yaml = require('yaml');
    
    const actionYml = fs.readFileSync(
      path.join(actionPath, 'action.yml'), 
      'utf8'
    );
    const action = yaml.parse(actionYml);
    
    // Test required fields
    expect(action.name).toBeTruthy();
    expect(action.description).toBeTruthy();
    expect(action.runs).toBeDefined();
    expect(action.runs.using).toBe('composite');
    expect(action.runs.steps).toBeInstanceOf(Array);
    expect(action.runs.steps.length).toBeGreaterThan(0);
    
    // Test branding
    expect(action.branding).toBeDefined();
    expect(action.branding.icon).toBeTruthy();
    expect(action.branding.color).toBeTruthy();
  });

  test('should have proper README documentation', () => {
    const fs = require('fs');
    const readmePath = path.join(actionPath, 'README.md');
    
    expect(fs.existsSync(readmePath)).toBe(true);
    
    const readme = fs.readFileSync(readmePath, 'utf8');
    
    // Check for required sections
    expect(readme).toContain('# Hello World Action');
    expect(readme).toContain('## Usage');
    expect(readme).toContain('## Inputs');
    expect(readme).toContain('## Outputs');
    expect(readme).toContain('## Example');
  });

  test('action should validate against GitHub Actions schema', () => {
    const fs = require('fs');
    const yaml = require('yaml');
    
    const actionYml = fs.readFileSync(
      path.join(actionPath, 'action.yml'), 
      'utf8'
    );
    
    // Should parse without errors
    expect(() => {
      yaml.parse(actionYml);
    }).not.toThrow();
    
    const action = yaml.parse(actionYml);
    
    // Validate composite action requirements
    expect(action.runs.using).toBe('composite');
    expect(action.runs.steps).toBeInstanceOf(Array);
    
    // Each step should have required fields
    action.runs.steps.forEach((step, _index) => {
      expect(step.shell || step.uses).toBeDefined();
      
      if (step.shell) {
        expect(step.shell).toBe('bash');
        expect(step.run).toBeTruthy();
      }
    });
  });
});