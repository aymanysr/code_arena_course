#!/bin/zsh
# Durable OpenCode coding-session launcher (session manager, not a prompt forwarder).
# One active run at a time, Build/Fix/Review modes, per-run packages, corrected
# Desktop delivery (clipboard + directory-only URL + accessibility paste), terminal
# fallback, status/close-stale, and a finalizer-driven compatibility handoff.

set -eu

repo_dir=${0:A:h}
plans_dir="$repo_dir/docs/superpowers/plans"
model="opencode/muse-spark-1.3-contributor-free"
variant="xhigh"
opencode_fallback="/Users/ayousr/.opencode/bin/opencode"
handoff_relative=".scratch/opencode-handoffs/latest.md"
handoff_path="$repo_dir/$handoff_relative"
runs_dir="$repo_dir/.scratch/opencode-runs"
active_file="$runs_dir/active"
finalizer_script="$repo_dir/scripts/finalize-opencode-run.sh"

dry_run=0
launch_mode="desktop"
run_mode="build"
manual_paste=0
terminal_given=0
input_mode=""
plan_path=""
plan_text=""
from_run=""
status_only=0
close_stale_id=""
close_stale_given=0
mode_given=0

open_bin="${OPEN_BIN:-/usr/bin/open}"
pbcopy_bin="${PBCOPY_BIN:-pbcopy}"
pbpaste_bin="${PBPASTE_BIN:-pbpaste}"
desktop_seam="${OPENCODE_DESKTOP_SEAM:-}"

fail() {
  print -u2 -- "OpenCode launcher: $1"
  exit ${2:-1}
}

usage() {
  print -- "Usage: ${0:t} [--mode build|fix|review] [--from RUN_ID] [--dry-run] [--terminal] [--manual-paste] [plan.md|--text \"...\"|--clipboard]"
  print -- "       ${0:t} --status"
  print -- "       ${0:t} --close-stale RUN_ID"
  print -- "Default Desktop delivery copies a compact instruction to the clipboard,"
  print -- "opens opencode://new-session with the repository directory only, then pastes"
  print -- "once via accessibility automation. If automation is unavailable it prints"
  print -- "OpenCode is ready; press Cmd+V, then Enter and exits 3 (recoverable)."
  print -- "Use --manual-paste to skip automation. Use --terminal for the synchronous fallback."
  print -- "Double-click with no arguments to choose: Build plan, Fix run, Review run, Clipboard."
}

urlencode() {
  /usr/bin/osascript -l JavaScript -e \
    'function run(argv) { return encodeURIComponent(argv[0]); }' -- "$1"
}

json_escape() {
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\t'/\\t}
  print -rn -- "$s"
}

resolve_opencode_bin() {
  if [[ -n "${OPENCODE_BIN:-}" ]]; then
    print -- "${OPENCODE_BIN}"
    return 0
  fi
  local found=""
  if found=$(command -v opencode 2>/dev/null); then
    [[ -n "$found" ]] && { print -- "$found"; return 0; }
  fi
  print -- "$opencode_fallback"
}

verify_configured_model() {
  local bin="$1"
  local out=""
  if [[ -z "$bin" || ! -x "$bin" ]]; then
    print -- "unverified"
    return 0
  fi
  if out=$("$bin" debug config 2>/dev/null); then
    if [[ "$out" == *"$model"* && "$out" == *"$variant"* ]]; then
      print -- "verified"
      return 0
    fi
  fi
  print -- "unverified"
}

capture_state_to() {
  local dest="$1"
  local tmp=$(mktemp "${dest:h}/.state.XXXXXX")
  {
    print -- "HEAD: $(git -C "$repo_dir" rev-parse HEAD 2>&1)"
    print -- ""
    print -- "## git status --porcelain=v1"
    git -C "$repo_dir" status --porcelain=v1 2>&1 || print -- "git status failed"
    print -- ""
    print -- "## file hashes (git hash-object where available)"
    git -C "$repo_dir" status --porcelain=v1 2>/dev/null | while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      local rel=${line[4,-1]}
      case "$rel" in
        *" -> "*) rel=${rel##* -> } ;;
      esac
      case "$rel" in
        '"'*'"') rel=${rel[2,-2]} ;;
      esac
      [[ -n "$rel" ]] || continue
      local full="$repo_dir/$rel"
      if [[ -f "$full" ]]; then
        local h=$(git -C "$repo_dir" hash-object -- "$full" 2>/dev/null || shasum -a 1 "$full" 2>/dev/null | /usr/bin/awk '{print $1}')
        print -- "$h  $rel"
      else
        print -- "missing  $rel"
      fi
    done
  } > "$tmp"
  mv -f "$tmp" "$dest"
}

# ---------------- CLI ----------------
while (( $# > 0 )); do
  case "$1" in
    --dry-run)
      (( dry_run == 0 )) || fail "--dry-run may be given at most once."
      dry_run=1
      shift
      ;;
    --terminal)
      (( terminal_given == 0 )) || fail "--terminal may be given at most once."
      terminal_given=1
      [[ "$launch_mode" == "desktop" ]] || fail "--terminal may be given at most once."
      launch_mode="terminal"
      shift
      ;;
    --manual-paste)
      (( manual_paste == 0 )) || fail "--manual-paste may be given at most once."
      manual_paste=1
      shift
      ;;
    --mode)
      (( mode_given == 0 )) || fail "--mode may be given at most once."
      mode_given=1
      shift
      (( $# > 0 )) || fail "--mode requires build|fix|review."
      case "$1" in
        build|fix|review) run_mode="$1" ;;
        *) fail "Unknown --mode: $1 (use build|fix|review)." ;;
      esac
      shift
      ;;
    --from)
      [[ -z "$from_run" ]] || fail "--from may be given at most once."
      shift
      (( $# > 0 )) || fail "--from requires a RUN_ID."
      from_run="$1"
      shift
      ;;
    --text)
      [[ -z "$input_mode" ]] || fail "Choose exactly one implementation plan input."
      input_mode="text"
      shift
      (( $# > 0 )) || fail "--text requires a non-empty plan argument."
      plan_text="$1"
      shift
      ;;
    --clipboard)
      [[ -z "$input_mode" ]] || fail "Choose exactly one implementation plan input."
      input_mode="clipboard"
      shift
      ;;
    --status)
      status_only=1
      shift
      ;;
    --close-stale)
      (( close_stale_given == 0 )) || fail "--close-stale may be given at most once."
      close_stale_given=1
      shift
      (( $# > 0 )) || fail "--close-stale requires a RUN_ID."
      close_stale_id="$1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      fail "Unknown option: $1"
      ;;
    *)
      [[ -z "$input_mode" ]] || fail "Choose exactly one implementation plan input."
      input_mode="file"
      plan_path="$1"
      shift
      ;;
  esac
done

# --status / --close-stale are exclusive
if (( status_only == 1 || close_stale_given == 1 )); then
  (( dry_run == 0 )) || fail "--dry-run cannot be combined with --status or --close-stale."
  (( manual_paste == 0 )) || fail "--manual-paste cannot be combined with --status or --close-stale."
  (( terminal_given == 0 )) || fail "--terminal cannot be combined with --status or --close-stale."
  (( mode_given == 0 )) || fail "--mode cannot be combined with --status or --close-stale."
  [[ -z "$from_run" ]] || fail "--from cannot be combined with --status or --close-stale."
  [[ -z "$input_mode" ]] || fail "No plan input may be combined with --status or --close-stale."
  if (( status_only == 1 && close_stale_given == 1 )); then
    fail "--status and --close-stale are mutually exclusive."
  fi
  if (( status_only == 1 )); then
    if [[ -f "$active_file" ]]; then
      active_id=$(<"$active_file")
      if [[ -d "$runs_dir/$active_id" && -f "$runs_dir/$active_id/metadata.json" ]]; then
        meta_mode=$(grep -o '"mode": *"[^"]*"' "$runs_dir/$active_id/metadata.json" 2>/dev/null | head -1 || print -- "")
        print -- "active_run=$active_id"
        [[ -n "$meta_mode" ]] && print -- "$meta_mode"
        print -- "request_path=.scratch/opencode-runs/$active_id/request.md"
        print -- "run_dir=.scratch/opencode-runs/$active_id"
        print -- "To finalize: scripts/finalize-opencode-run.sh $active_id"
        print -- "To release after interruption: ${0:t} --close-stale $active_id"
      else
        print -- "active_run=$active_id"
        print -- "run_dir=.scratch/opencode-runs/$active_id (metadata missing)"
      fi
    else
      print -- "no active run"
    fi
    exit 0
  fi
  # --close-stale
  case "$close_stale_id" in
    ""|*"/"*|*" "*) fail "Invalid RUN_ID for --close-stale." ;;
  esac
  case "$close_stale_id" in
    *$'\n'*|*$'\t'*) fail "Invalid RUN_ID for --close-stale." ;;
  esac
  [[ -f "$active_file" ]] || fail "No active run to close."
  active_id=$(<"$active_file")
  [[ "$active_id" == "$close_stale_id" ]] || fail "Active run is $active_id, not $close_stale_id."
  [[ -d "$runs_dir/$close_stale_id" ]] || fail "Run directory does not exist: .scratch/opencode-runs/$close_stale_id"
  rm -f "$active_file" || fail "Could not release the active run."
  print -- "closed stale run $close_stale_id"
  print -- "Run directory preserved: .scratch/opencode-runs/$close_stale_id"
  print -- "No code was reverted or deleted."
  exit 0
fi

(( manual_paste == 0 )) || [[ "$launch_mode" == "desktop" ]] || fail "--manual-paste requires Desktop mode (it is incompatible with --terminal)."

[[ -d "$plans_dir" ]] || fail "Plans directory does not exist: $plans_dir"

# Interactive chooser when no explicit input (never in dry-run)
if [[ -z "$input_mode" && -z "$from_run" && "$run_mode" == "build" ]]; then
  (( dry_run == 0 )) || fail "Dry run requires an explicit file or text plan."
  if ! selection=$(osascript - "$plans_dir" "$runs_dir" <<'APPLESCRIPT'
on run arguments
  set plansFolder to POSIX file (item 1 of arguments)
  set runsRoot to item 2 of arguments
  set choices to {"Build from Markdown plan", "Fix a completed run", "Review a completed run", "Use clipboard text"}
  set selectedChoice to choose from list choices with title "Run plan in OpenCode" with prompt "Choose the coding run to start" default items {"Build from Markdown plan"}
  if selectedChoice is false then error number -128
  set picked to item 1 of selectedChoice
  if picked is "Use clipboard text" then
    return "clipboard:build"
  end if
  if picked is "Build from Markdown plan" then
    set chosenPlan to choose file with prompt "Choose the Codex implementation plan for OpenCode" default location plansFolder of type {"net.daringfireball.markdown", "public.plain-text"}
    return "file:build:" & (POSIX path of chosenPlan)
  end if
  -- Fix / Review: list runs that contain a handoff
  tell application "System Events"
    if not (exists folder runsRoot) then return "error:no-runs"
    set runNames to name of every folder of folder runsRoot
  end tell
  if (count of runNames) is 0 then return "error:no-runs"
  if picked is "Fix a completed run" then
    set chosenRun to choose from list runNames with title "Fix a completed run" with prompt "Choose the prior run to fix"
    if chosenRun is false then error number -128
    set runId to item 1 of chosenRun
    set findingChoices to {"Findings from Markdown file", "Findings from clipboard"}
    set findingPick to choose from list findingChoices with title "Fix findings" with prompt "How are the Codex findings provided" default items {"Findings from Markdown file"}
    if findingPick is false then error number -128
    if item 1 of findingPick is "Findings from clipboard" then
      return "clipboard:fix:" & runId
    else
      set findingsFile to choose file with prompt "Choose the findings plan for the fix" default location plansFolder of type {"net.daringfireball.markdown", "public.plain-text"}
      return "file:fix:" & runId & ":" & (POSIX path of findingsFile)
    end if
  else
    set chosenRun to choose from list runNames with title "Review a completed run" with prompt "Choose the prior run to review"
    if chosenRun is false then error number -128
    return "review:" & (item 1 of chosenRun)
  end if
end run
APPLESCRIPT
  ); then
    fail "No plan was selected."
  fi
  case "$selection" in
    clipboard:build)
      input_mode="clipboard"
      run_mode="build"
      ;;
    file:build:*)
      input_mode="file"
      run_mode="build"
      plan_path=${selection#file:build:}
      ;;
    clipboard:fix:*)
      input_mode="clipboard"
      run_mode="fix"
      from_run=${selection#clipboard:fix:}
      ;;
    file:fix:*)
      rest=${selection#file:fix:}
      # rest is RUN_ID:POSIX_PATH (POSIX path starts with /)
      from_run=${rest%%:/*}
      plan_path="/${rest#*:}"
      # Above split: RUN_ID:/abs/path -> from RUN_ID, path /abs/path
      # Correct when path contains colons? Plans paths do not contain colons.
      if [[ "$rest" == *":/"* ]]; then
        from_run=${rest%%:*}
        plan_path=${rest#*:}
      fi
      input_mode="file"
      run_mode="fix"
      ;;
    review:*)
      run_mode="review"
      from_run=${selection#review:}
      ;;
    error:no-runs)
      fail "No completed runs with handoffs are available."
      ;;
    *)
      fail "No plan was selected."
      ;;
  esac
fi

# Validate mode/from/input combinations
case "$run_mode" in
  build)
    [[ -z "$from_run" ]] || fail "--from requires --mode fix or --mode review."
    [[ -n "$input_mode" ]] || fail "Choose exactly one implementation plan input."
    ;;
  fix)
    [[ -n "$from_run" ]] || fail "--mode fix requires --from RUN_ID."
    [[ -n "$input_mode" ]] || fail "--mode fix requires findings via file, --text, or --clipboard."
    ;;
  review)
    [[ -n "$from_run" ]] || fail "--mode review requires --from RUN_ID."
    [[ -z "$input_mode" ]] || fail "--mode review takes no plan input; it inspects --from RUN_ID."
    [[ -z "$plan_text" && -z "$plan_path" ]] || fail "--mode review takes no plan input."
    ;;
esac

# Resolve inputs (read-only; safe for dry-run)
source_label=""
relative_plan=""
findings_text=""
prior_handoff_body=""
prior_source_plan=""
if [[ "$run_mode" == "review" ]]; then
  [[ -d "$runs_dir/$from_run" ]] || fail "Prior run does not exist: .scratch/opencode-runs/$from_run"
  [[ -f "$runs_dir/$from_run/handoff.md" ]] || fail "Prior run has no handoff: .scratch/opencode-runs/$from_run/handoff.md"
  prior_handoff_body=$(<"$runs_dir/$from_run/handoff.md")
  if [[ -f "$runs_dir/$from_run/metadata.json" ]]; then
    prior_source_plan=$(grep -o '"source_plan": *"[^"]*"' "$runs_dir/$from_run/metadata.json" 2>/dev/null | head -1 || print -- "")
  fi
  source_label="review:$from_run"
elif [[ "$input_mode" == "file" ]]; then
  [[ -f "$plan_path" ]] || fail "Plan file does not exist: $plan_path"
  plan_path=${plan_path:A}
  case "$plan_path" in
    "$plans_dir"/*.md) ;;
    *) fail "Choose a Markdown plan from $plans_dir" ;;
  esac
  relative_plan=${plan_path#"$repo_dir"/}
  if [[ "$run_mode" == "fix" ]]; then
    [[ -d "$runs_dir/$from_run" ]] || fail "Prior run does not exist: .scratch/opencode-runs/$from_run"
    [[ -f "$runs_dir/$from_run/handoff.md" ]] || fail "Prior run has no handoff for fix context."
    prior_handoff_body=$(<"$runs_dir/$from_run/handoff.md")
    findings_text=$(<"$plan_path")
    [[ -n "${findings_text//[[:space:]]/}" ]] || fail "Findings file must contain at least one non-empty character."
    source_label="file:$relative_plan"
  else
    source_label="file:$relative_plan"
  fi
elif [[ "$input_mode" == "text" ]]; then
  [[ -n "${plan_text//[[:space:]]/}" ]] || fail "Plan text must contain at least one non-empty character."
  if [[ "$run_mode" == "fix" ]]; then
    [[ -d "$runs_dir/$from_run" ]] || fail "Prior run does not exist: .scratch/opencode-runs/$from_run"
    [[ -f "$runs_dir/$from_run/handoff.md" ]] || fail "Prior run has no handoff for fix context."
    prior_handoff_body=$(<"$runs_dir/$from_run/handoff.md")
    findings_text="$plan_text"
    source_label="inline-text"
  else
    source_label="inline-text"
  fi
elif [[ "$input_mode" == "clipboard" ]]; then
  [[ -x "$pbpaste_bin" || "$pbpaste_bin" == "pbpaste" ]] || fail "Could not read the clipboard."
  if ! plan_text=$("$pbpaste_bin"); then
    fail "Could not read the implementation plan from the clipboard."
  fi
  [[ -n "${plan_text//[[:space:]]/}" ]] || fail "Plan text must contain at least one non-empty character."
  if [[ "$run_mode" == "fix" ]]; then
    [[ -d "$runs_dir/$from_run" ]] || fail "Prior run does not exist: .scratch/opencode-runs/$from_run"
    [[ -f "$runs_dir/$from_run/handoff.md" ]] || fail "Prior run has no handoff for fix context."
    prior_handoff_body=$(<"$runs_dir/$from_run/handoff.md")
    findings_text="$plan_text"
    source_label="clipboard"
  else
    source_label="clipboard"
  fi
else
  fail "Choose exactly one implementation plan input."
fi

# Resolve CLI + verification (read-only; safe for dry-run)
opencode_resolved=$(resolve_opencode_bin)
model_verification=$(verify_configured_model "$opencode_resolved")

# Build directory-only deep link target (no prompt, no plan, no secrets)
encoded_directory=$(urlencode "$repo_dir") || fail "Could not encode the repository path."
[[ -n "$encoded_directory" ]] || fail "Could not encode the repository path."
directory_url="opencode://new-session?directory=$encoded_directory"

# ---------------- Dry-run (side-effect-free) ----------------
if (( dry_run == 1 )); then
  print -- "mode=$launch_mode"
  print -- "model=$model"
  print -- "variant=$variant"
  print -- "project=$repo_dir"
  print -- "source=$source_label"
  if [[ -n "$relative_plan" ]]; then
    print -- "plan=$relative_plan"
  fi
  print -- "run_mode=$run_mode"
  if [[ -n "$from_run" ]]; then
    print -- "prior_run=$from_run"
  else
    print -- "prior_run=none"
  fi
  print -- "model_verification=$model_verification"
  print -- "desktop_url=$directory_url"
  print -- "dry_run=yes"
  exit 0
fi

# ---------------- Real launch: create run + lock ----------------
mkdir -p "$runs_dir" || fail "Could not create the runs directory."
timestamp=$(date +%Y%m%d-%H%M%S)
rand_suffix=$(hexdump -n 2 -e '"%02x"' /dev/urandom 2>/dev/null || print -- "$RANDOM")
run_id="$timestamp-$rand_suffix"

# Atomic lock: fail if another run is active (no run dir created yet on contention)
if ! (setopt noclobber; print -- "$run_id" > "$active_file") 2>/dev/null; then
  active_id=$(<"$active_file" 2>/dev/null || print -- "unknown")
  print -u2 -- "OpenCode launcher: Another run is active: $active_id."
  print -u2 -- "Inspect it with: ${0:t} --status"
  print -u2 -- "Finalize it with: scripts/finalize-opencode-run.sh $active_id"
  print -u2 -- "Or release an interrupted Desktop run with: ${0:t} --close-stale $active_id"
  exit 1
fi

run_dir="$runs_dir/$run_id"
run_request_rel=".scratch/opencode-runs/$run_id/request.md"
run_compact_rel=".scratch/opencode-runs/$run_id/compact.txt"
cleanup_new_run() {
  rm -rf "$run_dir"
  if [[ -f "$active_file" ]]; then
    cur=$(<"$active_file" 2>/dev/null || print -- "")
    [[ "$cur" == "$run_id" ]] && rm -f "$active_file"
  fi
}

mkdir -p "$run_dir" || { cleanup_new_run; fail "Could not create the run directory."; }
head_rev=$(git -C "$repo_dir" rev-parse HEAD 2>/dev/null || print -- "unknown")
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if [[ -n "$from_run" ]]; then
  prior_json="\"$from_run\""
else
  prior_json="null"
fi
if [[ -n "$relative_plan" ]]; then
  plan_json="\"$(json_escape "$relative_plan")\""
else
  plan_json="null"
fi
tmp_meta=$(mktemp "$run_dir/.metadata.XXXXXX")
{
  print -- "{"
  print -- "  \"schema_version\": 1,"
  print -- "  \"run_id\": \"$run_id\","
  print -- "  \"mode\": \"$run_mode\","
  print -- "  \"created_at\": \"$created_at\","
  print -- "  \"source\": \"$(json_escape "$source_label")\","
  print -- "  \"source_plan\": $plan_json,"
  print -- "  \"requested_model\": \"$model\","
  print -- "  \"requested_variant\": \"$variant\","
  print -- "  \"configured_model_status\": \"$model_verification\","
  print -- "  \"repo_path\": \"$(json_escape "$repo_dir")\","
  print -- "  \"head\": \"$head_rev\","
  print -- "  \"prior_run_id\": $prior_json"
  print -- "}"
} > "$tmp_meta"
mv -f "$tmp_meta" "$run_dir/metadata.json"

capture_state_to "$run_dir/baseline.txt"

# ---------------- Full instruction (local file only; never URL/args/output) ----------------
safety_block="Preserve all unrelated existing and untracked user changes. Do not make git commits; leave the verified diff for human review. Do not stage, commit, reset, clean, or revert anything. Follow the plan's safety and compliance boundaries, run every feasible verification check, and update prototype/game-ui/42-subject-compliance.md whenever AGENTS.md requires it. Stop and ask the user before any new product decision, sensitive permission, destructive action, or scope expansion."
handoff_contract="Before completion, write a compact Markdown handoff to .scratch/opencode-runs/$run_id/handoff.md. Keep it under about 120 lines; never include a full transcript or secrets. Include these clearly labelled items:
- Status
- Input source or plan (this run: $source_label)
- Model and variant actually used (the launcher requested $model with variant $variant; configured default verification: $model_verification). Verify the actual selection from this session. If the session fell back or the model or variant was manually switched, record the actual selection; if it cannot be verified, say that it is unverified and do not claim Muse.
- Changed files
- Exact tests and results
- Decisions or deviations
- Blockers or remaining risks
- Suggested reviewer scope
Then finalize with: scripts/finalize-opencode-run.sh $run_id (use --status blocked|failed when appropriate)."

full_instruction=""
case "$run_mode" in
  build)
    if [[ "$input_mode" == "file" ]]; then
      full_instruction="Run ID: $run_id
Mode: build
Repository: $repo_dir
Request: $run_request_rel

Read AGENTS.md and the implementation plan at $relative_plan in full, then execute it completely in this repository. Edits and tests are allowed; commits and staging remain prohibited.

$safety_block

Do not stop after summarizing the plan. Finish with changed files, exact test results, remaining risks, and decisions still needed.

$handoff_contract"
    else
      if [[ "$run_mode" == "build" && "$input_mode" == "clipboard" ]]; then
        plan_body="$plan_text"
      else
        plan_body="$plan_text"
      fi
      full_instruction="Run ID: $run_id
Mode: build
Repository: $repo_dir
Request: $run_request_rel

Read AGENTS.md in full, then execute the implementation plan pasted below completely in this repository. Edits and tests are allowed; commits and staging remain prohibited.

--- BEGIN IMPLEMENTATION PLAN ---
$plan_body
--- END IMPLEMENTATION PLAN ---

$safety_block

Do not stop after summarizing the plan. Finish with changed files, exact test results, remaining risks, and decisions still needed.

$handoff_contract"
    fi
    ;;
  fix)
    full_instruction="Run ID: $run_id
Mode: fix
Prior run: $from_run
Repository: $repo_dir
Request: $run_request_rel

This is a follow-up fix session. Start fresh (no prior transcript); read AGENTS.md in full, then read the prior run context below. Change only what resolves the supplied Codex findings; do not broaden scope, do not touch unrelated files, and do not commit or stage.

--- PRIOR HANDOFF (.scratch/opencode-runs/$from_run/handoff.md) ---
$prior_handoff_body
--- END PRIOR HANDOFF ---

Read the prior request at .scratch/opencode-runs/$from_run/request.md and the current baseline at .scratch/opencode-runs/$run_id/baseline.txt.

--- CURRENT CODEX FINDINGS (fix-only scope) ---
$findings_text
--- END FINDINGS ---

$safety_block

Finish with changed files, exact test results, remaining risks, and decisions still needed.

$handoff_contract"
    ;;
  review)
    full_instruction="Run ID: $run_id
Mode: review
Prior run: $from_run
Repository: $repo_dir
Request: $run_request_rel

This is a read-only review session. Make no repository edits, stage nothing, commit nothing. Inspect the prior run against its plan and record findings in this run's handoff.

--- PRIOR HANDOFF (.scratch/opencode-runs/$from_run/handoff.md) ---
$prior_handoff_body
--- END PRIOR HANDOFF ---

Read the prior request at .scratch/opencode-runs/$from_run/request.md, the baseline at .scratch/opencode-runs/$from_run/baseline.txt (or .scratch/opencode-runs/$run_id/baseline.txt for current state), and the final state if present. Compare the actual diff (git status/diff) against the plan.

$safety_block

Explicitly prohibit writes and commits in your summary. Write findings to .scratch/opencode-runs/$run_id/handoff.md with the required sections, then finalize.

$handoff_contract"
    ;;
esac

tmp_req=$(mktemp "$run_dir/.request.XXXXXX")
print -- "$full_instruction" > "$tmp_req"
mv -f "$tmp_req" "$run_dir/request.md"

compact_instruction="OpenCode run $run_id ($run_mode). Read AGENTS.md and $run_request_rel in full, then execute it in $repo_dir. When finished, write the handoff to .scratch/opencode-runs/$run_id/handoff.md and run: scripts/finalize-opencode-run.sh $run_id"
tmp_compact=$(mktemp "$run_dir/.compact.XXXXXX")
print -- "$compact_instruction" > "$tmp_compact"
mv -f "$tmp_compact" "$run_dir/compact.txt"
compact_file="$run_dir/compact.txt"

# ---------------- Terminal fallback (fully synchronous) ----------------
if [[ "$launch_mode" == "terminal" ]]; then
  if [[ ! -x "$opencode_resolved" ]]; then
    cleanup_new_run
    fail "OpenCode is not installed at $opencode_resolved"
  fi
  if pgrep -f '[o]pencode run' >/dev/null 2>&1; then
    cleanup_new_run
    fail "Another 'opencode run' process is active. Stop it before opening a new interactive session."
  fi
  cd "$repo_dir"
  if "$opencode_resolved" run --interactive --model "$model" --variant "$variant" "$compact_instruction"; then
    run_status=0
  else
    run_status=$?
  fi
  if [[ ! -f "$run_dir/handoff.md" ]]; then
    print -- "run_id=$run_id"
    print -- "run_mode=$run_mode"
    print -- "request_path=$run_request_rel"
    if (( run_status == 0 )); then
      print -- "OpenCode launcher: required handoff missing: .scratch/opencode-runs/$run_id/handoff.md. OpenCode exited successfully but did not write the required handoff."
      print -- "OpenCode handoff missing: .scratch/opencode-runs/$run_id/handoff.md"
      print -- "To finalize after writing the handoff: scripts/finalize-opencode-run.sh $run_id"
      print -- "To release after interruption: ${0:t} --close-stale $run_id"
      exit 2
    else
      print -- "OpenCode handoff missing: .scratch/opencode-runs/$run_id/handoff.md"
      print -- "OpenCode exited with status $run_status. Review the terminal output before retrying."
      print -- "To release after interruption: ${0:t} --close-stale $run_id"
      exit $run_status
    fi
  fi
  if ! "$finalizer_script" "$run_id" >/dev/null 2>&1; then
    print -- "run_id=$run_id"
    print -- "run_mode=$run_mode"
    print -- "request_path=$run_request_rel"
    print -- "OpenCode launcher: finalization failed for run $run_id. Inspect .scratch/opencode-runs/$run_id/handoff.md, then retry finalization."
    print -- "OpenCode exited with status 2. Review the terminal output before retrying."
    exit 2
  fi
  print -- "run_id=$run_id"
  print -- "run_mode=$run_mode"
  print -- "request_path=$run_request_rel"
  print -- "OpenCode handoff written: .scratch/opencode-runs/$run_id/handoff.md"
  print -- "OpenCode finished successfully. Review the uncommitted changes in Codex."
  exit 0
fi

# ---------------- Desktop delivery (corrected) ----------------
[[ -x "$open_bin" ]] || { cleanup_new_run; fail "Could not open OpenCode Desktop with $open_bin"; }
# Never delete the compatibility handoff at launch; the finalizer updates it only after success.

if ! print -- "$compact_instruction" | "$pbcopy_bin"; then
  # Clipboard failed before any external open; clean up the just-created run.
  cleanup_new_run
  fail "Could not copy the compact instruction to the clipboard."
fi

if ! "$open_bin" "$directory_url"; then
  print -- "run_id=$run_id"
  print -- "run_mode=$run_mode"
  print -- "request_path=$run_request_rel"
  print -- "OpenCode is ready; press Cmd+V, then Enter"
  print -u2 -- "OpenCode launcher: Could not open OpenCode Desktop. Launch Services rejected the URL."
  print -- "Run $run_id prepared at $run_request_rel. The compact instruction is on the clipboard."
  print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
  print -- "To release after interruption: ${0:t} --close-stale $run_id"
  exit 3
fi

if (( manual_paste == 1 )); then
  print -- "run_id=$run_id"
  print -- "run_mode=$run_mode"
  print -- "request_path=$run_request_rel"
  print -- "desktop_url=$directory_url"
  print -- "OpenCode is ready; press Cmd+V, then Enter"
  print -- "Run $run_id prepared at $run_request_rel. The compact instruction is on the clipboard."
  print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
  print -- "To release after interruption: ${0:t} --close-stale $run_id"
  exit 3
fi

if [[ -n "$desktop_seam" ]]; then
  if "$desktop_seam" "$compact_file"; then
    seam_status=0
  else
    seam_status=$?
  fi
  if (( seam_status == 0 )); then
    print -- "run_id=$run_id"
    print -- "run_mode=$run_mode"
    print -- "request_path=$run_request_rel"
    print -- "desktop_url=$directory_url"
    print -- "OpenCode session started for run $run_id ($run_mode)."
    print -- "Watch OpenCode Desktop. When it finishes, return to Codex and say finished."
    print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
    exit 0
  else
    print -- "run_id=$run_id"
    print -- "run_mode=$run_mode"
    print -- "request_path=$run_request_rel"
    print -- "desktop_url=$directory_url"
    print -- "OpenCode is ready; press Cmd+V, then Enter"
    print -- "Run $run_id prepared at $run_request_rel. The compact instruction is on the clipboard."
    print -- "Accessibility automation reported status $seam_status; no keystrokes were sent to another app."
    print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
    print -- "To release after interruption: ${0:t} --close-stale $run_id"
    exit 3
  fi
fi

# Real macOS automation: bounded 10s readiness polling, frontmost verification, single paste+Enter.
frontmost_is_opencode() {
  local front=""
  front=$(/usr/bin/osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null) || return 1
  [[ "$front" == "OpenCode" ]]
}

# Poll up to 10s with short checks (0.2s x 50)
polled=0
i=0
while (( i < 50 )); do
  if frontmost_is_opencode 2>/dev/null; then
    polled=1
    break
  fi
  sleep 0.2
  i=$(( i + 1 ))
done

if (( polled == 0 )); then
  print -- "run_id=$run_id"
  print -- "run_mode=$run_mode"
  print -- "request_path=$run_request_rel"
  print -- "desktop_url=$directory_url"
  print -- "OpenCode is ready; press Cmd+V, then Enter"
  print -- "Run $run_id prepared at $run_request_rel. The compact instruction is on the clipboard."
  print -- "OpenCode was not frontmost within 10s; no keystrokes were sent."
  print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
  print -- "To release after interruption: ${0:t} --close-stale $run_id"
  exit 3
fi

# Verify frontmost immediately before sending keystrokes; never type into another app.
if ! frontmost_is_opencode 2>/dev/null; then
  print -- "run_id=$run_id"
  print -- "run_mode=$run_mode"
  print -- "request_path=$run_request_rel"
  print -- "desktop_url=$directory_url"
  print -- "OpenCode is ready; press Cmd+V, then Enter"
  print -- "Run $run_id prepared at $run_request_rel. The compact instruction is on the clipboard."
  print -- "Frontmost check failed before paste; no keystrokes were sent."
  print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
  print -- "To release after interruption: ${0:t} --close-stale $run_id"
  exit 3
fi

if ! /usr/bin/osascript -e 'tell application "System Events" to keystroke "v" using command down' 2>/dev/null; then
  print -- "run_id=$run_id"
  print -- "run_mode=$run_mode"
  print -- "request_path=$run_request_rel"
  print -- "desktop_url=$directory_url"
  print -- "OpenCode is ready; press Cmd+V, then Enter"
  print -- "Run $run_id prepared at $run_request_rel. The compact instruction is on the clipboard."
  print -- "Accessibility paste unavailable (check System Settings > Privacy & Security > Accessibility); no submission was attempted."
  print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
  print -- "To release after interruption: ${0:t} --close-stale $run_id"
  exit 3
fi

# Re-verify before Enter: exactly one Enter, only into OpenCode.
if ! frontmost_is_opencode 2>/dev/null; then
  print -- "run_id=$run_id"
  print -- "run_mode=$run_mode"
  print -- "request_path=$run_request_rel"
  print -- "desktop_url=$directory_url"
  print -- "OpenCode is ready; press Cmd+V, then Enter"
  print -- "Run $run_id prepared at $run_request_rel. The prompt was pasted but Enter was not pressed."
  print -- "Press Enter once in OpenCode, or press Cmd+V then Enter if the prompt is missing."
  print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
  print -- "To release after interruption: ${0:t} --close-stale $run_id"
  exit 3
fi

if ! /usr/bin/osascript -e 'tell application "System Events" to key code 36' 2>/dev/null; then
  print -- "run_id=$run_id"
  print -- "run_mode=$run_mode"
  print -- "request_path=$run_request_rel"
  print -- "desktop_url=$directory_url"
  print -- "OpenCode is ready; press Cmd+V, then Enter"
  print -- "Run $run_id prepared at $run_request_rel. The prompt was pasted but Enter was not confirmed."
  print -- "Press Enter once in OpenCode."
  print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
  print -- "To release after interruption: ${0:t} --close-stale $run_id"
  exit 3
fi

print -- "run_id=$run_id"
print -- "run_mode=$run_mode"
print -- "request_path=$run_request_rel"
print -- "desktop_url=$directory_url"
print -- "OpenCode session started for run $run_id ($run_mode)."
print -- "Watch OpenCode Desktop. When it finishes, return to Codex and say finished."
print -- "To finalize: scripts/finalize-opencode-run.sh $run_id"
