import os
import shutil

SRC = "./positions"
DST = "../public/positions"

if not os.path.exists(SRC):
    print(f"Source not found: {SRC}")
    exit(1)

if os.path.exists(DST):
    shutil.rmtree(DST)
    print(f"Cleared {DST}")

shutil.copytree(SRC, DST)

total = sum(len(files) for _, _, files in os.walk(DST))
print(f"Copied {total} files to {DST}")
