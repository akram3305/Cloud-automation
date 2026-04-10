with open("fix_s3_collapse.py", "rb") as f:
    data = f.read()
clean = bytes([ord("-") if b > 127 else b for b in data])
with open("fix_s3_collapse.py", "wb") as f:
    f.write(clean)
print("Fixed")
