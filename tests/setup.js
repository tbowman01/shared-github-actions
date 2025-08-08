// Jest setup file for GitHub Actions testing
const nock = require('nock');

// Mock GitHub context for testing
process.env.GITHUB_WORKSPACE = '/github/workspace';
process.env.GITHUB_REPOSITORY = 'tbowman01/shared-github-actions';
process.env.GITHUB_ACTOR = 'github-actions[bot]';
process.env.GITHUB_REF = 'refs/heads/main';
process.env.GITHUB_SHA = 'abc123def456';

// GitHub API base URL for mocking
const GITHUB_API_URL = 'https://api.github.com';

// Global setup
beforeAll(() => {
  // Disable HTTP requests during tests
  if (!nock.isActive()) {
    nock.activate();
  }
});

afterAll(() => {
  // Clean up nock
  nock.restore();
});

beforeEach(() => {
  // Clear any pending HTTP mocks
  nock.cleanAll();
});

// Helper function to create GitHub API mocks
global.mockGitHubAPI = {
  repos: {
    get: (owner, repo) => {
      return nock(GITHUB_API_URL)
        .get(`/repos/${owner}/${repo}`)
        .reply(200, {
          id: 123456789,
          name: repo,
          full_name: `${owner}/${repo}`,
          owner: { login: owner },
          private: false,
          default_branch: 'main'
        });
    },
    
    createRelease: (owner, repo, tag) => {
      return nock(GITHUB_API_URL)
        .post(`/repos/${owner}/${repo}/releases`)
        .reply(201, {
          id: 987654321,
          tag_name: tag,
          name: tag,
          draft: false,
          prerelease: false
        });
    }
  },
  
  pulls: {
    get: (owner, repo, number) => {
      return nock(GITHUB_API_URL)
        .get(`/repos/${owner}/${repo}/pulls/${number}`)
        .reply(200, {
          id: number,
          number: number,
          state: 'open',
          title: 'Test Pull Request',
          head: { sha: 'abc123' },
          base: { sha: 'def456' }
        });
    }
  }
};

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};