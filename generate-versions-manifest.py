#!/usr/bin/env python3
import os
import json
import sys

import requests

REPO = os.getenv("REPOSITORY", "PyO3/maturin")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
OUTPUT = os.getenv("OUTPUT", "versions-manifest.json")

session = requests.Session()


def fetch_releases(page=1, per_page=50):
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    res = session.get(
        f"https://api.github.com/repos/{REPO}/releases",
        params={"page": page, "per_page": per_page},
        headers=headers,
    )
    res.raise_for_status()
    releases = res.json()
    for release in releases:
        files = []
        for asset in release["assets"]:
            filename = asset["name"]
            if "darwin" in filename:
                platform = "darwin"
            elif "linux" in filename:
                platform = "linux"
            elif "windows" in filename:
                platform = "win32"
            else:
                continue

            if "x86_64" in filename:
                arch = "x64"
            elif "i686" in filename and platform == "win32":
                arch = "x86"
            else:
                continue

            files.append(
                {
                    "filename": filename,
                    "arch": arch,
                    "platform": platform,
                    "download_url": asset["browser_download_url"],
                }
            )

        version = release["name"] or release["tag_name"]
        if version.startswith("v"):
            version = version[1:]
        yield {
            "version": version,
            "stable": not (release["prerelease"] or release["draft"]),
            "release_url": release["html_url"],
            "files": sorted(files, key=lambda f: f["platform"]),
        }


def generate_versions_manifest():
    all_releases = []
    page = 1
    per_page = 50
    while True:
        releases = list(fetch_releases(page, per_page))
        all_releases.extend(releases)
        if len(releases) < per_page:
            break
        page += 1
    with open(OUTPUT, "w") as f:
        f.write(json.dumps(all_releases, indent=2, sort_keys=True, ensure_ascii=False))


def main():
    generate_versions_manifest()
    return 0


if __name__ == "__main__":
    sys.exit(main())
