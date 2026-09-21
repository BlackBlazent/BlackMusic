import subprocess
import sys
from pathlib import Path


# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent


# Specific technical commit messages for known BlackMusic files.
COMMIT_MESSAGES = {
    ".github/dependabot.yml":
        "chore(deps): update Dependabot configuration",

    ".gitignore":
        "chore(git): update repository ignore rules",

    "DEVELOPMENT.md":
        "docs(dev): update development documentation",

    "README.md":
        "docs(readme): update project documentation",

    "index.html":
        "refactor(web): update application entry document",

    "package.json":
        "chore(project): update package configuration",

    "pnpm-lock.yaml":
        "chore(deps): update pnpm lockfile",

    "pnpm-workspace.yaml":
        "chore(pnpm): update workspace configuration",

    "src-tauri/Cargo.lock":
        "chore(tauri): update Rust dependency lockfile",

    "src/app/context/AuthContext.tsx":
        "feat(auth): update authentication context",

    "src/app/context/PlaybackContext.tsx":
        "feat(playback): update playback context",

    "src/app/context/PlaylistsContext.tsx":
        "feat(playlists): update playlist context",

    "src/app/layout/AccountModal.tsx":
        "feat(ui): update account modal",

    "src/app/layout/Footer.tsx":
        "refactor(ui): update application footer",

    "src/app/layout/ServicesMenu.tsx":
        "feat(services): update services menu",

    "src/app/layout/Sidebar.tsx":
        "refactor(ui): update application sidebar",

    "src/app/layout/TopBar.css":
        "style(ui): update top bar styles",

    "src/app/layout/TopBar.tsx":
        "refactor(ui): update top bar component",

    "src/app/router.tsx":
        "refactor(router): update application routing",

    "src/lib/library/scanFolder.ts":
        "feat(library): update folder scanning",

    "src/lib/supabaseClient.ts":
        "refactor(auth): update Supabase client configuration",

    "src/pages/library/Library.css":
        "style(library): update library styles",

    "src/pages/library/Library.tsx":
        "feat(library): update library page",

    "src/pages/playground/LinkDropperModal.tsx":
        "feat(playground): update link dropper modal",

    "src/pages/playground/LyricsOverlay.tsx":
        "feat(playground): update lyrics overlay",

    "src/pages/playground/Playground.tsx":
        "feat(playground): update playground page",

    "src/pages/playground/SeekBar.tsx":
        "feat(playback): update seek bar",

    "src/pages/search/SearchResults.css":
        "style(search): update search result styles",

    "src/pages/search/SearchResults.tsx":
        "feat(search): update search results",

    "src/pages/settings/Settings.css":
        "style(settings): update settings styles",

    "tsconfig.json":
        "chore(ts): update TypeScript configuration",

    "tsconfig.node.json":
        "chore(ts): update Node TypeScript configuration",

    "eslint.config.js":
        "chore(lint): add ESLint configuration",

    "resources/":
        "chore(resources): add application resources",

    "src/app/layout/AccountPopover.css":
        "style(ui): add account popover styles",

    "src/app/layout/AccountPopover.tsx":
        "feat(ui): add account popover",

    "src/lib/library/localAudioSource.ts":
        "feat(library): add local audio source",

    "src/root.css":
        "style(ui): update root application styles",

    "src/vite-env.d.ts":
        "chore(vite): add Vite environment declarations",

    "tailwind.config.js":
        "chore(css): add Tailwind configuration",

    "tsconfig.app.json":
        "chore(ts): add application TypeScript configuration",

    "~":
        "chore(project): add project file",
}


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def run_git(*args, check=True):
    """Run a Git command and return stdout."""
    result = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    if check and result.returncode != 0:
        print(result.stderr.strip())
        sys.exit(result.returncode)

    return result.stdout.strip()


def get_status():
    """
    Return Git status entries.

    Uses porcelain v1 so paths are easy to process.
    """
    output = run_git("status", "--short")

    if not output:
        return []

    entries = []

    for line in output.splitlines():
        if len(line) < 4:
            continue

        status = line[:2]
        path = line[3:]

        # Handle renamed files such as:
        # R  old/file -> new/file
        if " -> " in path:
            path = path.split(" -> ")[-1]

        entries.append((status, path))

    return entries


def get_commit_message(path):
    """
    Return a predefined technical message when available.
    Otherwise generate a reasonable fallback.
    """

    if path in COMMIT_MESSAGES:
        return COMMIT_MESSAGES[path]

    normalized = path.replace("\\", "/")

    filename = Path(normalized).name
    stem = Path(normalized).stem

    if normalized.startswith("src/"):
        if normalized.endswith(".css"):
            return f"style: update {stem} styles"

        if normalized.endswith((".tsx", ".ts")):
            return f"refactor: update {stem} component"

        return f"chore: update {normalized}"

    if normalized.startswith("src-tauri/"):
        return f"chore(tauri): update {filename}"

    if filename.endswith(".json"):
        return f"chore(config): update {filename}"

    return f"chore: update {normalized}"


def print_header():
    print()
    print("=" * 70)
    print(" BlackMusic — Bulk Git Commit Tool")
    print("=" * 70)
    print(f"Repository: {REPO_ROOT}")
    print()


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

def main():
    print_header()

    # Make sure this is actually a Git repository.
    run_git("rev-parse", "--show-toplevel")

    entries = get_status()

    if not entries:
        print("No modified or untracked files found.")
        return

    print(f"Found {len(entries)} file(s):")
    print()

    for index, (status, path) in enumerate(entries, start=1):
        message = get_commit_message(path)

        print(f"{index:02d}. [{status}] {path}")
        print(f"    -> {message}")

    print()
    print("-" * 70)

    # Dry-run mode.
    if "--dry-run" in sys.argv:
        print("DRY RUN: No files were added or committed.")
        return

    answer = input(
        "Proceed with one commit per file? [y/N]: "
    ).strip().lower()

    if answer not in ("y", "yes"):
        print("Cancelled. No changes were committed.")
        return

    print()
    print("=" * 70)

    successful = 0
    failed = 0

    for index, (status, path) in enumerate(entries, start=1):
        message = get_commit_message(path)

        print()
        print(f"[{index}/{len(entries)}] Processing:")
        print(f"  File:    {path}")
        print(f"  Status:  {status}")
        print(f"  Commit:  {message}")

        # ----------------------------------------------------
        # Add only this specific file.
        # ----------------------------------------------------
        add_result = subprocess.run(
            ["git", "add", "--", path],
            cwd=REPO_ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        if add_result.returncode != 0:
            print("  ERROR: git add failed.")
            print(f"  {add_result.stderr.strip()}")
            failed += 1
            continue

        # ----------------------------------------------------
        # Commit only this staged file.
        # ----------------------------------------------------
        commit_result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=REPO_ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        if commit_result.returncode != 0:
            print("  ERROR: git commit failed.")
            print(f"  {commit_result.stderr.strip()}")

            # Do not leave the failed file staged.
            subprocess.run(
                ["git", "reset", "--", path],
                cwd=REPO_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            failed += 1
            continue

        print("  OK: committed.")
        successful += 1

    print()
    print("=" * 70)
    print(" Finished")
    print("=" * 70)
    print(f"Successful commits: {successful}")
    print(f"Failed commits:     {failed}")

    print()
    print("Remaining Git status:")
    print("-" * 70)

    remaining = run_git("status", "--short", check=False)

    if remaining:
        print(remaining)
    else:
        print("Working tree clean.")


if __name__ == "__main__":
    main()