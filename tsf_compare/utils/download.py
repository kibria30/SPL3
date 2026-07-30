import os
import urllib.request


def download_if_missing(url: str, dest_path: str) -> str:
    """Download `url` to `dest_path` unless it already exists. Never raises -- on failure it
    prints instructions for placing the file manually, so a dataset loader can still be run
    offline once the file is where it's expected.
    """
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    if os.path.exists(dest_path):
        print(f"[skip] {dest_path} already exists")
        return dest_path
    try:
        print(f"Downloading {url} -> {dest_path}")
        urllib.request.urlretrieve(url, dest_path)
    except Exception as e:
        print(f"!! Could not download {url}: {e}")
        print(f"   Please download this file manually and place it at: {dest_path}")
    return dest_path
