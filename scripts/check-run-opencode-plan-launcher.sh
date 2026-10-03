#!/bin/zsh

set -eu

script_dir=${0:A:h}
repo_dir=${script_dir:h}
launcher="$repo_dir/Run plan in OpenCode.command"
finalizer="$repo_dir/scripts/finalize-opencode-run.sh"
runs_dir="$repo_dir/.scratch/opencode-runs"
active_file="$runs_dir/active"
handoff_rel=".scratch/opencode-handoffs/latest.md"
handoff_path="$repo_dir/$handoff_rel"
expected_model="opencode/muse-spark-1.3-contributor-free"
expected_variant="xhigh"
sentinel="LAUNCHER_SECRET_SENTINEL_9f8b7a6e"

fail() {
  print -u2 -- "FAIL: $1"
  exit 1
}

[[ -x "$launcher" ]] || fail "launcher must exist and be executable"
[[ -x "$finalizer" ]] || fail "finalizer must exist and be executable"

# --- Preserve pre-existing state ---
handoff_backup=""
if [[ -f "$handoff_path" ]]; then
  handoff_backup=$(mktemp /private/tmp/handoff-backup.XXXXXX.md)
  cp -p "$handoff_path" "$handoff_backup"
fi
active_backup=""
if [[ -f "$active_file" ]]; then
  active_backup=$(mktemp /private/tmp/active-backup.XXXXXX)
  cp -p "$active_file" "$active_backup"
fi
runs_before_file=$(mktemp /private/tmp/runs-before.XXXXXX)
if [[ -d "$runs_dir" ]]; then
  ls -1 "$runs_dir" 2>/dev/null > "$runs_before_file" || true
else
  print -n "" > "$runs_before_file"
fi
status_before=$(git -C "$repo_dir" status --porcelain=v1 2>&1 || true)
status_before_file=$(mktemp /private/tmp/status-before.XXXXXX)
print -- "$status_before" > "$status_before_file"

fake_dir=$(mktemp -d /private/tmp/fake-runner.XXXXXX)
fixture="$repo_dir/docs/superpowers/plans/launcher-durable-fixture.md"
fixture_spaces="$repo_dir/docs/superpowers/plans/launcher fixture with spaces.md"
large_fixture="$repo_dir/docs/superpowers/plans/launcher-durable-large-fixture.md"
marker_pre="$repo_dir/docs/superpowers/plans/.launcher-test-pre-dirty.tmp"
marker_new=""

test_runs_created=""
cleanup_all() {
  rm -rf "$fake_dir"
  rm -f "$fixture" "$fixture_spaces" "$large_fixture" "$marker_pre"
  if [[ -n "$marker_new" && -f "$marker_new" ]]; then
    rm -f "$marker_new"
  fi
  # Remove test runs created during this check (those not in runs_before)
  if [[ -d "$runs_dir" ]]; then
    for entry in "$runs_dir"/*(N); do
      base=${entry:t}
      [[ "$base" == "active" ]] && continue
      if ! grep -qxF "$base" "$runs_before_file" 2>/dev/null; then
        rm -rf "$entry"
      fi
    done
  fi
  # Restore active lock
  if [[ -n "$active_backup" ]]; then
    mkdir -p "$runs_dir"
    cp -p "$active_backup" "$active_file"
    rm -f "$active_backup"
  else
    # If test left an active file that did not exist before, remove it only if it belongs to a test run still present; otherwise keep? Tests must leave no active lock unless one existed before.
    if [[ -f "$active_file" ]]; then
      active_id=$(<"$active_file" 2>/dev/null || print -- "")
      if [[ -n "$active_id" ]] && ! grep -qxF "$active_id" "$runs_before_file" 2>/dev/null; then
        rm -f "$active_file"
      fi
    fi
  fi
  # Restore handoff
  if [[ -n "$handoff_backup" ]]; then
    mkdir -p "$handoff_path:h"
    cp -p "$handoff_backup" "$handoff_path"
    rm -f "$handoff_backup"
  else
    # Only remove handoff if it was created by tests (did not exist before)
    if [[ -f "$handoff_path" ]]; then
      rm -f "$handoff_path"
    fi
  fi
  rm -f "$runs_before_file" "$status_before_file"
}
trap cleanup_all EXIT

# --- Dedicated fixtures (generated and removed by tests) ---
print -- "# Durable launcher fixture" > "$fixture"
print -- "Implement the widget announcer with focused tests." >> "$fixture"
print -- "$sentinel short marker must never leak to URL or output." >> "$fixture"

print -- "# Fixture with spaces" > "$fixture_spaces"
print -- "Path with spaces must keep working." >> "$fixture_spaces"

# Large fixture (~120KB) with sentinel near the end
{
  print -- "# Large durable fixture"
  i=0
  while (( i < 2500 )); do
    print -- "Filler line $i lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod."
    i=$(( i + 1 ))
  done
  print -- "Tail $sentinel large-sentinel must never leak."
} > "$large_fixture"

# --- Fake seams ---
cat > "$fake_dir/fake-open" <<EOF
#!/bin/zsh
print -- "\$1" > "$fake_dir/open-arg"
print -- "\$#" > "$fake_dir/open-count"
exit 0
EOF
chmod +x "$fake_dir/fake-open"

cat > "$fake_dir/fake-pbcopy" <<EOF
#!/bin/zsh
cat > "$fake_dir/clipboard"
if [[ -f "$fake_dir/pbcopy-count" ]]; then
  n=\$(<"$fake_dir/pbcopy-count")
  print -- \$(( n + 1 )) > "$fake_dir/pbcopy-count"
else
  print -- 1 > "$fake_dir/pbcopy-count"
fi
exit 0
EOF
chmod +x "$fake_dir/fake-pbcopy"

cat > "$fake_dir/fake-paste-text" <<EOF
#!/bin/zsh
print -- "Clipboard plan body with $sentinel clipboard marker."
exit 0
EOF
chmod +x "$fake_dir/fake-paste-text"

make_seam() {
  local name="$1"
  local code="$2"
  cat > "$fake_dir/$name" <<EOF
#!/bin/zsh
print -- "\$1" > "$fake_dir/$name-arg"
if [[ -f "$fake_dir/$name-count" ]]; then
  n=\$(<"$fake_dir/$name-count")
  print -- \$(( n + 1 )) > "$fake_dir/$name-count"
else
  print -- 1 > "$fake_dir/$name-count"
fi
$code
EOF
  chmod +x "$fake_dir/$name"
}

# Success seam: records compact file, marks submitted
make_seam "fake-seam-ok" "touch \"$fake_dir/submitted\"; exit 0"
# Failure seams: never submit
make_seam "fake-seam-wrong" 'exit 10'
make_seam "fake-seam-noperm" 'exit 11'
make_seam "fake-seam-nocontrol" 'exit 12'

# Fake opencode that reports correct config for verification
cat > "$fake_dir/fake-opencode-good" <<EOF
#!/bin/zsh
if [[ "\$1" == "debug" && "\$2" == "config" ]]; then
  print -- '{"model":"$expected_model","agent":{"build":{"model":"$expected_model","variant":"$expected_variant"}}}'
  exit 0
fi
print -- "\$*" > "$fake_dir/opencode-args"
print -- "\$#" > "$fake_dir/opencode-count"
exit 0
EOF
chmod +x "$fake_dir/fake-opencode-good"

# Fake opencode that fails verification
cat > "$fake_dir/fake-opencode-badconfig" <<EOF
#!/bin/zsh
if [[ "\$1" == "debug" && "\$2" == "config" ]]; then
  print -- '{"model":"other/model"}'
  exit 0
fi
print -- "\$*" > "$fake_dir/opencode-args"
exit 0
EOF
chmod +x "$fake_dir/fake-opencode-badconfig"

# Fake opencode that fails debug config entirely
cat > "$fake_dir/fake-opencode-noconfig" <<EOF
#!/bin/zsh
if [[ "\$1" == "debug" && "\$2" == "config" ]]; then
  exit 1
fi
print -- "\$*" > "$fake_dir/opencode-args"
exit 0
EOF
chmod +x "$fake_dir/fake-opencode-noconfig"

write_valid_handoff() {
  local run_dir="$1"
  cat > "$run_dir/handoff.md" <<HANDOFF
# Run handoff
- Status: completed
- Input source or plan: test
- Model and variant actually used: $expected_model with variant $expected_variant (verified in test)
- Changed files: none (launcher test)
- Exact tests and results: scripts/check-run-opencode-plan-launcher.sh PASS in test
- Decisions or deviations: none
- Blockers or remaining risks: none
- Suggested reviewer scope: launcher infrastructure only
HANDOFF
}

extract_run_id() {
  local output="$1"
  local id=""
  for line in ${(f)output}; do
    case "$line" in
      run_id=*)
        id=${line#run_id=}
        ;;
    esac
  done
  print -- "$id"
}

reset_desktop_captures() {
  rm -f "$fake_dir/open-arg" "$fake_dir/open-count" "$fake_dir/clipboard" "$fake_dir/pbcopy-count" "$fake_dir/submitted"
  rm -f "$fake_dir/fake-seam-ok-arg" "$fake_dir/fake-seam-ok-count"
  rm -f "$fake_dir/fake-seam-wrong-arg" "$fake_dir/fake-seam-wrong-count"
  rm -f "$fake_dir/fake-seam-noperm-arg" "$fake_dir/fake-seam-noperm-count"
  rm -f "$fake_dir/fake-seam-nocontrol-arg" "$fake_dir/fake-seam-nocontrol-count"
}

# ============================================================
# 1. Dry-run is side-effect-free and never leaks plan/sentinel
# ============================================================
runs_count_before=$(ls -1 "$runs_dir" 2>/dev/null | wc -l | tr -d ' ')
dry_output=$("$launcher" --dry-run "$fixture") || fail "fixture dry run must succeed"
[[ "$dry_output" == *"mode=desktop"* ]] || fail "dry run must default to mode=desktop"
[[ "$dry_output" == *"model=$expected_model"* ]] || fail "dry run must pin Muse model"
[[ "$dry_output" == *"variant=$expected_variant"* ]] || fail "dry run must pin xhigh"
[[ "$dry_output" == *"project=$repo_dir"* ]] || fail "dry run must target repo root"
[[ "$dry_output" == *"source=file:docs/superpowers/plans/launcher-durable-fixture.md"* ]] || fail "dry run must identify dedicated fixture source"
[[ "$dry_output" == *"run_mode=build"* ]] || fail "dry run must default to run_mode=build"
[[ "$dry_output" == *"desktop_url=opencode://new-session?directory="* ]] || fail "dry run must print directory-only desktop URL"
[[ "$dry_output" == *"&prompt="* ]] && fail "dry run URL must never carry prompt query"
[[ "$dry_output" == *"$sentinel"* ]] && fail "dry run output must never contain secret sentinel"
[[ "$dry_output" == *"Implement the widget announcer"* ]] && fail "dry run output must never contain full plan text"
runs_count_after=$(ls -1 "$runs_dir" 2>/dev/null | wc -l | tr -d ' ')
[[ "$runs_count_before" == "$runs_count_after" ]] || fail "--dry-run must not create run directories"
[[ ! -f "$active_file" || -n "$active_backup" ]] || fail "--dry-run must not create an active lock when none existed"
# handoff must be untouched by dry-run
if [[ -n "$handoff_backup" ]]; then
  cmp -s "$handoff_path" "$handoff_backup" || fail "--dry-run must not modify the compatibility handoff"
else
  [[ ! -f "$handoff_path" ]] || fail "--dry-run must not create a compatibility handoff"
fi

# Dry-run with direct text (short sensitive) must not leak
text_dry=$("$launcher" --dry-run --text "Fix the announcer $sentinel short") || fail "text dry run must succeed"
[[ "$text_dry" == *"source=inline-text"* ]] || fail "text dry run must identify inline-text source"
[[ "$text_dry" == *"$sentinel"* ]] && fail "text dry run must never echo sentinel"
[[ "$text_dry" == *"Fix the announcer"* ]] && fail "text dry run must never echo full text"

# Dry-run with clipboard (fake paste) must not leak
clip_dry=$(PBCOPY_BIN="$fake_dir/fake-pbcopy" PBPASTE_BIN="$fake_dir/fake-paste-text" OPEN_BIN="$fake_dir/fake-open" "$launcher" --dry-run --clipboard) || fail "clipboard dry run must succeed"
[[ "$clip_dry" == *"source=clipboard"* ]] || fail "clipboard dry run must identify clipboard source"
[[ "$clip_dry" == *"$sentinel"* ]] && fail "clipboard dry run must never echo sentinel"

# Dry-run with spaces path must work
spaces_dry=$("$launcher" --dry-run "$fixture_spaces") || fail "spaces path dry run must succeed"
[[ "$spaces_dry" == *"launcher fixture with spaces.md"* ]] || fail "spaces dry run must name the fixture"

# Dry-run with terminal mode
term_dry=$("$launcher" --dry-run --terminal --text "Behavioral probe") || fail "terminal dry run must succeed"
[[ "$term_dry" == *"mode=terminal"* ]] || fail "terminal dry run must report mode=terminal"

# ============================================================
# 2. Default automated Desktop delivery uses seam once, directory-only URL, clipboard compact
# ============================================================
reset_desktop_captures
print -- "# prior compatibility handoff must survive launch" > "$handoff_path"
prior_handoff_content=$(<"$handoff_path")
desktop_output=""
if desktop_output=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" OPENCODE_BIN="$fake_dir/fake-opencode-good" "$launcher" --mode build "$fixture" 2>&1); then
  desktop_status=0
else
  desktop_status=$?
fi
(( desktop_status == 0 )) || fail "desktop automated launch must succeed (got $desktop_status: $desktop_output)"
[[ -f "$fake_dir/open-arg" ]] || fail "fake open must capture the desktop URL"
[[ "$(<"$fake_dir/open-count")" == "1" ]] || fail "desktop must open exactly one URL"
captured_url=$(<"$fake_dir/open-arg")
[[ "$captured_url" == "opencode://new-session?directory="* ]] || fail "captured URL must be directory-only new-session"
[[ "$captured_url" == *"&prompt="* ]] && fail "captured URL must never carry prompt="
[[ "$captured_url" == *"$sentinel"* ]] && fail "captured URL must never contain sentinel"
case "$captured_url" in
  *" "*|*$'\n'*|*$'\t'*|$'*\n'*)
    fail "captured URL must contain no literal spaces or newlines"
    ;;
esac
[[ "$captured_url" == *"%20"* || "$captured_url" != *" "* ]] || fail "directory URL must be encoded"
[[ -f "$fake_dir/clipboard" ]] || fail "compact instruction must be copied to clipboard"
clipboard_body=$(<"$fake_dir/clipboard")
[[ "$clipboard_body" == *"Request:"* || "$clipboard_body" == *"request"* ]] || fail "clipboard compact must reference the request path"
[[ "$clipboard_body" == *"finalize"* ]] || fail "clipboard compact must contain the finalize command"
[[ "$clipboard_body" == *"$sentinel"* ]] && fail "clipboard compact must never contain sentinel"
[[ "$clipboard_body" == *"Implement the widget announcer"* ]] && fail "clipboard compact must never contain full plan"
[[ "$desktop_output" == *"$sentinel"* ]] && fail "desktop output must never contain sentinel"
[[ "$desktop_output" == *"Implement the widget announcer"* ]] && fail "desktop output must never contain full plan"
[[ "$desktop_output" == *"$clipboard_body"* ]] && fail "desktop output must not print the compact instruction"
[[ -f "$fake_dir/fake-seam-ok-arg" ]] || fail "desktop seam must be invoked"
[[ "$(<"$fake_dir/fake-seam-ok-count")" == "1" ]] || fail "desktop seam must be called exactly once"
[[ -f "$fake_dir/submitted" ]] || fail "success seam must mark submitted"
[[ "$desktop_output" == *"OpenCode finished successfully"* ]] && fail "desktop launch must not claim finished"
run_id=$(extract_run_id "$desktop_output")
[[ -n "$run_id" ]] || fail "desktop output must include run_id="
run_dir="$runs_dir/$run_id"
[[ -d "$run_dir" ]] || fail "run directory must exist: $run_id"
[[ -f "$run_dir/request.md" ]] || fail "request.md must exist"
[[ -f "$run_dir/metadata.json" ]] || fail "metadata.json must exist"
[[ -f "$run_dir/baseline.txt" ]] || fail "baseline.txt must exist"
[[ -f "$run_dir/compact.txt" ]] || fail "compact.txt must exist for recovery"
request_body=$(<"$run_dir/request.md")
[[ "$request_body" == *"Read AGENTS.md"* ]] || fail "build request must require AGENTS.md"
[[ "$request_body" == *"Do not make git commits"* || "$request_body" == *"Do not commit"* || "$request_body" == *"commits"* ]] || fail "build request must prohibit commits"
[[ "$request_body" == *"implement"* ]] || fail "build request must instruct implementation"
[[ "$request_body" == *"launcher-durable-fixture.md"* ]] || fail "build file request must reference the fixture plan"
# latest.md must NOT be deleted at launch; must be preserved until finalization
[[ -f "$handoff_path" ]] || fail "prior compatibility handoff must survive Desktop launch"
[[ "$(<"$handoff_path")" == "$prior_handoff_content" ]] || fail "prior handoff must be byte-identical after launch"
# metadata checks
metadata_body=$(<"$run_dir/metadata.json")
[[ "$metadata_body" == *"$run_id"* ]] || fail "metadata must record run ID"
[[ "$metadata_body" == *'"mode"'* || "$metadata_body" == *'"build"'* || "$metadata_body" == *"build"* ]] || fail "metadata must record build mode"
[[ "$metadata_body" == *"$expected_model"* ]] || fail "metadata must record requested model"
[[ "$metadata_body" == *"$expected_variant"* ]] || fail "metadata must record requested variant"
[[ "$metadata_body" == *"configured_model_status"* || "$metadata_body" == *"unverified"* || "$metadata_body" == *"verified"* ]] || fail "metadata must record verification status without false claims"
[[ "$desktop_output" == *"do not claim Muse"* || "$request_body" == *"do not claim Muse"* || "$request_body" == *"unverified"* ]] || fail "request must warn against unverified Muse claims"
# active lock must be held
[[ -f "$active_file" ]] || fail "active lock must exist after launch"
[[ "$(<"$active_file")" == "$run_id" ]] || fail "active lock must contain the new run ID"
first_run_id="$run_id"
first_run_dir="$run_dir"

# ============================================================
# 3. Large plan does not materially enlarge the deep link
# ============================================================
reset_desktop_captures
# Need to free the lock first via finalizer so large-plan launch can proceed; use valid handoff
write_valid_handoff "$first_run_dir"
if ! finalize_out=$("$finalizer" "$first_run_id" 2>&1); then
  fail "finalizer must succeed for first run before large-plan test (got: $finalize_out)"
fi
[[ ! -f "$active_file" ]] || fail "finalizer must release the lock"
[[ -f "$handoff_path" ]] || fail "finalizer alone must update latest.md"
reset_desktop_captures
large_output=""
if large_output=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" OPENCODE_BIN="$fake_dir/fake-opencode-good" "$launcher" --mode build "$large_fixture" 2>&1); then
  large_status=0
else
  large_status=$?
fi
(( large_status == 0 )) || fail "large plan launch must succeed"
large_url=$(<"$fake_dir/open-arg")
[[ "$large_url" == *"$sentinel"* ]] && fail "large URL must never contain sentinel"
[[ "$large_output" == *"$sentinel"* ]] && fail "large output must never contain sentinel"
len_small=${#captured_url}
len_large=${#large_url}
diff_len=$(( len_large > len_small ? len_large - len_small : len_small - len_large ))
(( diff_len < 1500 )) || fail "large plan must not materially enlarge deep link (small=$len_small large=$len_large diff=$diff_len)"
large_run_id=$(extract_run_id "$large_output")
[[ -n "$large_run_id" ]] || fail "large output must include run_id"
large_run_dir="$runs_dir/$large_run_id"
# Keep large run active for lock tests below

# ============================================================
# 4. Only one active run can exist; second launch rejected
# ============================================================
if second_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode build "$fixture" 2>&1); then
  fail "second concurrent launch must be rejected"
else
  second_status=$?
fi
(( second_status != 0 )) || fail "second launch must exit nonzero"
[[ "$second_out" == *"$large_run_id"* ]] || fail "rejection must name the active run ID"
[[ "$second_out" == *"--close-stale"* || "$second_out" == *"--status"* ]] || fail "rejection must give recovery instructions"

# --status must report the active run
status_out=$("$launcher" --status) || fail "--status must succeed"
[[ "$status_out" == *"$large_run_id"* ]] || fail "--status must show the active run"

# Finalize large run to permit next tests
write_valid_handoff "$large_run_dir"
finalize_large_out=$("$finalizer" "$large_run_id" 2>&1) || fail "large run finalization must succeed: $finalize_large_out"
[[ ! -f "$active_file" ]] || fail "lock must be released after finalization"

# ============================================================
# 5. Stale run blocks until explicitly closed; close-stale never touches code
# ============================================================
reset_desktop_captures
stale_out=""
if stale_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode build "$fixture" 2>&1); then
  stale_status=0
else
  stale_status=$?
fi
(( stale_status == 0 )) || fail "stale-setup launch must succeed"
stale_run_id=$(extract_run_id "$stale_out")
[[ -n "$stale_run_id" ]] || fail "stale setup must yield run_id"
status_before_close=$(git -C "$repo_dir" status --porcelain=v1 -- prototype/game-ui scripts 2>&1 || true)
# Wrong ID must fail
if wrong_out=$("$launcher" --close-stale "does-not-exist-1234" 2>&1); then
  fail "--close-stale with wrong ID must fail"
fi
[[ -f "$active_file" ]] || fail "wrong close-stale must preserve the active lock"
# Correct close-stale releases without touching code
close_out=$("$launcher" --close-stale "$stale_run_id" 2>&1) || fail "--close-stale with correct ID must succeed: $close_out"
[[ ! -f "$active_file" ]] || fail "--close-stale must release the lock"
[[ -d "$runs_dir/$stale_run_id" ]] || fail "--close-stale must preserve the run directory"
status_after_close=$(git -C "$repo_dir" status --porcelain=v1 -- prototype/game-ui scripts 2>&1 || true)
[[ "$status_before_close" == "$status_after_close" ]] || fail "--close-stale must never revert or delete code"
# Next run permitted after close
reset_desktop_captures
after_close_out=""
if after_close_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode build "$fixture" 2>&1); then
  after_close_status=0
else
  after_close_status=$?
fi
(( after_close_status == 0 )) || fail "launch after close-stale must succeed"
after_close_id=$(extract_run_id "$after_close_out")
[[ -n "$after_close_id" ]] || fail "post-close launch must yield run_id"
after_close_dir="$runs_dir/$after_close_id"
write_valid_handoff "$after_close_dir"
"$finalizer" "$after_close_id" >/dev/null 2>&1 || fail "post-close finalization must succeed"

# ============================================================
# 6. Build/Fix/Review generate distinct guarded prompts; fix includes prior handoff; review prohibits writes
# ============================================================
# Create a completed prior run to fix/review
reset_desktop_captures
prior_out=""
if prior_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode build "$fixture" 2>&1); then
  prior_status=0
else
  prior_status=$?
fi
(( prior_status == 0 )) || fail "prior build for fix/review must succeed"
prior_id=$(extract_run_id "$prior_out")
prior_dir="$runs_dir/$prior_id"
write_valid_handoff "$prior_dir"
"$finalizer" "$prior_id" >/dev/null 2>&1 || fail "prior finalization must succeed"

# Fix mode with text findings containing sentinel
reset_desktop_captures
fix_out=""
if fix_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode fix --from "$prior_id" --text "Reviewer found announcer gap $sentinel fix-only" 2>&1); then
  fix_status=0
else
  fix_status=$?
fi
(( fix_status == 0 )) || fail "fix launch must succeed: $fix_out"
fix_id=$(extract_run_id "$fix_out")
[[ -n "$fix_id" ]] || fail "fix output must include run_id"
fix_dir="$runs_dir/$fix_id"
[[ -f "$fix_dir/request.md" ]] || fail "fix request must exist"
fix_req=$(<"$fix_dir/request.md")
[[ "$fix_req" == *"change only"* || "$fix_req" == *"only what resolves"* ]] || fail "fix request must limit scope to findings"
[[ "$fix_req" == *"$prior_id"* ]] || fail "fix request must reference the prior run"
[[ "$fix_req" == *"Status:"* || "$fix_req" == *"Model and variant actually used"* ]] || fail "fix request must include the prior handoff context"
[[ "$fix_req" == *"announcer gap"* ]] || fail "fix request must embed the supplied findings locally"
fix_clip=$(<"$fake_dir/clipboard")
[[ "$fix_clip" == *"$sentinel"* ]] && fail "fix clipboard compact must never contain findings sentinel"
fix_url=$(<"$fake_dir/open-arg")
[[ "$fix_url" == *"$sentinel"* ]] && fail "fix URL must never contain sentinel"
[[ "$fix_out" == *"$sentinel"* ]] && fail "fix output must never contain sentinel"
# Fresh session: fix run must differ from prior
[[ "$fix_id" != "$prior_id" ]] || fail "fix must start a fresh session with a new run ID"
write_valid_handoff "$fix_dir"
"$finalizer" "$fix_id" >/dev/null 2>&1 || fail "fix finalization must succeed"

# Review mode (read-only)
reset_desktop_captures
review_out=""
if review_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode review --from "$prior_id" 2>&1); then
  review_status=0
else
  review_status=$?
fi
(( review_status == 0 )) || fail "review launch must succeed: $review_out"
review_id=$(extract_run_id "$review_out")
review_dir="$runs_dir/$review_id"
review_req=$(<"$review_dir/request.md")
[[ "$review_req" == *"make no"* || "$review_req" == *"no repository edits"* || "$review_req" == *"prohibit"* ]] || fail "review request must explicitly prohibit writes"
[[ "$review_req" == *"commit"* ]] || fail "review request must prohibit commits"
review_clip=$(<"$fake_dir/clipboard")
[[ "$review_clip" == *"$sentinel"* ]] && fail "review clipboard must never contain sentinel"
write_valid_handoff "$review_dir"
"$finalizer" "$review_id" >/dev/null 2>&1 || fail "review finalization must succeed"

# Build request distinct from fix/review
reset_desktop_captures
build_out=""
if build_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode build --text "Build the announcer widget" 2>&1); then
  build_status=0
else
  build_status=$?
fi
(( build_status == 0 )) || fail "build text launch must succeed"
build_id=$(extract_run_id "$build_out")
build_dir="$runs_dir/$build_id"
build_req=$(<"$build_dir/request.md")
[[ "$build_req" == *"implement"* ]] || fail "build request must instruct implementation"
[[ "$build_req" != *"$prior_id"* ]] || fail "build request must not reference a prior run"
write_valid_handoff "$build_dir"
"$finalizer" "$build_id" >/dev/null 2>&1 || fail "build finalization must succeed"

# Fix without --from must fail; review with text must fail; build with --from must fail
if "$launcher" --dry-run --mode fix --text "x" >/dev/null 2>&1; then
  fail "fix without --from must be rejected"
fi
if "$launcher" --dry-run --mode review --from "$prior_id" --text "x" >/dev/null 2>&1; then
  fail "review with --text must be rejected"
fi
if "$launcher" --dry-run --mode build --from "$prior_id" --text "x" >/dev/null 2>&1; then
  fail "build with --from must be rejected"
fi
if "$launcher" --dry-run --mode review --from "missing-run-xyz" >/dev/null 2>&1; then
  fail "review with missing prior run must be rejected"
fi

# ============================================================
# 7. Baseline distinguishes pre-existing dirty files
# ============================================================
print -- "pre-existing dirty marker" > "$marker_pre"
reset_desktop_captures
base_out=""
if base_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode build "$fixture" 2>&1); then
  base_status=0
else
  base_status=$?
fi
(( base_status == 0 )) || fail "baseline launch must succeed"
base_id=$(extract_run_id "$base_out")
base_dir="$runs_dir/$base_id"
[[ -f "$base_dir/baseline.txt" ]] || fail "baseline must exist"
[[ "$(<"$base_dir/baseline.txt")" == *".launcher-test-pre-dirty.tmp"* ]] || fail "baseline must list the pre-existing dirty file"
marker_new="$repo_dir/docs/superpowers/plans/.launcher-test-new-after.tmp"
print -- "new file simulating OpenCode work" > "$marker_new"
new_hash=$(git -C "$repo_dir" hash-object -- "$marker_new" 2>/dev/null || shasum -a 1 "$marker_new" | awk '{print $1}')
[[ -n "$new_hash" ]] || fail "could not hash the new file"
# Baseline must not yet contain the new file
[[ "$(<"$base_dir/baseline.txt")" != *".launcher-test-new-after.tmp"* ]] || fail "baseline must not contain files created after launch"
write_valid_handoff "$base_dir"
"$finalizer" "$base_id" >/dev/null 2>&1 || fail "baseline run finalization must succeed"
[[ -f "$base_dir/final-state.txt" ]] || fail "final-state must exist after finalization"
[[ "$(<"$base_dir/final-state.txt")" == *".launcher-test-new-after.tmp"* ]] || fail "final-state must list the newly changed file"
rm -f "$marker_new"
marker_new=""
rm -f "$marker_pre"

# ============================================================
# 8. Missing/malformed handoffs fail finalization without releasing lock or overwriting latest
# ============================================================
reset_desktop_captures
bad_out=""
if bad_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode build "$fixture" 2>&1); then
  bad_status=0
else
  bad_status=$?
fi
(( bad_status == 0 )) || fail "bad-handoff setup launch must succeed"
bad_id=$(extract_run_id "$bad_out")
bad_dir="$runs_dir/$bad_id"
print -- "# known good compatibility handoff" > "$handoff_path"
good_latest=$(<"$handoff_path")
# Missing handoff must fail
if missing_fin_out=$("$finalizer" "$bad_id" 2>&1); then
  fail "finalizer with missing handoff must fail"
fi
[[ -f "$active_file" ]] || fail "missing handoff must preserve the active lock"
[[ "$(<"$active_file")" == "$bad_id" ]] || fail "active lock must still name the bad run"
[[ "$(<"$handoff_path")" == "$good_latest" ]] || fail "missing handoff must not overwrite latest.md"
# Malformed handoff must fail
print -- "# incomplete" > "$bad_dir/handoff.md"
print -- "no required sections here" >> "$bad_dir/handoff.md"
if malformed_out=$("$finalizer" "$bad_id" 2>&1); then
  fail "finalizer with malformed handoff must fail"
fi
[[ -f "$active_file" ]] || fail "malformed handoff must preserve the active lock"
[[ "$(<"$handoff_path")" == "$good_latest" ]] || fail "malformed handoff must not overwrite latest.md"
# Valid handoff then succeeds and updates latest
write_valid_handoff "$bad_dir"
"$finalizer" "$bad_id" >/dev/null 2>&1 || fail "valid finalization after bad attempts must succeed"
[[ ! -f "$active_file" ]] || fail "valid finalization must release the lock"
[[ "$(<"$handoff_path")" != "$good_latest" ]] || fail "valid finalization must update latest.md"
[[ -f "$bad_dir/result.json" ]] || fail "result.json must exist after finalization"
[[ "$(<"$bad_dir/result.json")" == *"$bad_id"* ]] || fail "result.json must record the run ID"

# ============================================================
# 9. Desktop failure modes never submit; manual-paste never claims start
# ============================================================
for seam in fake-seam-wrong fake-seam-noperm fake-seam-nocontrol; do
  reset_desktop_captures
  print -- "# prior for $seam" > "$handoff_path"
  seam_prior=$(<"$handoff_path")
  fail_out=""
  if fail_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/$seam" "$launcher" --mode build "$fixture" 2>&1); then
    fail "$seam must exit nonzero"
  else
    seam_status=$?
  fi
  (( seam_status == 3 )) || fail "$seam must exit with distinct status 3 (got $seam_status: $fail_out)"
  [[ "$fail_out" == *"OpenCode is ready; press Cmd+V, then Enter"* ]] || fail "$seam must print the manual recovery line"
  [[ "$fail_out" == *"OpenCode finished successfully"* ]] && fail "$seam failure must never claim finished"
  [[ "$fail_out" == *"session started"* ]] && fail "$seam failure must never claim start"
  [[ -f "$fake_dir/clipboard" ]] || fail "$seam failure must leave the compact instruction on the clipboard"
  [[ "$(<"$fake_dir/clipboard")" == *"finalize"* ]] || fail "fallback clipboard must contain the finalize command"
  [[ -f "$fake_dir/open-arg" ]] || fail "$seam failure must still open the directory URL"
  [[ "$(<"$fake_dir/open-arg")" == *"&prompt="* ]] && fail "fallback URL must stay directory-only"
  [[ -f "$fake_dir/submitted" ]] && fail "$seam failure must never submit"
  [[ -f "$active_file" ]] || fail "$seam failure must preserve the active run record"
  fail_run_id=$(extract_run_id "$fail_out")
  [[ -n "$fail_run_id" ]] || fail "failure output must include run_id for recovery"
  [[ "$(<"$handoff_path")" == "$seam_prior" ]] || fail "failed delivery must preserve the prior compatibility handoff"
  [[ "$fail_out" == *"$fail_run_id"* ]] || fail "failure output must name the recoverable run"
  [[ "$fail_out" == *"--close-stale $fail_run_id"* || "$fail_out" == *"--close-stale"* ]] || fail "failure output must document --close-stale recovery"
  # Clean up via close-stale for next iteration
  "$launcher" --close-stale "$fail_run_id" >/dev/null 2>&1 || fail "close-stale after $seam must succeed"
done

# --manual-paste skips automation
reset_desktop_captures
print -- "# prior for manual" > "$handoff_path"
manual_prior=$(<"$handoff_path")
manual_out=""
if manual_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" "$launcher" --manual-paste --mode build "$fixture" 2>&1); then
  fail "--manual-paste must exit nonzero (recoverable)"
else
  manual_status=$?
fi
(( manual_status == 3 )) || fail "--manual-paste must exit 3 (got $manual_status)"
[[ "$manual_out" == *"OpenCode is ready; press Cmd+V, then Enter"* ]] || fail "--manual-paste must print the manual line"
[[ "$manual_out" == *"session started"* ]] && fail "--manual-paste must never claim start"
[[ -f "$fake_dir/clipboard" ]] || fail "--manual-paste must copy the compact instruction"
[[ "$(<"$fake_dir/open-arg")" == *"&prompt="* ]] && fail "--manual-paste URL must stay directory-only"
[[ -f "$active_file" ]] || fail "--manual-paste must keep the run recoverable"
manual_id=$(extract_run_id "$manual_out")
[[ -n "$manual_id" ]] || fail "--manual-paste must include run_id"
[[ "$(<"$handoff_path")" == "$manual_prior" ]] || fail "--manual-paste must preserve the prior handoff until finalization"
"$launcher" --close-stale "$manual_id" >/dev/null 2>&1 || fail "close-stale after manual-paste must succeed"

# ============================================================
# 10. Terminal fallback uses resolved CLI seam with compact only; validates handoff lifecycle
# ============================================================
# Terminal success: fake writes valid per-run handoff then exits 0; launcher finalizes
cat > "$fake_dir/fake-terminal-ok" <<EOF
#!/bin/zsh
if [[ "\$1" == "debug" && "\$2" == "config" ]]; then
  print -- '{"model":"$expected_model","agent":{"build":{"model":"$expected_model","variant":"$expected_variant"}}}'
  exit 0
fi
print -- "\$*" > "$fake_dir/terminal-args"
active=\$(<"$active_file")
print -- "compact-args: \$*" > "$fake_dir/terminal-compact-check"
if [[ "\$*" == *"$sentinel"* ]]; then
  print -- "SENTINEL-LEAK" > "$fake_dir/terminal-leak"
  exit 0
fi
run_dir="$runs_dir/\$active"
mkdir -p "\$run_dir"
cat > "\$run_dir/handoff.md" <<HANDOFF
# Run handoff
- Status: completed
- Input source or plan: terminal test
- Model and variant actually used: $expected_model with variant $expected_variant
- Changed files: none
- Exact tests and results: terminal probe PASS
- Decisions or deviations: none
- Blockers or remaining risks: none
- Suggested reviewer scope: launcher
HANDOFF
exit 0
EOF
chmod +x "$fake_dir/fake-terminal-ok"

reset_desktop_captures
term_ok_out=""
if term_ok_out=$(OPENCODE_BIN="$fake_dir/fake-terminal-ok" PBCOPY_BIN="$fake_dir/fake-pbcopy" "$launcher" --terminal --mode build --text "Terminal probe body" 2>&1); then
  term_ok_status=0
else
  term_ok_status=$?
fi
(( term_ok_status == 0 )) || fail "terminal success must exit 0 (got $term_ok_status: $term_ok_out)"
[[ "$term_ok_out" == *"OpenCode finished successfully"* ]] || fail "terminal success must announce completion"
[[ "$term_ok_out" == *"OpenCode handoff written"* ]] || fail "terminal success must report the written handoff"
[[ -f "$fake_dir/terminal-args" ]] || fail "terminal must invoke the resolved CLI"
[[ "$(<"$fake_dir/terminal-args")" == *"--model $expected_model"* || "$(<"$fake_dir/terminal-args")" == *"$expected_model"* ]] || fail "terminal must use the pinned model"
[[ "$(<"$fake_dir/terminal-args")" == *"$expected_variant"* ]] || fail "terminal must use xhigh"
[[ "$(<"$fake_dir/terminal-args")" == *"$sentinel"* ]] && fail "terminal process args must never contain sentinel"
[[ -f "$fake_dir/terminal-leak" ]] && fail "terminal must never pass full plan to process args"
[[ ! -f "$active_file" ]] || fail "terminal success must release the lock via finalizer"
[[ -f "$handoff_path" ]] || fail "terminal success must update latest.md"

# Terminal missing handoff after success must use status 2
cat > "$fake_dir/fake-terminal-missing-zero" <<EOF
#!/bin/zsh
if [[ "\$1" == "debug" && "\$2" == "config" ]]; then
  print -- '{"model":"$expected_model","agent":{"build":{"model":"$expected_model","variant":"$expected_variant"}}}'
  exit 0
fi
exit 0
EOF
chmod +x "$fake_dir/fake-terminal-missing-zero"
if miss0_out=$(OPENCODE_BIN="$fake_dir/fake-terminal-missing-zero" "$launcher" --terminal --text "Probe missing" 2>&1); then
  miss0_status=0
else
  miss0_status=$?
fi
(( miss0_status == 2 )) || fail "missing handoff after success must exit 2 (got $miss0_status: $miss0_out)"
[[ "$miss0_out" == *"OpenCode handoff missing"* ]] || fail "missing handoff must be reported"
[[ "$miss0_out" != *"OpenCode finished successfully"* ]] || fail "missing handoff must never claim success"
miss0_id=$(extract_run_id "$miss0_out")
[[ -n "$miss0_id" ]] || fail "missing-handoff output must include run_id"
[[ -f "$active_file" ]] || fail "missing handoff must preserve the lock"
"$launcher" --close-stale "$miss0_id" >/dev/null 2>&1 || fail "close after missing handoff must succeed"

# Terminal preserves original nonzero when handoff missing
cat > "$fake_dir/fake-terminal-missing-seven" <<EOF
#!/bin/zsh
if [[ "\$1" == "debug" && "\$2" == "config" ]]; then
  print -- '{"model":"$expected_model"}'
  exit 0
fi
exit 7
EOF
chmod +x "$fake_dir/fake-terminal-missing-seven"
if miss7_out=$(OPENCODE_BIN="$fake_dir/fake-terminal-missing-seven" "$launcher" --terminal --text "Probe fail" 2>&1); then
  miss7_status=0
else
  miss7_status=$?
fi
(( miss7_status == 7 )) || fail "failed run must preserve status 7 (got $miss7_status)"
[[ "$miss7_out" == *"exited with status 7"* ]] || fail "failed run must announce status 7"
miss7_id=$(extract_run_id "$miss7_out")
[[ -n "$miss7_id" ]] || fail "failed output must include run_id"
"$launcher" --close-stale "$miss7_id" >/dev/null 2>&1 || fail "close after failure must succeed"

# OPENCODE_BIN seam is preferred over PATH (observable, no source-text assertion)
cat > "$fake_dir/fake-terminal-marker-A" <<EOF
#!/bin/zsh
if [[ "\$1" == "debug" && "\$2" == "config" ]]; then
  print -- '{"model":"$expected_model"}'
  exit 0
fi
print -- "A" > "$fake_dir/which-used"
exit 7
EOF
chmod +x "$fake_dir/fake-terminal-marker-A"
cat > "$fake_dir/fake-terminal-marker-B" <<EOF
#!/bin/zsh
if [[ "\$1" == "debug" && "\$2" == "config" ]]; then
  print -- '{"model":"$expected_model"}'
  exit 0
fi
print -- "B" > "$fake_dir/which-used"
exit 7
EOF
chmod +x "$fake_dir/fake-terminal-marker-B"
rm -f "$fake_dir/which-used"
if PATH="$fake_dir:$PATH" OPENCODE_BIN="$fake_dir/fake-terminal-marker-A" "$launcher" --terminal --text "Which test" >/dev/null 2>&1; then
  :
else
  :
fi
[[ -f "$fake_dir/which-used" ]] || fail "terminal must invoke a CLI seam"
[[ "$(<"$fake_dir/which-used")" == "A" ]] || fail "OPENCODE_BIN must take precedence"
which_id_out=""
# Cleanup the run left active by the exit-7 probe above
if [[ -f "$active_file" ]]; then
  leftover=$(<"$active_file")
  "$launcher" --close-stale "$leftover" >/dev/null 2>&1 || fail "cleanup after which-test must succeed"
fi

# ============================================================
# 11. Model verification: verified when feasible, unverified otherwise, never false-claims
# ============================================================
reset_desktop_captures
verified_out=""
if verified_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" OPENCODE_BIN="$fake_dir/fake-opencode-good" "$launcher" --mode build "$fixture" 2>&1); then
  :
else
  fail "verified-config launch must succeed"
fi
verified_id=$(extract_run_id "$verified_out")
verified_meta=$(<"$runs_dir/$verified_id/metadata.json")
[[ "$verified_meta" == *"verified"* ]] || fail "good config must record verified status"
[[ "$verified_out" == *"verified Muse"* || "$verified_out" == *"confirmed Muse"* ]] && fail "output must not overclaim verified session selection"
write_valid_handoff "$runs_dir/$verified_id"
"$finalizer" "$verified_id" >/dev/null 2>&1 || fail "verified run finalization must succeed"

reset_desktop_captures
unverified_out=""
if unverified_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" OPENCODE_BIN="$fake_dir/fake-opencode-noconfig" "$launcher" --mode build "$fixture" 2>&1); then
  :
else
  fail "unverified-config launch must still succeed"
fi
unverified_id=$(extract_run_id "$unverified_out")
unverified_meta=$(<"$runs_dir/$unverified_id/metadata.json")
[[ "$unverified_meta" == *"unverified"* ]] || fail "failed verification must record unverified"
unverified_req=$(<"$runs_dir/$unverified_id/request.md")
[[ "$unverified_req" == *"unverified"* ]] || fail "request must instruct OpenCode to record unverified when appropriate"
write_valid_handoff "$runs_dir/$unverified_id"
"$finalizer" "$unverified_id" >/dev/null 2>&1 || fail "unverified run finalization must succeed"

# ============================================================
# 12. Input validation and safety (file/text/clipboard exclusivity, outside plan, unknown option)
# ============================================================
if "$launcher" --dry-run --bogus-option "$fixture" >/dev/null 2>&1; then
  fail "unknown option must be rejected"
fi
if "$launcher" --dry-run --terminal --terminal --text "x" >/dev/null 2>&1; then
  fail "duplicate --terminal must be rejected"
fi
if "$launcher" --dry-run --terminal >/dev/null 2>&1; then
  fail "--terminal without input must be rejected"
fi
if "$launcher" --dry-run --text "" >/dev/null 2>&1; then
  fail "empty text must be rejected"
fi
if "$launcher" --dry-run --text "a" "$fixture" >/dev/null 2>&1; then
  fail "text+file must be rejected"
fi
if PBPASTE_BIN="$fake_dir/fake-paste-text" "$launcher" --dry-run --clipboard --text "x" >/dev/null 2>&1; then
  fail "clipboard+text must be rejected"
fi
outside_plan=$(mktemp /private/tmp/opencode-plan-outside.XXXXXX.md)
print -- "# outside" > "$outside_plan"
if "$launcher" --dry-run "$outside_plan" >/dev/null 2>&1; then
  fail "outside plan must be rejected"
fi
rm -f "$outside_plan"
if "$launcher" --dry-run --terminal --manual-paste --text "x" >/dev/null 2>&1; then
  fail "--terminal with --manual-paste must be rejected"
fi
# Safety strings in a real request
reset_desktop_captures
safety_out=""
if safety_out=$(OPEN_BIN="$fake_dir/fake-open" PBCOPY_BIN="$fake_dir/fake-pbcopy" OPENCODE_DESKTOP_SEAM="$fake_dir/fake-seam-ok" "$launcher" --mode build "$fixture" 2>&1); then
  :
else
  fail "safety launch must succeed"
fi
safety_id=$(extract_run_id "$safety_out")
safety_req=$(<"$runs_dir/$safety_id/request.md")
for needle in "Read AGENTS.md" "Preserve all unrelated" "Do not make git commits" "42-subject-compliance" "Stop and ask the user"; do
  [[ "$safety_req" == *"$needle"* ]] || fail "request must preserve safety contract: $needle"
done
write_valid_handoff "$runs_dir/$safety_id"
"$finalizer" "$safety_id" >/dev/null 2>&1 || fail "safety run finalization must succeed"

# ============================================================
# 13. .gitignore narrow rule and worktree preservation
# ============================================================
# Remove dedicated fixtures now (trap also removes them on EXIT) so the
# worktree check proves they do not linger.
rm -f "$fixture" "$fixture_spaces" "$large_fixture"
[[ -f "$repo_dir/.gitignore" ]] || fail ".gitignore must exist with the narrow runs rule"
[[ "$(<"$repo_dir/.gitignore")" == *".scratch/opencode-runs/"* ]] || fail ".gitignore must ignore only .scratch/opencode-runs/"
# Existing scratch docs must not be ignored
if git -C "$repo_dir" check-ignore -q ".scratch/campus-puzzle-race/spec.md" 2>/dev/null; then
  fail ".gitignore must preserve existing .scratch documents"
fi
# Product worktree (tracked staged + compliance) must be untouched apart from allowed launcher files
# Allowed: launcher, tests, finalizer, .gitignore, compliance review line, run dirs (ignored), fixtures (removed)
status_after=$(git -C "$repo_dir" status --porcelain=v1 2>&1 || true)
# Fixtures and test markers must be gone
[[ "$status_after" == *"launcher-durable-fixture"* ]] && fail "dedicated fixtures must be removed after tests"
[[ "$status_after" == *".launcher-test-"* ]] && fail "test markers must be removed after tests"

print -- "PASS: durable launcher validates modes, locks, baselines, Desktop seams, terminal, and finalizer"
