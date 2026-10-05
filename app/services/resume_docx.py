"""Word (.docx) export of a package resume, in the layout of the V4 resume.

Times New Roman on A4 with narrow margins; 15pt bold centred name, a 10pt
contact line with links, a quoted 9pt tagline, ruled 9pt bold section
headings, 10pt role lines with bold-italic dates on a right tab stop, and 9pt
Symbol bullets. Text supports **bold** and ^superscript^ markup.

The package is built from plain XML parts so no template binary is needed.
"""

from __future__ import annotations
import io
import re
import zipfile
from xml.sax.saxutils import escape

TEXT_WIDTH = 11906 - 720 - 720  # A4 width minus left/right margins (twips)
W_NS = (
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
)
FONT = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>'


def _run(text, size=18, bold=False, italic=False, sup=False, link=False):
    if not text:
        return ""
    props = ['<w:rStyle w:val="Hyperlink"/>' if link else "", FONT]
    if bold:
        props.append("<w:b/><w:bCs/>")
    if italic:
        props.append("<w:i/><w:iCs/>")
    props.append(f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>')
    if sup:
        props.append('<w:vertAlign w:val="superscript"/>')
    body = "<w:tab/>".join(f'<w:t xml:space="preserve">{escape(p)}</w:t>' for p in text.split("\t"))
    return f"<w:r><w:rPr>{''.join(props)}</w:rPr>{body}</w:r>"


def rich(text, size=18, bold=False, italic=False):
    """Runs for text with **bold** and ^superscript^ markup."""
    out = []
    for i, chunk in enumerate(re.split(r"\*\*", text or "")):
        for j, piece in enumerate(chunk.split("^")):
            out.append(_run(piece, size, bold or i % 2 == 1, italic, sup=j % 2 == 1))
    return "".join(out)


def _para(runs, *, jc="both", before=0, after=0, bullet=False, border=False, tab=False, keep=False, size=18):
    p = ['<w:pStyle w:val="ListParagraph"/>' if bullet else ""]
    if keep:
        p.append("<w:keepNext/>")
    if bullet:
        p.append('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')
    if border:
        p.append('<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="auto"/></w:pBdr>')
    if tab:
        p.append(f'<w:tabs><w:tab w:val="right" w:pos="{TEXT_WIDTH}"/></w:tabs>')
    p.append(f'<w:spacing w:before="{before}" w:after="{after}" w:line="240" w:lineRule="auto"/>')
    if bullet:
        p.append('<w:ind w:left="720" w:hanging="360"/>')
    p.append(f'<w:jc w:val="{jc}"/>')
    # The paragraph-mark size also sizes the bullet glyph.
    p.append(f'<w:rPr><w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>')
    return f"<w:p><w:pPr>{''.join(p)}</w:pPr>{runs}</w:p>"


def _heading(title):
    return _para(_run(title.upper(), 18, bold=True), jc="left", before=40, after=20, border=True, keep=True)


def _dated(left, dates, size, before=0, bullet=False):
    right = _run("\t", size) + rich(dates, size, bold=True, italic=True) if dates else ""
    return _para(left + right, jc="left", tab=True, before=before, keep=not bullet, bullet=bullet)


def contact_items(header):
    """[(label, url or None)] for the contact line, in V4 order."""
    items = []
    if header.get("phone"):
        items.append((header["phone"], None))
    if header.get("email"):
        items.append(("Email", f"mailto:{header['email']}"))
    for label, key in (("GitHub", "github"), ("LinkedIn", "linkedin"), ("Website", "website")):
        if header.get(key):
            items.append((label, header[key]))
    for key in ("work_rights", "licence"):
        if header.get(key):
            items.append((header[key], None))
    return items


def body_xml(header, resume):
    """Return (document body XML, [hyperlink urls])."""
    links, out = [], []
    out.append(_para(_run(header.get("name", ""), 30, bold=True), jc="center"))
    pieces = []
    for label, url in contact_items(header):
        if url:
            links.append(url)
            pieces.append(f'<w:hyperlink r:id="rIdLink{len(links)}" w:history="1">{_run(label, 20, link=True)}</w:hyperlink>')
        else:
            pieces.append(_run(label, 20))
    out.append(_para(_run(" | ", 20).join(pieces), jc="center"))
    tagline = (resume.get("tagline") or {}).get("text", "").strip()
    if tagline:
        out.append(_para(rich(f"“{tagline}”", 18), jc="center"))

    ed = resume.get("education") or {}
    if ed.get("institution") or ed.get("degree"):
        out.append(_heading("Education"))
        out.append(_dated(rich(ed.get("institution", ""), 18, bold=True), ed.get("dates", ""), 18))
        if ed.get("degree") or ed.get("details"):
            out.append(_dated(rich(ed.get("degree", ""), 18), ed.get("details", ""), 18))
        for h in ed.get("highlights", []):
            if h.get("text", "").strip():
                out.append(_dated(rich(h["text"], 18), h.get("dates", ""), 18, bullet=True))

    summary = (resume.get("summary") or {}).get("text", "").strip()
    if summary:
        out.append(_heading("Summary"))
        out.append(_para(rich(summary, 18)))

    if resume.get("skills"):
        out.append(_heading("Skills"))
        for s in resume["skills"]:
            out.append(_para(_run(s.get("label", "") + ": ", 18, bold=True) + rich(s.get("value", ""), 18), bullet=True))

    for kind, title in (("experience", "Professional Experience"), ("projects", "Research & Selected Technical Projects")):
        items = [x for x in resume.get(kind, []) if x.get("title") or x.get("bullets")]
        if not items:
            continue
        out.append(_heading(title))
        for i, x in enumerate(items):
            if kind == "experience":
                left = _run(x.get("title", ""), 20, bold=True)
                rest = ", ".join(v for v in (x.get("org"), x.get("location")) if v)
                left += _run(", " + rest, 20) if rest else ""
                size = 20
            else:
                label = x.get("title", "")
                label += f": {x['org']}" if x.get("org") else ""
                label += f" – {x['mark']}" if x.get("mark") else ""
                left, size = _run(label, 18, bold=True), 18
            out.append(_dated(left, x.get("dates", ""), size, before=40 if i else 0))
            for b in x.get("bullets", []):
                if b.get("text", "").strip():
                    out.append(_para(rich(b["text"], 18), bullet=True))
    return "".join(out), links


CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>"""

STYLES = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles {W_NS}><w:docDefaults><w:rPrDefault><w:rPr>{FONT}<w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="en-AU"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/></w:pPr></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:color w:val="0000FF"/></w:rPr></w:style></w:styles>"""

NUMBERING = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering {W_NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val=""/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>"""

SETTINGS = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings {W_NS}><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>"""

SECT = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="284" w:right="720" w:bottom="720" '
        'w:left="720" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/></w:sectPr>')


def render(header: dict, resume: dict) -> bytes:
    body, links = body_xml(header, resume)
    document = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document {W_NS}><w:body>'
                f"{body}{SECT}</w:body></w:document>")
    rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    doc_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'<Relationship Id="rIdStyles" Type="{rel}/styles" Target="styles.xml"/>'
        f'<Relationship Id="rIdNumbering" Type="{rel}/numbering" Target="numbering.xml"/>'
        f'<Relationship Id="rIdSettings" Type="{rel}/settings" Target="settings.xml"/>'
        + "".join(f'<Relationship Id="rIdLink{i}" Type="{rel}/hyperlink" Target="{escape(u, {chr(34): "&quot;"})}" TargetMode="External"/>'
                  for i, u in enumerate(links, 1))
        + "</Relationships>")
    core = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties '
            'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'
            f'{escape(header.get("name", ""))} Resume</dc:title><dc:creator>{escape(header.get("name", ""))}</dc:creator></cp:coreProperties>')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", ROOT_RELS)
        z.writestr("docProps/core.xml", core)
        z.writestr("word/document.xml", document)
        z.writestr("word/_rels/document.xml.rels", doc_rels)
        z.writestr("word/styles.xml", STYLES)
        z.writestr("word/numbering.xml", NUMBERING)
        z.writestr("word/settings.xml", SETTINGS)
    return buf.getvalue()
