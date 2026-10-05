"""Resume template fields, their checks, and the Word export."""

import copy
import io
import re
import zipfile

from test_packages import PROFILE, job, content, flags

TEMPLATE_PROFILE = copy.deepcopy(PROFILE)
TEMPLATE_PROFILE["profile"] += [
    {"Field": "Honours WAM", "Value": "74.5"},
    {"Field": "WAM", "Value": "72.1"},
    {"Field": "Phone", "Value": "+61 400 000 000"},
    {"Field": "GitHub", "Value": "https://github.com/example"},
    {"Field": "Work rights", "Value": "Australian Permanent Resident"},
]
TEMPLATE_PROFILE["coursework"] = [{"course": "Honours Thesis", "result": "89 HD"},
                                  {"course": "Design Project B / COMP4601", "result": "77 DN"},
                                  {"course": "Data Structures / COMP2521", "result": "62 P"}]


def test_template_fields_are_checked(client):
    assert client.post("/api/profile", json=TEMPLATE_PROFILE).status_code == 200
    jid = job(client)
    body = content(
        tagline={"text": "Embedded engineer with **STM32** firmware experience", "evidence_ids": ["EV-1"]},
        education={"institution": "UNSW", "degree": "BE", "dates": "2022 – 2026", "details": "Honours WAM: 74.5",
                   "highlights": [{"text": "Thesis – **89 HD**"}, {"text": "Design Project B – **95 HD**"}]},
        experience=[{"parent_id": "EXP-A", "title": "Firmware Engineer",
                     "bullets": [{"text": "Built **STM32** firmware for a driver display.", "evidence_ids": ["EV-1"]}]}],
        projects=[{"parent_id": "PRJ-A", "title": "Example Macropad", "mark": "99 HD",
                   "bullets": [{"text": "Designed a KiCad PCB around an RP2040.", "evidence_ids": ["EV-3"]}]}],
        skills=[{"label": "Embedded", "value": "**C/C++**; Python"}],
    )
    pkg = client.post(f"/api/jobs/{jid}/package", json=body).json()
    msgs = flags(pkg)
    assert "Number '95' is not in your profile or coursework results." in msgs
    assert "Number '99' is not in your profile or coursework results." in msgs
    # Markup is ignored by the checks; true marks and the Honours WAM pass.
    assert not any("'89'" in m or "'74.5'" in m or "C/C++" in m for m in msgs)
    assert pkg["checks"]["errors"] == 2
    saved = client.get(f"/api/jobs/{jid}/package").json()
    assert saved["package"]["content"]["resume"]["education"]["highlights"][0]["text"] == "Thesis – **89 HD**"
    assert "EV-1" in saved["evidence"]
    h = saved["header"]
    assert h["honours_wam"] == "74.5" and h["phone"] == "+61 400 000 000" and h["github"].endswith("/example")


def test_starter_uses_honours_wam_and_coursework_highlights(client):
    assert client.post("/api/profile", json=TEMPLATE_PROFILE).status_code == 200
    jid = job(client)
    pkg = client.post(f"/api/jobs/{jid}/package/draft").json()
    ed = pkg["content"]["resume"]["education"]
    assert ed["details"] == "Honours WAM: 74.5"
    assert [h["text"] for h in ed["highlights"]] == ["Honours Thesis – **89 HD**", "Design Project B – **77 DN**"]
    assert pkg["checks"]["errors"] == 0


def test_word_export_matches_template(client):
    assert client.post("/api/profile", json=TEMPLATE_PROFILE).status_code == 200
    jid = job(client)
    resume = {"tagline": {"text": "Embedded engineer"},
              "education": {"institution": "UNSW", "dates": "Mar 2022 – Aug 2026", "degree": "BE in **Computer**",
                            "details": "Honours WAM: 74.5", "highlights": [{"text": "Placed 2^nd^", "dates": "2023"}]},
              "experience": [{"title": "Firmware Engineer", "org": "Example Racing", "location": "Sydney",
                              "dates": "Sep 2023 – Jun 2025", "bullets": [{"text": "Built **STM32** firmware & tests."}]}],
              "projects": [{"title": "Thesis", "org": "UNSW", "mark": "89 HD", "bullets": [{"text": "Did research."}]}]}
    r = client.post(f"/api/jobs/{jid}/package/resume.docx", json={"resume": resume})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.wordprocessingml")
    assert 'filename="Alex_Example_Example_Drones.docx"' in r.headers["content-disposition"]
    z = zipfile.ZipFile(io.BytesIO(r.content))
    doc = z.read("word/document.xml").decode()
    rels = z.read("word/_rels/document.xml.rels").decode()
    text = "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", doc))
    assert "Alex Example" in text and "+61 400 000 000" in text and "Australian Permanent Resident" in text
    assert "“Embedded engineer”" in text and "Honours WAM: 74.5" in text
    assert "Thesis: UNSW – 89 HD" in text and "PROFESSIONAL EXPERIENCE" in text
    assert "&amp; tests." in doc and "**" not in text and "^" not in text
    assert '<w:vertAlign w:val="superscript"/>' in doc
    assert "mailto:alex@example.test" in rels and "https://github.com/example" in rels
    assert '<w:pgSz w:w="11906" w:h="16838"/>' in doc


def test_word_export_rejects_bad_resume(client):
    assert client.post("/api/profile", json=TEMPLATE_PROFILE).status_code == 200
    jid = job(client)
    r = client.post(f"/api/jobs/{jid}/package/resume.docx", json={"resume": {"invented": 1}})
    assert r.status_code == 422
