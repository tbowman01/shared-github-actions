# Final Compliance Automation: SOC 2 + NIST RMF + CMMC Level 3

This canvas contains the **merged, production-ready scaffolds** for:

- Daily evidence snapshots with **SOC 2**, **NIST RMF**, and **CMMC Level 3** outputs (JSON + CSV)
- **Silent policy drift detection** for branch protections
- Weekly & monthly **roll-ups**
- GitHub **rulesets** for `main`, `develop`, and **immutable** `evidence` branch
- README **badges** (status + freshness)
- Mapping files and a minimal **OSCAL SSP** stub
- `VERIFY.md` auto-indexing
- Makefile helpers and repo layout

> Copy these files directly into your repository. Paths are relative to repo root.

---

## 0) Suggested Repository Layout

```text
.compliance/
  baseline_ruleset_evidence.json          # one-time seeded
  baseline_ruleset_evidence.sha256        # one-time seeded
  rmf/
    controls_map.yaml                     # NIST 800-53 → evidence mapping
  cmmc/
    cmmc_controls_map.yaml                # CMMC L3 → evidence mapping
.github/
  policy/
    scripts/
      apply-ruleset-required-checks.sh    # main/develop + evidence rulesets (merged)
  workflows/
    apply-rulesets.yml
    evidence-archive.yml                  # daily SOC2 + RMF + CMMC + drift detect
    evidence-rollups.yml                  # weekly/monthly roll-ups
Makefile
README.md
VERIFY.md
```

---

## 1) Mapping Files

### 1.1 `.compliance/rmf/controls_map.yaml`

```yaml
# NIST SP 800-53 control → evidence files (relative to a snapshot directory)
AC-2:
  - org_members.csv
  - outside_collaborators.csv
  - repo_collaborators.csv
CM-3:
  - branch_protection_*.json
  - pr_approvals_last30d.csv
RA-5:
  - code_scanning_alerts.csv
  - dependabot_alerts.csv
SI-2:
  - code_scanning_alerts.csv
AC-17:
  - teams.csv
  - repo_collaborators.csv
AU-6:
  - pr_approvals_last30d.csv
CM-6:
  - branch_protection_*.json
SA-11:
  - code_scanning_alerts.csv
  - dependabot_alerts.csv
```

### 1.2 `.compliance/cmmc/cmmc_controls_map.yaml`

```yaml
# CMMC Level 3 practice → evidence files (relative to a snapshot directory)
AC.1.001:  # Limit system access to authorized users
  - org_members.csv
  - outside_collaborators.csv
  - repo_collaborators.csv
AC.2.005:  # Require MFA (org-level export added below)
  - mfa_enforcement.json
CM.3.068:  # Configure security settings
  - branch_protection_main.json
  - branch_protection_develop.json
RM.3.146:  # Perform periodic risk assessments
  - code_scanning_alerts.csv
  - dependabot_alerts.csv
SI.2.216:  # Monitor organizational systems
  - code_scanning_alerts.csv
  - trivy_fs.sarif
```

> **Note:** Feel free to extend these maps to cover more controls/practices.

---

## 2) Daily Evidence Workflow (Merged)

**File:** `.github/workflows/evidence-archive.yml`

```yaml
name: evidence-archive
on:
  schedule:
    - cron: "11 4 * * *"   # Daily at 04:11 UTC
  workflow_dispatch:

permissions:
  contents: write
  security-events: read
  actions: read
  administration: read

jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # --- Integrity guardrails before doing anything ---
      - name: Verify evidence branch ruleset exists & enforced
        shell: bash
        run: |
          echo "🔍 Checking evidence branch protections..."
          RULESETS=$(gh api -H "Accept: application/vnd.github+json" \
            "/repos/${{ github.repository }}/rulesets")

          EVIDENCE_ID=$(echo "$RULESETS" | jq -r '.[] | select(.name=="Evidence Branch Protection") | .id')
          if [[ -z "$EVIDENCE_ID" || "$EVIDENCE_ID" == "null" ]]; then
            echo "❌ Evidence Branch Protection ruleset not found"; exit 1; fi

          ACTOR_OK=$(echo "$RULESETS" | jq -r '.[] | select(.name=="Evidence Branch Protection") | .rules[] | select(.type=="push") | .parameters.actor_allow_list[]' | grep -c '^github-actions\[bot\]$')
          [[ "$ACTOR_OK" -gt 0 ]] || { echo "❌ Push not restricted to github-actions[bot]"; exit 1; }

          SIG_OK=$(echo "$RULESETS" | jq -r '.[] | select(.name=="Evidence Branch Protection") | .rules[].type' | grep -c 'required_signatures')
          [[ "$SIG_OK" -gt 0 ]] || { echo "❌ Required signatures missing"; exit 1; }

      - name: Silent policy drift detection (Evidence Branch)
        shell: bash
        run: |
          set -e
          echo "🔒 Drift detection for Evidence Branch Protection..."
          gh api -H "Accept: application/vnd.github+json" \
            "/repos/${{ github.repository }}/rulesets" \
            | jq '.[] | select(.name=="Evidence Branch Protection")' \
            > current_ruleset.json

          if [[ -f .compliance/baseline_ruleset_evidence.sha256 ]]; then
            CUR_HASH=$(sha256sum current_ruleset.json | awk '{print $1}')
            BASE_HASH=$(cat .compliance/baseline_ruleset_evidence.sha256)
            if [[ "$CUR_HASH" != "$BASE_HASH" ]]; then
              echo "❌ Drift detected in Evidence Branch Protection!"; \
              echo "Baseline: $BASE_HASH"; echo "Current:  $CUR_HASH"; exit 1;
            fi
            echo "✅ No drift detected."
          else
            echo "⚠️ Baseline not found (.compliance/baseline_ruleset_evidence.sha256). Skipping drift check (first-run expected)."
          fi

      # --- Prepare evidence branch snapshot ---
      - name: Prepare evidence branch
        run: |
          git fetch origin evidence:refs/remotes/origin/evidence || true
          git checkout -B evidence origin/evidence || git checkout -B evidence
          SNAPSHOT_DIR="evidence/$(date -u +%Y-%m-%d)"
          mkdir -p "$SNAPSHOT_DIR"
          echo "SNAPSHOT_DIR=$SNAPSHOT_DIR" >> $GITHUB_ENV

      - name: Install tooling (jq, csvkit)
        run: |
          sudo apt-get update -y
          sudo apt-get install -y jq python3-pip
          pip3 install csvkit

      # --- Evidence collection (SOC 2 + shared) ---
      - name: Export org members & roles
        run: |
          gh api orgs/${{ github.repository_owner }}/members --paginate > "$SNAPSHOT_DIR/org_members.json"
          jq -r '.[] | [.login, .id, .type] | @csv' "$SNAPSHOT_DIR/org_members.json" > "$SNAPSHOT_DIR/org_members.csv"

      - name: Export outside collaborators
        run: |
          gh api orgs/${{ github.repository_owner }}/outside_collaborators --paginate > "$SNAPSHOT_DIR/outside_collaborators.json"
          jq -r '.[] | [.login, .id, .permissions.admin, .permissions.push, .permissions.pull] | @csv' "$SNAPSHOT_DIR/outside_collaborators.json" > "$SNAPSHOT_DIR/outside_collaborators.csv"

      - name: Export teams
        run: |
          gh api orgs/${{ github.repository_owner }}/teams --paginate > "$SNAPSHOT_DIR/teams.json"
          jq -r '.[] | [.name, .id, .slug, .privacy] | @csv' "$SNAPSHOT_DIR/teams.json" > "$SNAPSHOT_DIR/teams.csv"

      - name: Export repo collaborators & permissions
        run: |
          gh api repos/${{ github.repository }}/collaborators --paginate > "$SNAPSHOT_DIR/repo_collaborators.json"
          jq -r '.[] | [.login, .permissions.admin, .permissions.push, .permissions.pull] | @csv' "$SNAPSHOT_DIR/repo_collaborators.json" > "$SNAPSHOT_DIR/repo_collaborators.csv"

      - name: Export branch protection rules
        run: |
          gh api repos/${{ github.repository }}/branches/main/protection > "$SNAPSHOT_DIR/branch_protection_main.json" || true
          gh api repos/${{ github.repository }}/branches/develop/protection > "$SNAPSHOT_DIR/branch_protection_develop.json" || true

      - name: Pull request approvals (last 30 days)
        run: |
          gh api repos/${{ github.repository }}/pulls --paginate -q '.[] | {number, title, user: .user.login, merged_at, approvals: (.requested_reviewers|length)}' \
            > "$SNAPSHOT_DIR/pr_approvals_last30d.json"
          jq -r '[.number, .title, .user, .merged_at, .approvals] | @csv' "$SNAPSHOT_DIR/pr_approvals_last30d.json" > "$SNAPSHOT_DIR/pr_approvals_last30d.csv"

      - name: Export Code Scanning alerts
        run: |
          gh api repos/${{ github.repository }}/code-scanning/alerts --paginate > "$SNAPSHOT_DIR/code_scanning_alerts.json"
          jq -r '.[] | [.number, .rule.id, .rule.severity, .state, .created_at, .url] | @csv' "$SNAPSHOT_DIR/code_scanning_alerts.json" > "$SNAPSHOT_DIR/code_scanning_alerts.csv"

      - name: Export Dependabot alerts
        run: |
          gh api repos/${{ github.repository }}/dependabot/alerts --paginate > "$SNAPSHOT_DIR/dependabot_alerts.json"
          jq -r '.[] | [.number, .security_advisory.severity, .security_advisory.identifier.value, .state, .created_at, .url] | @csv' "$SNAPSHOT_DIR/dependabot_alerts.json" > "$SNAPSHOT_DIR/dependabot_alerts.csv"

      - name: Capture security policy if present
        run: |
          cp SECURITY.md "$SNAPSHOT_DIR/" || echo "No SECURITY.md found"

      # --- CMMC additions (org MFA example) ---
      - name: Export org SSO/MFA enforcement (if available)
        shell: bash
        run: |
          # Best-effort: org auth settings vary by plan; skip if unavailable
          gh api -X GET -H "Accept: application/vnd.github+json" \
            "/orgs/${{ github.repository_owner }}" \
            > "$SNAPSHOT_DIR/mfa_enforcement.json" || true

      # --- NIST RMF control-tagged copies ---
      - name: Generate RMF-tagged copies & controls_map.csv
        shell: bash
        run: |
          python3 - <<'PY'
          import os, csv, glob, yaml
          snap=os.environ['SNAPSHOT_DIR']
          rmf_dir=os.path.join(snap,'rmf'); os.makedirs(rmf_dir, exist_ok=True)
          with open('.compliance/rmf/controls_map.yaml') as f:
            mapping=yaml.safe_load(f) or {}
          rows=[]
          for ctrl, pats in mapping.items():
            cdir=os.path.join(rmf_dir, ctrl); os.makedirs(cdir, exist_ok=True)
            for pat in pats:
              for p in glob.glob(os.path.join(snap, pat)):
                base=os.path.basename(p)
                tgt=os.path.join(cdir, f"{ctrl.lower()}_{base}")
                with open(p,'rb') as s, open(tgt,'wb') as d: d.write(s.read())
                rows.append([ctrl, base, os.path.relpath(tgt)])
          with open(os.path.join(rmf_dir, 'controls_map.csv'),'w',newline='') as f:
            w=csv.writer(f); w.writerow(['control','source_file','rmf_path']); w.writerows(rows)
          PY

      # --- CMMC L3 control-tagged copies ---
      - name: Generate CMMC-tagged copies & cmmc_controls_map.csv
        shell: bash
        run: |
          python3 - <<'PY'
          import os, csv, glob, yaml
          snap=os.environ['SNAPSHOT_DIR']
          cdir_root=os.path.join(snap,'cmmc'); os.makedirs(cdir_root, exist_ok=True)
          with open('.compliance/cmmc/cmmc_controls_map.yaml') as f:
            mapping=yaml.safe_load(f) or {}
          rows=[]
          for ctrl, pats in mapping.items():
            cdir=os.path.join(cdir_root, ctrl); os.makedirs(cdir, exist_ok=True)
            for pat in pats:
              for p in glob.glob(os.path.join(snap, pat)):
                base=os.path.basename(p)
                tgt=os.path.join(cdir, f"{ctrl.replace('.','_').lower()}_{base}")
                with open(p,'rb') as s, open(tgt,'wb') as d: d.write(s.read())
                rows.append([ctrl, base, os.path.relpath(tgt)])
          with open(os.path.join(cdir_root, 'cmmc_controls_map.csv'),'w',newline='') as f:
            w=csv.writer(f); w.writerow(['practice','source_file','cmmc_path']); w.writerows(rows)
          PY

      # --- Minimal OSCAL SSP stub (extended) ---
      - name: Generate OSCAL SSP stub
        shell: bash
        run: |
          python3 - <<'PY'
          import os, json, datetime
          snap=os.path.basename(os.environ['SNAPSHOT_DIR'])
          data={
            "meta": {"generated": datetime.datetime.utcnow().isoformat()+"Z", "repository": "${{ github.repository }}", "snapshot": snap},
            "system-characteristics": {"system-name": "${{ github.repository }}", "security-sensitivity-level": "moderate"},
            "implemented-requirements": [
              {"control-id": "AC-2", "evidence": ["rmf/AC-2/"]},
              {"control-id": "CM-3", "evidence": ["rmf/CM-3/"]},
              {"control-id": "RA-5", "evidence": ["rmf/RA-5/"]},
              {"control-id": "SI-2", "evidence": ["rmf/SI-2/"]},
              {"control-id": "AC.1.001", "evidence": ["cmmc/AC.1.001/"]},
              {"control-id": "CM.3.068", "evidence": ["cmmc/CM.3.068/"]}
            ]
          }
          with open(os.path.join('evidence',snap,'oscal_ssp_stub.json'),'w') as f: json.dump(data,f,indent=2)
          PY

      # --- Per-snapshot index & latest pointer ---
      - name: Build auditor index for this snapshot
        shell: bash
        run: |
          INDEX="$SNAPSHOT_DIR/index.md"; DATE=$(basename "$SNAPSHOT_DIR")
          {
            echo "# Evidence — $DATE"; echo
            echo "## SOC 2";
            [[ -f "$SNAPSHOT_DIR/org_members.csv" ]] && echo "- [Org Members (CSV)](org_members.csv) • [JSON](org_members.json)"
            [[ -f "$SNAPSHOT_DIR/outside_collaborators.csv" ]] && echo "- [Outside Collaborators (CSV)](outside_collaborators.csv) • [JSON](outside_collaborators.json)"
            [[ -f "$SNAPSHOT_DIR/teams.csv" ]] && echo "- [Teams (CSV)](teams.csv) • [JSON](teams.json)"
            [[ -f "$SNAPSHOT_DIR/repo_collaborators.csv" ]] && echo "- [Repo Collaborators (CSV)](repo_collaborators.csv) • [JSON](repo_collaborators.json)"
            [[ -f "$SNAPSHOT_DIR/branch_protection_main.json" ]] && echo "- [Branch Protection (main)](branch_protection_main.json)"
            [[ -f "$SNAPSHOT_DIR/branch_protection_develop.json" ]] && echo "- [Branch Protection (develop)](branch_protection_develop.json)"
            [[ -f "$SNAPSHOT_DIR/pr_approvals_last30d.csv" ]] && echo "- [PR Approvals (CSV)](pr_approvals_last30d.csv) • [JSON](pr_approvals_last30d.json)"
            [[ -f "$SNAPSHOT_DIR/code_scanning_alerts.csv" ]] && echo "- [Code Scanning (CSV)](code_scanning_alerts.csv) • [JSON](code_scanning_alerts.json)"
            [[ -f "$SNAPSHOT_DIR/dependabot_alerts.csv" ]] && echo "- [Dependabot (CSV)](dependabot_alerts.csv) • [JSON](dependabot_alerts.json)"; echo
            echo "## NIST RMF"; echo "- [OSCAL SSP Stub](oscal_ssp_stub.json)"; echo "- [Control Map (CSV)](rmf/controls_map.csv)";
            for d in "$SNAPSHOT_DIR"/rmf/*; do [[ -d "$d" ]] && echo "- $(basename "$d") → [files](rmf/$(basename "$d")/)"; done; echo
            echo "## CMMC Level 3"; echo "- [Control Map (CSV)](cmmc/cmmc_controls_map.csv)";
            for d in "$SNAPSHOT_DIR"/cmmc/*; do [[ -d "$d" ]] && echo "- $(basename "$d") → [files](cmmc/$(basename "$d")/)"; done
          } > "$INDEX"

      - name: Update 'latest' pointer & meta.json
        shell: bash
        run: |
          rm -rf evidence/latest
          cp -R "$SNAPSHOT_DIR" evidence/latest
          DATE=$(basename "$SNAPSHOT_DIR"); WEEK=$(date -u +%G-W%V); MONTH=$(date -u +%Y-%m)
          jq -n --arg date "$DATE" --arg weekly "$WEEK" --arg monthly "$MONTH" '{meta:{date:$date,weekly:$weekly,monthly:$monthly}}' \
            > evidence/latest/meta.json

      - name: Autolink latest snapshot in VERIFY.md
        shell: bash
        run: |
          DATE=$(basename "$SNAPSHOT_DIR")
          BLOCK_START="<!-- SOC2-AUTO-INDEX:START -->"; BLOCK_END="<!-- SOC2-AUTO-INDEX:END -->"
          NEW_BLOCK=$(cat <<'EOF'
          <!-- SOC2-AUTO-INDEX:START -->
          ## Compliance Evidence (Latest)

          - **Latest snapshot:** [evidence/latest](evidence/latest/)
          - **Date:** DATE_PLACEHOLDER  
          - **One-click index:** [Index](evidence/latest/index.md)

          **SOC 2 Quick Links**
          - Access Control: [Org Members](evidence/latest/org_members.csv) · [Outside Collaborators](evidence/latest/outside_collaborators.csv) · [Teams](evidence/latest/teams.csv) · [Repo Collaborators](evidence/latest/repo_collaborators.csv)
          - Change Mgmt: [PR Approvals](evidence/latest/pr_approvals_last30d.csv)
          - Vulnerability Mgmt: [Code Scanning](evidence/latest/code_scanning_alerts.csv) · [Dependabot](evidence/latest/dependabot_alerts.csv)

          **NIST RMF Quick Links**
          - [OSCAL SSP Stub](evidence/latest/oscal_ssp_stub.json)
          - [Control Map](evidence/latest/rmf/controls_map.csv)

          **CMMC L3 Quick Links**
          - [Control Map](evidence/latest/cmmc/cmmc_controls_map.csv)

          _Historical archives under_ [`/evidence/YYYY-MM-DD`](evidence/).
          <!-- SOC2-AUTO-INDEX:END -->
          EOF
          )
          NEW_BLOCK=${NEW_BLOCK/DATE_PLACEHOLDER/$DATE}

          if [[ -f VERIFY.md ]]; then
            if grep -q "$BLOCK_START" VERIFY.md; then
              awk -v start="$BLOCK_START" -v end="$BLOCK_END" -v repl="$NEW_BLOCK" 'BEGIN{inblk=0} $0 ~ start {print repl; inblk=1; next} $0 ~ end {inblk=0; next} !inblk {print}' VERIFY.md > VERIFY.md.new && mv VERIFY.md.new VERIFY.md
            else
              printf "\n%s\n" "$NEW_BLOCK" >> VERIFY.md
            fi
          else
            echo -e "# VERIFY\n\n$NEW_BLOCK" > VERIFY.md
          fi

      - name: Commit & push evidence
        run: |
          git add evidence || true
          git add VERIFY.md || true
          git -c user.name=github-actions -c user.email=github-actions@users.noreply.github.com \
            commit -m "chore(evidence): daily snapshot $(date -u +%F) (SOC2+RMF+CMMC)" || echo "No changes"
          git push origin evidence
```

````

---

## 3) Weekly & Monthly Roll-ups

**File:** `.github/workflows/evidence-rollups.yml`

```yaml
name: evidence-rollups
on:
  schedule:
    - cron: "33 5 * * 1"   # Weekly (Mon 05:33 UTC)
    - cron: "47 6 1 * *"   # Monthly (1st of month 06:47 UTC)
  workflow_dispatch:

permissions:
  contents: write

jobs:
  rollup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          git fetch origin evidence:refs/remotes/origin/evidence || true
          git checkout -B evidence origin/evidence || git checkout -B evidence

      - name: Install csvkit
        run: |
          sudo apt-get update -y && sudo apt-get install -y python3-pip
          pip3 install csvkit

      - name: Weekly roll-up
        shell: bash
        run: |
          WEEK=$(date -u +%G-W%V)
          OUTDIR="evidence/weekly/$WEEK"; mkdir -p "$OUTDIR"
          SNAP_DIRS=$(ls -1d evidence/20* | tail -n 7 || true)
          for base in org_members outside_collaborators teams repo_collaborators pr_approvals_last30d code_scanning_alerts dependabot_alerts; do
            files=(); for d in $SNAP_DIRS; do f="$d/${base}.csv"; [[ -f "$f" ]] && files+=("$f"); done
            [[ ${#files[@]} -gt 0 ]] && csvstack "${files[@]}" > "$OUTDIR/${base}_week.csv" || true
          done
          { echo "# Weekly Roll-up — $WEEK"; for f in "$OUTDIR"/*_week.csv; do [[ -f "$f" ]] && echo "- $(basename "$f")"; done; } > "$OUTDIR/index.md"

      - name: Monthly roll-up
        shell: bash
        run: |
          MONTH=$(date -u +%Y-%m)
          OUTDIR="evidence/monthly/$MONTH"; mkdir -p "$OUTDIR"
          SNAP_DIRS=$(ls -1d evidence/$MONTH-* 2>/dev/null || true)
          for base in org_members outside_collaborators teams repo_collaborators pr_approvals_last30d code_scanning_alerts dependabot_alerts; do
            files=(); for d in $SNAP_DIRS; do f="$d/${base}.csv"; [[ -f "$f" ]] && files+=("$f"); done
            [[ ${#files[@]} -gt 0 ]] && csvstack "${files[@]}" > "$OUTDIR/${base}_month.csv" || true
          done
          { echo "# Monthly Roll-up — $MONTH"; for f in "$OUTDIR"/*_month.csv; do [[ -f "$f" ]] && echo "- $(basename "$f")"; done; } > "$OUTDIR/index.md"

      - name: Update VERIFY.md roll-up links
        shell: bash
        run: |
          BLOCK_START="<!-- SOC2-ROLLUPS:START -->"; BLOCK_END="<!-- SOC2-ROLLUPS:END -->"
          WEEK=$(date -u +%G-W%V); MONTH=$(date -u +%Y-%m)
          NEW_BLOCK=$(cat <<EOF
          <!-- SOC2-ROLLUPS:START -->
          ## Roll-ups
          - **Weekly:** [evidence/weekly/$WEEK](evidence/weekly/$WEEK/index.md)
          - **Monthly:** [evidence/monthly/$MONTH](evidence/monthly/$MONTH/index.md)
          <!-- SOC2-ROLLUPS:END -->
          EOF
          )
          if [[ -f VERIFY.md ]]; then
            if grep -q "$BLOCK_START" VERIFY.md; then
              awk -v start="$BLOCK_START" -v end="$BLOCK_END" -v repl="$NEW_BLOCK" 'BEGIN{inblk=0} $0 ~ start {print repl; inblk=1; next} $0 ~ end {inblk=0; next} !inblk {print}' VERIFY.md > VERIFY.md.new && mv VERIFY.md.new VERIFY.md
            else
              printf "\n%s\n" "$NEW_BLOCK" >> VERIFY.md
            fi
          else
            echo -e "# VERIFY\n\n$NEW_BLOCK" > VERIFY.md
          fi

      - name: Commit & push roll-ups
        run: |
          git add evidence || true
          git add VERIFY.md || true
          git -c user.name=github-actions -c user.email=github-actions@users.noreply.github.com \
            commit -m "chore(evidence): weekly/monthly roll-ups $(date -u +%F)" || echo "No changes"
          git push origin evidence
````

````

---

## 4) Rulesets (Merged Script + Workflow)

### 4.1 `.github/policy/scripts/apply-ruleset-required-checks.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
OWNER_REPO="${GITHUB_REPOSITORY:?}"
OWNER="${OWNER_REPO%%/*}"; REPO="${OWNER_REPO##*/}"

BRANCHES=(main develop)
read -r -d '' CHECKS <<'JSON'
[
  {"context":"integrity-pr"},
  {"context":"lint"},
  {"context":"test"},
  {"context":"package-version-check / version-check"},
  {"context":"supplychain-provenance / sbom-and-provenance"},
  {"context":"CodeQL / Analyze"}
]
JSON

for BR in "${BRANCHES[@]}"; do
  TITLE="Required Checks (automation) for $BR"
  PAYLOAD=$(jq -n --arg title "$TITLE" --arg branch "$BR" --argjson checks "$CHECKS" ' {
    name: $title, target: "branch", enforcement: "active",
    conditions: { ref_name: { include: [$branch], exclude: [] } },
    rules: [
      { type: "required_status_checks", parameters: { required_status_checks: $checks, strict_required_status_checks_policy: true } },
      { type: "pull_request", parameters: { dismiss_stale_reviews_on_push: false, required_approving_review_count: 1, require_last_push_approval: false, require_code_owner_review: true } },
      { type: "non_fast_forward" },
      { type: "update" },
      { type: "required_linear_history" },
      { type: "required_signatures" }
    ],
    bypass_actors: [] }')

  EXIST=$(gh api -H "Accept: application/vnd.github+json" \
    "/repos/$OWNER/$REPO/rulesets" --jq ".[] | select(.name==\"$TITLE\").id" | head -n1 || true)
  if [[ -n "$EXIST" ]]; then
    gh api --method PATCH -H "Accept: application/vnd.github+json" \
      "/repos/$OWNER/$REPO/rulesets/$EXIST" --input <(printf '%s' "$PAYLOAD")
  else
    gh api --method POST -H "Accept: application/vnd.github+json" \
      "/repos/$OWNER/$REPO/rulesets" --input <(printf '%s' "$PAYLOAD")
  fi
done

# Evidence branch (immutable, CI-only)
BRANCH="evidence"; TITLE="Evidence Branch Protection"
read -r -d '' EVIDENCE_RULES <<'JSON'
[
  { "type": "non_fast_forward" },
  { "type": "update" },
  { "type": "required_signatures" },
  { "type": "push", "parameters": { "actor_allow_list": ["github-actions[bot]"] } }
]
JSON

EVIDENCE_PAYLOAD=$(jq -n --arg title "$TITLE" --arg branch "$BRANCH" --argjson rules "$EVIDENCE_RULES" ' {
  name: $title, target: "branch", enforcement: "active",
  conditions: { ref_name: { include: [$branch], exclude: [] } },
  rules: $rules, bypass_actors: [] }')

EXIST=$(gh api -H "Accept: application/vnd.github+json" \
  "/repos/$OWNER/$REPO/rulesets" --jq ".[] | select(.name==\"$TITLE\").id" | head -n1 || true)
if [[ -n "$EXIST" ]]; then
  gh api --method PATCH -H "Accept: application/vnd.github+json" \
    "/repos/$OWNER/$REPO/rulesets/$EXIST" --input <(printf '%s' "$EVIDENCE_PAYLOAD")
else
  gh api --method POST -H "Accept: application/vnd.github+json" \
    "/repos/$OWNER/$REPO/rulesets" --input <(printf '%s' "$EVIDENCE_PAYLOAD")
fi
````

### 4.2 `.github/workflows/apply-rulesets.yml`

```yaml
name: apply-all-rulesets
on:
  workflow_dispatch:
permissions:
  administration: write
  contents: read
jobs:
  apply:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Apply rulesets for main, develop, and evidence
        run: bash .github/policy/scripts/apply-ruleset-required-checks.sh
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 5) README.md Badges (Status + Freshness)

```markdown
## 📊 DevSecOps Compliance & Security Status

| Category               | Status | Freshness |
|------------------------|--------|-----------|
| **Governance**         | [![Ruleset Required Checks](https://github.com/${{ github.repository }}/actions/workflows/apply-rulesets.yml/badge.svg)](https://github.com/${{ github.repository }}/actions/workflows/apply-rulesets.yml) | — |
| **Security Hardening** | [![Actions Hardening](https://github.com/${{ github.repository }}/actions/workflows/actions-hardening.yml/badge.svg)](https://github.com/${{ github.repository }}/actions/workflows/actions-hardening.yml) | — |
| **Secure Release**     | [![Integrity Release (SBOM+Signing)](https://github.com/${{ github.repository }}/actions/workflows/integrity-release.yml/badge.svg)](https://github.com/${{ github.repository }}/actions/workflows/integrity-release.yml) | — |
| **Evidence (Daily)**   | [![Evidence Archive](https://github.com/${{ github.repository }}/actions/workflows/evidence-archive.yml/badge.svg)](https://github.com/${{ github.repository }}/actions/workflows/evidence-archive.yml) | ![Latest](https://img.shields.io/badge/dynamic/json?label=latest&query=$.meta.date&url=https://raw.githubusercontent.com/${{ github.repository }}/evidence/latest/meta.json) |
| **Evidence Roll-ups**  | [![Evidence Roll-ups](https://github.com/${{ github.repository }}/actions/workflows/evidence-rollups.yml/badge.svg)](https://github.com/${{ github.repository }}/actions/workflows/evidence-rollups.yml) | ![Weekly](https://img.shields.io/badge/dynamic/json?label=weekly&query=$.meta.weekly&url=https://raw.githubusercontent.com/${{ github.repository }}/evidence/latest/meta.json) ![Monthly](https://img.shields.io/badge/dynamic/json?label=monthly&query=$.meta.monthly&url=https://raw.githubusercontent.com/${{ github.repository }}/evidence/latest/meta.json) |
| **Code Security**      | [![CodeQL](https://github.com/${{ github.repository }}/actions/workflows/codeql.yml/badge.svg)](https://github.com/${{ github.repository }}/actions/workflows/codeql.yml) | — |
| **Vuln Scanning**      | [![Trivy](https://github.com/${{ github.repository }}/actions/workflows/trivy.yml/badge.svg)](https://github.com/${{ github.repository }}/actions/workflows/trivy.yml) | — |
```

---

## 6) Makefile helpers

```makefile
ruleset:
	gh workflow run apply-all-rulesets

evidence:
	gh workflow run evidence-archive

rollups:
	gh workflow run evidence-rollups
```

---

## 7) Baseline Seeding (first run only)

```bash
# After running apply-all-rulesets once:
GH_REPO="<owner>/<repo>"

gh api -H "Accept: application/vnd.github+json" \
  "/repos/$GH_REPO/rulesets" \
  | jq '.[] | select(.name=="Evidence Branch Protection")' \
  > .compliance/baseline_ruleset_evidence.json

sha256sum .compliance/baseline_ruleset_evidence.json | awk '{print $1}' \
  > .compliance/baseline_ruleset_evidence.sha256

git add .compliance/baseline_ruleset_evidence.*
git commit -m "chore(compliance): seed evidence ruleset baseline"
git push origin main
```

---

## 8) Sample Snapshot Index (rendered)

```markdown
# Evidence — 2025-08-08

## SOC 2
- Org Members (CSV) • JSON
- Outside Collaborators (CSV) • JSON
- Teams (CSV) • JSON
- Repo Collaborators (CSV) • JSON
- Branch Protection (main)
- Branch Protection (develop)
- PR Approvals (CSV) • JSON
- Code Scanning (CSV) • JSON
- Dependabot (CSV) • JSON

## NIST RMF
- OSCAL SSP Stub
- Control Map (CSV)
- AC-2 → files
- CM-3 → files
- RA-5 → files
- SI-2 → files

## CMMC Level 3
- Control Map (CSV)
- AC.1.001 → files
- CM.3.068 → files
```

---

### Notes

- If org-level MFA details are unavailable via API, keep `mfa_enforcement.json` as best-effort; you can also attach screenshots/pdfs to the snapshot dir if needed.
- Add more mappings over time to broaden control coverage; the job will automatically copy/tag evidence.
- Only `evidence/latest/` is refreshed; dated snapshot directories remain immutable.

