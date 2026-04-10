with open("write_modal.py", "rb") as f:
    data = f.read()

# Replace all non-ASCII bytes that are causing issues
clean = []
i = 0
while i < len(data):
    b = data[i]
    if b > 127:
        clean.append(ord('-'))
        i += 1
    else:
        clean.append(b)
        i += 1

with open("write_modal.py", "wb") as f:
    f.write(bytes(clean))
print("Fixed")
