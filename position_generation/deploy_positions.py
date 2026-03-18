import os
import shutil


def run(src="./positions", dst="../public/positions"):
    if not os.path.exists(src):
        print(f"Source not found: {src}")
        return
    if os.path.exists(dst):
        shutil.rmtree(dst)
        print(f"Cleared {dst}")
    shutil.copytree(src, dst)
    total = sum(len(files) for _, _, files in os.walk(dst))
    print(f"Copied {total} files to {dst}")


if __name__ == "__main__":
    run()
