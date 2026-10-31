# Zips dist/ into ../sanctum-build.zip under a top-level "sanctum-build/" folder.
import os, zipfile, sys
root = os.path.join(os.path.dirname(__file__), '..', 'dist')
out = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'sanctum-build.zip'))
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for d, _, files in os.walk(root):
        for f in files:
            if f.endswith('.map'): continue
            p = os.path.join(d, f)
            z.write(p, os.path.join('sanctum-build', os.path.relpath(p, root)))
print('wrote', out, os.path.getsize(out), 'bytes')
