import os
for root, dirs, files in os.walk("src"):
    for fname in files:
        if fname.endswith(".jsx") or fname.endswith(".js"):
            path = os.path.join(root, fname)
            with open(path, "rb") as fh:
                data = fh.read()
            if any(b > 127 for b in data):
                clean = bytes([ord("-") if b > 127 else b for b in data])
                with open(path, "wb") as fh:
                    fh.write(clean)
                print("Fixed:", path)
print("Done")
