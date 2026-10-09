
import subprocess
import sys
from pathlib import Path


# ============================================================
# BlackMusic 2.1.0 - Bulk Git Commit Tool
# ============================================================

SCRIPT_DIR = Path(__file__).resolve().parent


def run_git(*args):
    """Run Git from the repository root and return the result."""
    return subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def find_repo_root():
    """Find the root of the current Git repository."""
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=SCRIPT_DIR,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    if result.returncode != 0:
        print("ERROR: Run this script inside a Git repository.")
        print(result.stderr.strip())
        sys.exit(result.returncode)

    return Path(result.stdout.strip()).resolve()


REPO_ROOT = find_repo_root()


# ============================================================
# Specific commit messages
# ============================================================

COMMIT_MESSAGES = {
    ".env.example": "chore(env): update example environment configuration",
    ".gitignore": "chore(git): update ignore rules",
    ".github/pull_request_template.md": "docs(github): add pull request template",
    ".github/ISSUE_TEMPLATE/bug_report.md": "docs(github): add bug report template",
    ".github/ISSUE_TEMPLATE/feature_request.md": "docs(github): add feature request template",
    "DEVELOPMENT.md": "docs(dev): update development documentation",
    "README.md": "docs(readme): update project documentation",
    "CHANGELOG.md": "docs(changelog): document BlackMusic 2.1.0",
    "package.json": "chore(project): update package configuration",
    "pnpm-lock.yaml": "chore(deps): update pnpm lockfile",

    "src-tauri/Cargo.toml": "chore(tauri): update Rust dependencies",
    "src-tauri/Cargo.lock": "chore(tauri): update Rust dependency lockfile",
    "src-tauri/tauri.conf.json": "chore(tauri): update Tauri configuration",
    "src-tauri/capabilities/default.json": "chore(tauri): update default capabilities",
    "src-tauri/capabilities/pip.json": "feat(tauri): add picture-in-picture capabilities",
    "src-tauri/src/main.rs": "refactor(tauri): update application entry point",
    "src-tauri/src/fast_scan.rs": "feat(library): add native fast scanning",
    "src-tauri/src/importer.rs": "feat(library): add native track importer",
    "src-tauri/src/metadata.rs": "feat(library): add native metadata processing",

    "src/App.tsx": "refactor(app): update application composition",
    "src/main.tsx": "refactor(app): update frontend entry point",
    "src/app/context/AppSettingsContext.tsx": "feat(settings): update settings context",
    "src/app/context/AuthContext.tsx": "feat(auth): improve authentication and account state",
    "src/app/context/LibraryContext.tsx": "feat(library): update library context",
    "src/app/context/NotificationsContext.tsx": "feat(notifications): update notification context",
    "src/app/context/PlaybackContext.tsx": "feat(playback): update playback context",
    "src/app/context/PlaylistsContext.tsx": "feat(playlists): update playlist context",
    "src/app/context/ServicesContext.tsx": "feat(services): update service context",
    "src/app/context/PlayerUiContext.tsx": "feat(ui): add player interface context",
    "src/app/context/PromotionsContext.tsx": "feat(promotions): add promotion context",

    "src/app/components/ChangelogModal.tsx": "feat(changelog): add changelog modal",
    "src/app/components/EditMetadataModal.tsx": "feat(library): add metadata editor",
    "src/app/components/PipHost.tsx": "feat(playback): add picture-in-picture host",
    "src/app/components/Promotion.tsx": "feat(promotions): add promotion component",
    "src/app/components/TrackMenu.tsx": "feat(library): add track menu",
    "src/app/components/VideoFrame.tsx": "feat(video): add video frame",
    "src/app/components/useStripLayout.ts": "refactor(ui): extract strip layout hook",

    "src/app/layout/AccountModal.tsx": "feat(auth): update account modal",
    "src/app/layout/AccountPopover.tsx": "feat(auth): update account popover",
    "src/app/layout/AppShell.tsx": "refactor(ui): update application shell",
    "src/app/layout/Footer.tsx": "refactor(ui): update footer",
    "src/app/layout/GlobalPlaybackBar.tsx": "feat(playback): improve global playback bar",
    "src/app/layout/NotificationsPopover.tsx": "feat(notifications): update notifications popover",
    "src/app/layout/ServicesMenu.tsx": "feat(services): update services menu",
    "src/app/layout/TopBar.tsx": "refactor(ui): update top bar",
    "src/app/layout/ProfileCard.tsx": "feat(auth): add profile card",
    "src/app/layout/RouteResume.tsx": "feat(navigation): restore previous route",

    "src/lib/library/scanFolder.ts": "feat(library): improve folder scanning",
    "src/lib/library/fastImport.ts": "feat(library): add parallel library import",
    "src/lib/library/metadataEditor.ts": "feat(library): add metadata editing services",
    "src/lib/openInFileExplorer.ts": "feat(library): open folders in file explorer",
    "src/lib/types.ts": "refactor(types): update shared application types",
    "src/lib/appVersion.ts": "chore(app): centralize application version",
    "src/lib/changelog.ts": "feat(changelog): add structured release notes",
    "src/lib/usePersistentState.ts": "feat(state): add persistent state hook",

    "src/lib/services/spotifyClient.ts": "feat(spotify): update Spotify integration",
    "src/lib/services/serviceDirectory.ts": "refactor(services): update service directory",
    "src/lib/services/serviceRegistry.ts": "feat(services): add service registry",
    "src/lib/services/serviceFetch.ts": "feat(services): add shared service fetching",
    "src/lib/services/customApis.ts": "feat(services): support custom music APIs",
    "src/lib/services/useCustomApis.ts": "feat(services): add custom API management hook",

    "src/pages/folder/Folder.tsx": "feat(folder): update folder browser",
    "src/pages/home/Home.tsx": "feat(home): update home page",
    "src/pages/library/Library.tsx": "feat(library): improve library interface",
    "src/pages/local/Local.tsx": "feat(local): update local music browser",
    "src/pages/online/Online.tsx": "feat(online): update online music browser",
    "src/pages/playground/Playground.tsx": "feat(playground): add media playback features",
    "src/pages/playground/LinkDropperModal.tsx": "feat(playground): improve link dropper modal",
    "src/pages/playground/QueueStrip.tsx": "feat(playback): improve queue controls",
    "src/pages/playground/SeekBar.tsx": "feat(playback): improve seek bar",
    "src/pages/search/SearchResults.tsx": "feat(search): update search results",
    "src/pages/settings/Settings.tsx": "feat(settings): update settings interface",

    "tools/prepare-exiftool.mjs": "chore(tools): add ExifTool preparation script",
    "git_system_bulk_commit_push.py": "refactor(git): replace bulk commit script",

    "src/pages/playground/LyricsOverlay.tsx": "refactor(lyrics): remove previous lyrics overlay",
    "src/pages/playground/LyricsOverlay.css": "refactor(lyrics): remove previous lyrics styles",
    "src/pages/playground/downloadService.ts": "refactor(downloads): remove previous download service",
}


# ============================================================
# Git status
# ============================================================

def get_status():
    """Get changed paths, including deleted and untracked files."""
    result = run_git(
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
    )

    if result.returncode != 0:
        print(result.stderr.strip())
        sys.exit(result.returncode)

    # Git paths can contain spaces. NUL separators preserve them.
    records = result.stdout.split("\0")
    entries = []
    index = 0

    while index < len(records):
        record = records[index]
        index += 1

        if len(record) < 4:
            continue

        status = record[:2]
        path = record[3:]

        if "R" in status or "C" in status:
            if index < len(records):
                index += 1

        entries.append((status, path))

    return entries


def get_commit_message(path, status):
    """Generate a descriptive commit message for each changed file."""
    normalized = path.replace("\\", "/")
    filename = Path(normalized).name
    stem = Path(normalized).stem
    lower = normalized.lower()

    if normalized in COMMIT_MESSAGES:
        return COMMIT_MESSAGES[normalized]

    if "D" in status:
        return f"refactor(files): remove {filename}"

    if lower.startswith(".github/"):
        return f"chore(github): update {filename}"

    if lower.endswith((".md", ".mdx")):
        return f"docs: update {filename}"

    if lower.startswith("src-tauri/"):
        if lower.endswith(".rs"):
            return f"feat(tauri): update {stem}"
        return f"chore(tauri): update {filename}"

    if "promotion" in lower:
        return f"feat(promotions): update {stem}"

    if "video" in lower or "/video/" in lower:
        return f"feat(video): update {stem}"

    if "pip" in lower or "pictureinpicture" in lower:
        return f"feat(playback): update picture-in-picture"

    if "auth" in lower or "/auth/" in lower:
        return f"feat(auth): update {stem}"

    if "library" in lower or "metadata" in lower or "import" in lower:
        return f"feat(library): update {stem}"

    if lower.endswith(".css"):
        return f"style(ui): update {stem} styles"

    if lower.endswith((".tsx", ".ts")):
        return f"refactor(app): update {stem}"

    if lower.endswith((".json", ".yml", ".yaml")):
        return f"chore(config): update {filename}"

    if lower.endswith((".py", ".js", ".mjs", ".cjs")):
        return f"chore(scripts): update {filename}"

    return f"chore(project): update {normalized}"


# ============================================================
# Main
# ============================================================

def main():
    print("=" * 65)
    print("BlackMusic 2.1.0 - Bulk Git Commit Tool")
    print("=" * 65)
    print(f"Repository: {REPO_ROOT}")
    print()

    entries = get_status()

    if not entries:
        print("No changes found.")
        return

    print(f"Found {len(entries)} changed file(s):\n")

    for number, (status, path) in enumerate(entries, 1):
        message = get_commit_message(path, status)
        print(f"{number:03d}. [{status}] {path}")
        print(f"      {message}")

    if "--dry-run" in sys.argv:
        print("\nDry run complete. Nothing was committed.")
        return

    if "--yes" not in sys.argv:
        answer = input(
            "\nProceed with one commit per file? [y/N]: "
        ).strip().lower()

        if answer not in ("y", "yes"):
            print("Cancelled.")
            return

    successful = 0
    failed = 0

    for number, (status, path) in enumerate(entries, 1):
        message = get_commit_message(path, status)

        print(f"\n[{number}/{len(entries)}] {path}")
        print(f"Commit: {message}")

        # Stage the selected path, including deleted files.
        add_result = run_git("add", "-A", "--", path)

        if add_result.returncode != 0:
            print("ERROR: git add failed.")
            print(add_result.stderr.strip())
            failed += 1
            continue

        # Commit only the selected path.
        commit_result = run_git(
            "commit",
            "--only",
            "-m",
            message,
            "--",
            path,
        )

        if commit_result.returncode != 0:
            print("ERROR: git commit failed.")
            print(commit_result.stderr.strip())
            failed += 1
            continue

        print(commit_result.stdout.strip())
        successful += 1

    print("\n" + "=" * 65)
    print("Finished")
    print("=" * 65)
    print(f"Successful commits: {successful}")
    print(f"Failed commits:     {failed}")

    remaining = run_git("status", "--short", "--untracked-files=all")

    print("\nRemaining Git status:")
    print(remaining.stdout.strip() or "Working tree clean.")


if __name__ == "__main__":
    main()