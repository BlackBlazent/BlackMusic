import shutil
import subprocess
import sys


def run(command):
    print(f"\n> {' '.join(command)}")
    return subprocess.run(command, check=False)


def main():
    print("=" * 60)
    print(" Raven yt-dlp Installer")
    print(" Windows / macOS / Linux")
    print("=" * 60)

    print("\nPython version:")
    print(sys.version)

    # Check pip
    print("\nChecking pip...")

    pip_check = run([
        sys.executable,
        "-m",
        "pip",
        "--version",
    ])

    if pip_check.returncode != 0:
        print("\nERROR: pip is not available.")
        print("Please install Python with pip enabled and try again.")
        sys.exit(1)

    # Install or update yt-dlp
    print("\nInstalling/updating yt-dlp...")

    install = run([
        sys.executable,
        "-m",
        "pip",
        "install",
        "--upgrade",
        "yt-dlp",
    ])

    if install.returncode != 0:
        print("\nERROR: Failed to install or update yt-dlp.")
        sys.exit(1)

    # Verify Python module
    print("\nVerifying yt-dlp Python module...")

    verify = subprocess.run(
        [
            sys.executable,
            "-m",
            "yt_dlp",
            "--version",
        ],
        capture_output=True,
        text=True,
    )

    if verify.returncode != 0:
        print("\nERROR: yt-dlp installation could not be verified.")
        print(verify.stderr.strip())
        sys.exit(1)

    version = verify.stdout.strip()

    print(f"\nInstalled version: {version}")

    # Check yt-dlp executable on PATH
    print("\nChecking yt-dlp executable...")

    ytdlp_path = shutil.which("yt-dlp")

    if ytdlp_path:
        print(f"yt-dlp executable found: {ytdlp_path}")
    else:
        print("\nWARNING: yt-dlp was installed, but the")
        print("yt-dlp executable was not found on PATH.")
        print("\nBlackMusic may not be able to launch yt-dlp")
        print("until the Python Scripts directory is added to PATH.")

    print("\n" + "=" * 60)
    print(" yt-dlp installation completed!")
    print("=" * 60)

    print("\nBlackMusic Video Mode can now use yt-dlp.")
    print("Restart BlackMusic after installation if it is currently running.")


if __name__ == "__main__":
    main()