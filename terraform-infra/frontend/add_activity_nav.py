with open("src/App.jsx", "r", encoding="utf-8") as f:
    app = f.read()

if "Activity" not in app:
    app = app.replace(
        'import Resources from "./pages/Resources"',
        'import Resources from "./pages/Resources"\nimport Activity from "./pages/Activity"'
    )
    app = app.replace(
        '<Route path="/resources"',
        '<Route path="/activity" element={<PrivateLayout><Activity /></PrivateLayout>} />\n      <Route path="/resources"'
    )
    with open("src/App.jsx", "w", encoding="utf-8", newline="\n") as f:
        f.write(app)
    print("App.jsx updated")

with open("src/components/Sidebar.jsx", "r", encoding="utf-8") as f:
    sidebar = f.read()

if "/activity" not in sidebar:
    sidebar = sidebar.replace(
        '{ to:"/cost",      label:"Cost",',
        '{ to:"/activity",  label:"Activity",   icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },\n  { to:"/cost",      label:"Cost",'
    )
    with open("src/components/Sidebar.jsx", "w", encoding="utf-8", newline="\n") as f:
        f.write(sidebar)
    print("Sidebar.jsx updated")
