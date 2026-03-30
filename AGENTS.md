# Working Guidelines

## Git Workflow

**Always commit and push after modifying AGENTS.md**:
- Immediately run `git add && git commit && git push` when this file is changed
- Use Git history as **memory** — track past work, decisions, and issue resolutions in commit messages and history
- Check change history with `git log --oneline -20` or `git log -p AGENTS.md`

### 📝 Documentation Update Rule

**Update README.md when design changes**:
1. Follow sequence: **AGENTS.md → README.md → commit → push**
2. README.md is user documentation, so it must always match the design
3. Use `docs:` prefix in commit messages
4. Check both files before pushing

**Example**:
```bash
# 1. AGENTS.md modification complete
# 2. Update README.md
# 3. Commit
git add AGENTS.md README.md
git commit -m "docs: Update architecture documentation\n\n- Update AGENTS.md with new design\n- Sync README.md to match current architecture"

# 4. Check before push
git show --stat

# 5. Push
git push
```

### ⚠️ **Security Warning: Never Commit Sensitive Information**

**Never commit to Git**:
- ❌ Bot Token (`TELEGRAM_BOT_TOKEN`)
- ❌ API Keys, Secrets
- ❌ Passwords, Credentials
- ❌ Chat IDs (may be personal information)
- ❌ `.env` files
- ❌ `config.json` (if it contains tokens)

**Correct method**:
- ✅ Manage via environment variables (`process.env.TELEGRAM_BOT_TOKEN`)
- ✅ Add `.env`, `*.json` to `.gitignore`
- ✅ Never hardcode tokens in test files
- ✅ Immediately clean history with `git filter-repo` if mistaken

**When a token is exposed**:
1. Clean history with `git filter-repo --invert-paths --path <filename>`
2. Update remote with `git push --force`
3. Reissue new token in Telegram BotFather
4. Old token is automatically invalidated

## Debugging

Check console logs:
```bash
[EventHandler] properties.info structure: {
  id: "...",
  sessionId: "...",
  hasRequest: true,
  requestContent: "...",
}
```

## Event Structure Reference

**OpenCode repository location**: `../opencode/`
- Check actual OpenCode event structure
- Analyze event patterns like `message.created`, `session.updated`

### Event Data Location

Actual event data is in `event.properties.info`:
```typescript
// ✅ Correct access
const content = event.properties.info.request.content;
const status = event.properties.info.status;

// ❌ Wrong access (empty)
const content = event.payload.request.content;
```

## Plugin Configuration

- **Telegram Chat ID**: Set via environment variable `TELEGRAM_CHAT_ID` or in `config.json`
- **Bot Token**: `telegram_bot_token` in `config.json`
- **Projects**: `projects` array in `config.json`

## Testing

```bash
# Verify bot token
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN bun run verify-bot.ts

# Build
bun run build

# Test
bun test
```

## Problem History

See `HISTORY.md` for detailed problems and solutions.
