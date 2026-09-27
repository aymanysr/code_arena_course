#!/bin/zsh
# Finalize an OpenCode durable run: validate handoff, capture final state,
# write result metadata, update compatibility handoff, release the lock.
# Never modifies, stages, commits, or reverts product files (read-only git).

set -eu

script_dir=${0:A:h}
repo_dir=${script_dir:h}
runs_dir="$repo_dir/.scratch/opencode-runs"
active_file="$runs_dir/active"
handoff_rel=".scratch/opencode-handoffs/latest.md"
handoff_path="$repo_dir/$handoff_rel"

fail() {
  print -u2 -- "OpenCode finalizer: $1"
  exit ${2:-1}
}

usage() {
  print -- "Usage: ${0:t} RUN_ID [--status completed|blocked|failed]"
}

run_id=""
final_status="completed"
while (( $# > 0 )); do
  case "$1" in
    --status)
      shift
      (( $# > 0 )) || fail "Missing value for --status." 1
      case "$1" in
        completed|blocked|failed) final_status="$1" ;;
        *) fail "Invalid --status: $1 (use completed|blocked|failed)." 1 ;;
      esac
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      fail "Unknown option: $1" 1
      ;;
    *)
      [[ -z "$run_id" ]] || fail "Too many arguments." 1
      run_id="$1"
      shift
      ;;
  esac
done

[[ -n "$run_id" ]] || { usage >&2; fail "RUN_ID is required." 1; }
case "$run_id" in
  *"/"*|*" "*|"."|"..")
    fail "Invalid RUN_ID." 1
    ;;
esac
case "$run_id" in
  *$'\n'*|*$'\t'*)
    fail "Invalid RUN_ID." 1
    ;;
esac

run_dir="$runs_dir/$run_id"
[[ -d "$run_dir" ]] || fail "Run directory does not exist: .scratch/opencode-runs/$run_id" 1
handoff_file="$run_dir/handoff.md"
result_file="$run_dir/result.json"
final_state_file="$run_dir/final-state.txt"

# Active lock must still name this run; otherwise do not touch latest.md.
[[ -f "$active_file" ]] || fail "No active run. Expected active run $run_id." 1
active_id=$(<"$active_file")
[[ "$active_id" == "$run_id" ]] || fail "Active run is $active_id, not $run_id. Use --status/--close-stale to inspect." 1

# Validate handoff without releasing the lock or overwriting latest.md on failure.
[[ -f "$handoff_file" ]] || fail "Required handoff missing: .scratch/opencode-runs/$run_id/handoff.md. Write the handoff, then retry." 2
[[ -s "$handoff_file" ]] || fail "Required handoff is empty: .scratch/opencode-runs/$run_id/handoff.md." 2
handoff_body=$(<"$handoff_file")
for required in "Status" "Input source or plan" "Model and variant actually used" "Changed files" "Exact tests and results" "Decisions or deviations" "Blockers or remaining risks" "Suggested reviewer scope"; do
  [[ "$handoff_body" == *"$required"* ]] || fail "Handoff is missing required section: $required." 2
done
if [[ "$handoff_body" != *"unverified"* && "$handoff_body" != *"muse-spark"* && "$handoff_body" != *"xhigh"* ]]; then
  fail "Handoff must record the actual model/variant or say unverified." 2
fi

# Capture final read-only git state (same format as launcher baseline).
tmp_state=$(mktemp "$run_dir/.final-state.XXXXXX")
{
  print -- "run_id: $run_id"
  print -- "captured_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  print -- ""
  print -- "HEAD: $(git -C "$repo_dir" rev-parse HEAD 2>&1)"
  print -- ""
  print -- "## git status --porcelain=v1"
  git -C "$repo_dir" status --porcelain=v1 2>&1 || print -- "git status failed"
  print -- ""
  print -- "## file hashes (git hash-object where available)"
  git -C "$repo_dir" status --porcelain=v1 2>/dev/null | while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    rel=${line[4,-1]}
    case "$rel" in
      *" -> "*) rel=${rel##* -> } ;;
    esac
    # Strip surrounding quotes if git quoted the path
    case "$rel" in
      '"'*'"') rel=${rel[2,-2]} ;;
    esac
    [[ -n "$rel" ]] || continue
    full="$repo_dir/$rel"
    if [[ -f "$full" ]]; then
      hash=$(git -C "$repo_dir" hash-object -- "$full" 2>/dev/null || shasum -a 1 "$full" 2>/dev/null | /usr/bin/awk '{print $1}')
      print -- "$hash  $rel"
    else
      print -- "missing  $rel"
    fi
  done
} > "$tmp_state"
mv -f "$tmp_state" "$final_state_file"

# Write structured result atomically.
head_rev=$(git -C "$repo_dir" rev-parse HEAD 2>/dev/null || print -- "unknown")
finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
tmp_result=$(mktemp "$run_dir/.result.XXXXXX")
{
  print -- "{"
  print -- "  \"schema_version\": 1,"
  print -- "  \"run_id\": \"$run_id\","
  print -- "  \"status\": \"$final_status\","
  print -- "  \"finished_at\": \"$finished_at\","
  print -- "  \"head\": \"$head_rev\""
  print -- "}"
} > "$tmp_result"
mv -f "$tmp_result" "$result_file"

# Update the backward-compatible handoff atomically only after success.
mkdir -p "$handoff_path:h"
tmp_latest=$(mktemp "${handoff_path:h}/.latest.XXXXXX")
cp -p "$handoff_file" "$tmp_latest"
mv -f "$tmp_latest" "$handoff_path"

# Release the lock only if it still names this run.
if [[ -f "$active_file" ]]; then
  current=$(<"$active_file")
  if [[ "$current" == "$run_id" ]]; then
    rm -f "$active_file"
  else
    fail "Active run changed during finalization (now $current)." 1
  fi
fi

print -- "OpenCode run $run_id finalized ($final_status)."
print -- "Compatibility handoff updated: $handoff_rel"
