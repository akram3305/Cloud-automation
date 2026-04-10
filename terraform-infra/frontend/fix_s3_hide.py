with open("src/pages/Resources.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Make sure non-s3 filter is correct
old = "              {/* Non-S3 resources */}\n              {resources.filter(r => r._type !== \"s3\").map((r, i) => {"
new = "              {/* Non-S3 resources - S3 always hidden here */}\n              {resources.filter(r => r._type !== \"s3\" && r._type !== \"s3\").map((r, i) => {"
content = content.replace(old, new)

# Simpler fix - just filter out all s3 from top list
content = content.replace(
    'resources.filter(r => r._type !== "s3" && r._type !== "s3")',
    'resources.filter(r => r._type !== "s3")'
)

with open("src/pages/Resources.jsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
print("Done")
