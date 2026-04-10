with open("src/write_all.py", "rb") as f:
    data = f.read()
clean = bytes([ord("-") if b > 127 else b for b in data])
with open("src/write_all.py", "wb") as f:
    f.write(clean)
print("Fixed")
