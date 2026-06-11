
import pdfplumber, json, warnings, sys
warnings.filterwarnings("ignore")
pdf = pdfplumber.open(sys.argv[1])
pages = []
for i, page in enumerate(pdf.pages):
    if 4 <= i <= 27:
        t = page.extract_text()
        pages.append({"page": i+1, "text": t or ""})
print(json.dumps(pages, ensure_ascii=False))
