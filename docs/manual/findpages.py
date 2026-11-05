# Prints the 1-based page of each divider in the PDF: python -I findpages.py <pdf> <json list of strings>
import json, sys
import pymupdf
doc = pymupdf.open(sys.argv[1])
want = json.loads(sys.argv[2])
res = []
for w in want:
    res.append(next((i + 1 for i, p in enumerate(doc) if p.search_for(w) and len(p.get_text()) < 400), 0))
print(json.dumps(res))
