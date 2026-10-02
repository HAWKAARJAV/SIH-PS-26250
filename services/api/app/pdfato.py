"""ATO pages as a real PDF, using ReportLab's built-in fonts."""

from __future__ import annotations

import io
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def ato_pdf(document: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    sheet = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    plan = document["plan"]
    sheet.setFont("Times-Bold", 16)
    sheet.drawString(40, height - 48, f"ATO {plan['id']}")
    sheet.setFont("Courier", 9)
    sheet.drawString(40, height - 66, f"Digest {plan['digest'][:16]}  Status {plan['status']}")
    sheet.drawString(40, height - 80, "SYNTHETIC DATA | UNCLASSIFIED PROTOTYPE | NOT FOR OPERATIONAL USE")
    y = height - 110
    sheet.setFont("Courier", 8)
    for row in document["lines"]:
        if y < 48:
            sheet.showPage()
            sheet.setFont("Courier", 8)
            y = height - 48
        line = f"{row['mission']} {row['call_sign']} {row['type']} {row['tail']} {row['start_dtg']} {row['load_out']}"
        sheet.drawString(40, y, line[:110])
        y -= 12
    sheet.showPage()
    sheet.save()
    return buffer.getvalue()
