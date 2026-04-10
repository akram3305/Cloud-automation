with open("write_storage.py", "rb") as f:
    data = f.read()
clean = bytes([ord("-") if b > 127 else b for b in data])
with open("write_storage.py", "wb") as f:
    f.write(clean)
print("Fixed")
