"""
alwayslovebeer PDF からテキストを抽出する（pdfplumber標準）
"""
import sys
import pdfplumber
import warnings
warnings.filterwarnings("ignore")

pdf_path = sys.argv[1]
pdf = pdfplumber.open(pdf_path)

for page in pdf.pages:
    t = page.extract_text()
    if t:
        print(t)
