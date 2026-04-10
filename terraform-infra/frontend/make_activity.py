content = open("write_activity.py", "rb").read()
clean = bytes([ord("-") if b > 127 else b for b in content])
open("write_activity.py", "wb").write(clean)

# Now extract and write just the JSX content
exec(compile(open("write_activity.py", "rb").read(), "write_activity.py", "exec"))
print("Activity.jsx created")
