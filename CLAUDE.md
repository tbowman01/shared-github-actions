# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository is designed to provide **shared GitHub Actions workflows** for automated compliance evidence collection supporting SOC 2, NIST RMF, and CMMC Level 3 frameworks. Currently in the planning phase, the repository contains detailed architectural plans and production-ready scaffolds awaiting implementation.

## Project Status

**Current Phase**: Planning/Pre-Implementation
- Comprehensive planning documents exist in `/plans/`
- No actual GitHub Actions workflows implemented yet
- Repository structure needs to be created based on the scaffolds

## Key Planning Documents

### 1. `plans/research-soc2-rmf-cmmc3-automation.md`
- 24-month implementation roadmap with 4 phases
- Technical architecture including microservices design
- ROI calculations and success metrics
- AI/GPT integration proposals for policy analysis

### 2. `plans/final_compliance_automation_soc_2_nist_rmf_cmmc_l_3_merged_workflows_scaffolds.md`
- **Production-ready workflow scaffolds** - Use these as templates when implementing
- Complete repository structure blueprint
- YAML configurations for compliance control mappings
- Branch protection rulesets and policy drift detection

## Proposed Repository Structure (from planning docs)

```
.github/
├── workflows/
│   ├── evidence-archive.yml      # Daily evidence collection
│   ├── evidence-rollups.yml      # Weekly/monthly summaries
│   └── pr-checks.yml            # PR compliance checks
├── rulesets/
│   ├── evidence-protection.json  # Immutable evidence branch
│   └── branch-protection.json    # Main/develop protection
└── CODEOWNERS

.compliance/
├── mappings/
│   ├── nist-controls.yml        # NIST → Evidence mapping
│   ├── cmmc-practices.yml       # CMMC → Evidence mapping
│   └── soc2-criteria.yml        # SOC 2 → Evidence mapping
├── oscal/
│   └── ssp-template.json        # OSCAL SSP template
└── config.yml                   # Main compliance config

evidence/                        # Immutable branch for compliance data
├── daily/
├── weekly/
└── monthly/

docs/
├── SETUP.md
├── VERIFY.md                    # Auto-updated evidence links
└── ARCHITECTURE.md
```

## Common Development Tasks

### 1. Implementing GitHub Actions Workflows
When creating workflows, use the scaffolds from `plans/final_compliance_automation_soc_2_nist_rmf_cmmc_l_3_merged_workflows_scaffolds.md`:

```bash
# The planning doc contains complete workflow definitions for:
- evidence-archive.yml (lines 450-609)
- evidence-rollups.yml (lines 611-746)
- Branch protection rulesets (lines 748-829)
```

### 2. Setting Up Evidence Collection
The system should collect evidence for:
- Repository configurations and settings
- Access controls and permissions
- Security alerts and vulnerabilities
- Audit logs and compliance data
- Developer activities and branch protections

### 3. Compliance Control Mappings
Create YAML files in `.compliance/mappings/` using the templates from the planning doc:
- NIST controls mapping (example at lines 831-901)
- CMMC practices mapping (example at lines 903-974)

### 4. Testing Workflows Locally
```bash
# Use act for local GitHub Actions testing (once workflows are created)
act -W .github/workflows/evidence-archive.yml

# Validate YAML syntax
yamllint .github/workflows/*.yml

# Check mapping file validity
python -m yaml .compliance/mappings/*.yml
```

## Architecture & Design Patterns

### Evidence Collection Architecture
1. **Daily Snapshots**: GitHub API calls to collect organization/repo data
2. **Data Format**: CSV and JSON outputs for flexibility
3. **Storage**: Evidence branch with strict protection rules
4. **Rollups**: Weekly/monthly aggregations for reporting

### Compliance Mapping Strategy
- Each framework (SOC 2, NIST, CMMC) has dedicated mapping files
- Evidence files are linked to specific controls/practices
- OSCAL format for standardized compliance documentation

### Security Considerations
- Evidence branch must be immutable (no force pushes, no deletions)
- Silent policy drift detection to prevent circumvention
- CODEOWNERS file to control workflow modifications
- Secrets management for API tokens and credentials

## Implementation Priorities

Based on the planning documents, implement in this order:

1. **Phase 1: Foundation** (from planning doc)
   - Create `.github/workflows/` directory structure
   - Implement `evidence-archive.yml` workflow
   - Set up evidence branch with protection rules
   - Create initial compliance mappings

2. **Phase 2: Core Features**
   - Implement weekly/monthly rollup workflows
   - Add VERIFY.md auto-update functionality
   - Create PR compliance checks

3. **Phase 3: Advanced Features**
   - OSCAL SSP generation
   - Policy drift detection
   - Multi-org support

## Key Technologies & Dependencies

From the planning documents, this project will use:
- **GitHub Actions** & **GitHub API** (primary automation)
- **Python** for data processing scripts
- **jq** for JSON manipulation
- **csvkit** for CSV processing
- **OSCAL** tools for compliance documentation
- **act** for local workflow testing

## Important Notes

1. **Immutable Evidence**: The evidence branch must never be modified after data is written
2. **Compliance Focus**: Every feature should map back to specific compliance requirements
3. **Automation First**: Manual processes should be eliminated wherever possible
4. **Multi-Framework**: Design for SOC 2, NIST RMF, and CMMC Level 3 simultaneously
5. **Extensibility**: Architecture should support adding new compliance frameworks

## References

- GitHub Actions documentation: https://docs.github.com/en/actions
- OSCAL documentation: https://pages.nist.gov/OSCAL/
- GitHub API reference: https://docs.github.com/en/rest
- SOC 2 Trust Services Criteria
- NIST RMF controls
- CMMC Level 3 practices