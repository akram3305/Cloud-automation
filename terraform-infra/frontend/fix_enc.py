with open("fix_resources_s3.py", "rb") as f:
    data = f.read()
clean = bytes([ord("-") if b > 127 else b for b in data])
with open("fix_resources_s3.py", "wb") as f:
    f.write(clean)
print("Fixed")
