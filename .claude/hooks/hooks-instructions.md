
See example: https://claude.ai/chat/e19f11bc-5bbe-4fa3-b1f2-7a9d8d48dfb1

Here's a minimal setup with three hooks: block protected files, format after edits, and run tests when Claude finishes.

.claude/settings.json

json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/protect-files.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/format.sh" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/run-tests.sh" }
        ]
      }
    ]
  }
}

.claude/hooks/protect-files.sh (blocks edits to sensitive files)

bash
#!/bin/bash
file=$(jq -r '.tool_input.file_path // empty')

case "$file" in
  *.env*|*package-lock.json|*/migrations/*|*/generated/*)
    echo "Blocked: $file is protected. Edit the source or ask the user." >&2
    exit 2 ;;
esac
exit 0

.claude/hooks/format.sh (auto-format after each edit)

bash
#!/bin/bash
file=$(jq -r '.tool_input.file_path // empty')

case "$file" in
  *.ts|*.tsx|*.js|*.json|*.md)
    npx prettier --write "$file" >/dev/null 2>&1 ;;
esac
exit 0

.claude/hooks/run-tests.sh (tests before Claude declares done)

bash
#!/bin/bash
input=$(cat)

# Avoid infinite loops: if we already forced a continue, let it stop
if [ "$(echo "$input" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

if ! output=$(npm test --silent 2>&1); then
  echo "Tests failing, fix before finishing:" >&2
  echo "$output" | tail -30 >&2
  exit 2
fi
exit 0

Setup notes

Make the scripts executable: chmod +x .claude/hooks/*.sh
You need jq installed, since the scripts parse the JSON Claude sends on stdin.
Exit 2 blocks the action and sends stderr back to Claude, so it can fix its own mistake.
Swap the test and format commands for whatever your project uses.
Run /hooks inside Claude Code to confirm they're registered.