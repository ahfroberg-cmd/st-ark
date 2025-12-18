#!/usr/bin/env python3
"""
Helper script to extract goal descriptions from PDF files.
This is a utility script to help extract structured goal data.
"""
import subprocess
import sys
import re

def extract_specialty_section(pdf_path, page_start, page_end=None):
    """Extract text from specific pages of PDF."""
    cmd = ['/opt/homebrew/bin/pdftotext', '-f', str(page_start)]
    if page_end:
        cmd.extend(['-l', str(page_end)])
    cmd.extend([pdf_path, '-'])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

def find_c_milestones(text, version="2021"):
    """Find all c-milestones in the text."""
    prefix = "STc" if version == "2021" else "c"
    pattern = rf"Delmål\s+({prefix}\d+)"
    matches = re.findall(pattern, text, re.IGNORECASE)
    return sorted(set(matches), key=lambda x: int(re.search(r'\d+', x).group()))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python extract_goals.py <pdf_path> <page_start> [page_end]")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    page_start = int(sys.argv[2])
    page_end = int(sys.argv[3]) if len(sys.argv) > 3 else None
    
    text = extract_specialty_section(pdf_path, page_start, page_end)
    version = "2021" if "2021" in pdf_path else "2015"
    milestones = find_c_milestones(text, version)
    
    print(f"Found {len(milestones)} c-milestones:")
    for m in milestones:
        print(f"  - {m}")
