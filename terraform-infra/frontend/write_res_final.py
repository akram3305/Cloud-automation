import shutil, os
src = os.path.expanduser("~/Downloads/Resources_full.jsx")
dst = "src/pages/Resources.jsx"
if os.path.exists(src):
    shutil.copy(src, dst)
    print("Copied from Downloads")
else:
    print("File not in Downloads - checking Desktop")
    src2 = os.path.expanduser("~/Desktop/Resources_full.jsx")
    if os.path.exists(src2):
        shutil.copy(src2, dst)
        print("Copied from Desktop")
    else:
        print("File not found - please save it manually")
