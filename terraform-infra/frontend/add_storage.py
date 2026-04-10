# Update App.jsx
with open("src/App.jsx", "r", encoding="utf-8") as f:
    app = f.read()

if "Storage" not in app:
    app = app.replace(
        'import Cost from "./pages/Cost"',
        'import Cost from "./pages/Cost"\nimport Storage from "./pages/Storage"'
    )
    app = app.replace(
        '<Route path="/cost"',
        '<Route path="/storage" element={<PrivateLayout><Storage /></PrivateLayout>} />\n      <Route path="/cost"'
    )
    with open("src/App.jsx", "w", encoding="utf-8", newline="\n") as f:
        f.write(app)
    print("App.jsx updated")
else:
    print("App.jsx already has Storage")

# Update Sidebar.jsx
with open("src/components/Sidebar.jsx", "r", encoding="utf-8") as f:
    sidebar = f.read()

if "/storage" not in sidebar:
    sidebar = sidebar.replace(
        '{ to:"/cost",      label:"Cost",',
        '{ to:"/storage",  label:"Storage",  icon:"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },\n  { to:"/cost",      label:"Cost",'
    )
    with open("src/components/Sidebar.jsx", "w", encoding="utf-8", newline="\n") as f:
        f.write(sidebar)
    print("Sidebar.jsx updated")
else:
    print("Sidebar.jsx already has Storage")
