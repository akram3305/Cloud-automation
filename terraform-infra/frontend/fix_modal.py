with open("write_modal.py", "rb") as f:
    data = f.read()
data = data.replace(b"\x97", b"-").replace(b"\xe2\x80\x94", b"-")
with open("write_modal.py", "wb") as f:
    f.write(data)
print("Fixed")
