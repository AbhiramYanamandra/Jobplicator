"""Application packages: storage, evidence checks, starter drafts, isolation."""

PROFILE = {
    "version": "2.0",
    "profile": [
        {"Field": "Name", "Value": "Alex Example"},
        {"Field": "Email", "Value": "alex@example.test"},
        {"Field": "Degree", "Value": "Bachelor of Engineering (Example), UNSW Sydney"},
        {"Field": "Study period", "Value": "2022 – Aug 2026"},
        {"Field": "Primary positioning", "Value": "Embedded and software engineering"},
    ],
    "experiences": [{"experience_id": "EXP-A", "organisation": "Example Racing", "role": "Firmware Engineer",
                     "location": "Example City", "start": "2023-09", "end": "2025-06", "technologies": "C++; STM32"}],
    "projects": [{"project_id": "PRJ-A", "project": "Example Macropad", "course_or_context": "Personal",
                  "technologies": "KiCad; RP2040"}],
    "evidence": [
        {"evidence_id": "EV-1", "parent_id": "EXP-A", "raw_fact": "Built STM32 firmware for a driver display.",
         "metric": "", "technologies": "C++; STM32; FreeRTOS", "confidence": "high", "claim_restriction": "Safe to claim"},
        {"evidence_id": "EV-2", "parent_id": "EXP-A", "raw_fact": "Added Playwright tests.",
         "metric": "+20% automated test coverage", "result": "Increased automated test coverage by 20%.",
         "technologies": "Playwright", "confidence": "high", "claim_restriction": "Safe repeated claim"},
        {"evidence_id": "EV-TEAM", "parent_id": "PRJ-A", "raw_fact": "Team model reached 91.7% precision.",
         "metric": "91.7% precision", "technologies": "YOLO", "claim_restriction": "TEAM RESULT: no sole claim"},
        {"evidence_id": "EV-NO", "parent_id": "EXP-A", "raw_fact": "Cut lap times by 2 seconds.",
         "metric": "2 s", "technologies": "", "claim_restriction": "Do not use"},
        {"evidence_id": "EV-3", "parent_id": "PRJ-A", "raw_fact": "Designed a KiCad PCB around an RP2040.",
         "technologies": "KiCad; RP2040", "confidence": "high", "claim_restriction": "Safe to claim"},
    ],
    "skills": [{"skill": "C/C++"}, {"skill": "Python"}],
    "metrics": [], "star_stories": [], "coursework": [], "sources": [],
    "conflicts": [{"conflict_id": "C-1", "field_or_claim": "Example Racing lap time claim", "status": "Restricted",
                   "recommended_canonical": "Do not use"},
                  {"conflict_id": "C-2", "field_or_claim": "Example Macropad low-power claim", "status": "Restricted",
                   "recommended_canonical": "Do not claim"}],
    "role_mapping": [{"role_family": "Embedded / Firmware", "priority_evidence": "EXP-A; PRJ-A",
                      "secondary_evidence": "", "skills_to_surface": "C/C++; STM32; Kubernetes"}],
}


def job(client, description="Graduate embedded firmware role. C++ and STM32 required."):
    return client.post("/api/jobs", json={"company": "Example Drones", "title": "Embedded Engineer",
                                          "location": "Sydney", "description_raw": description}).json()["id"]


def content(**resume):
    base = {"summary": {"text": "", "evidence_ids": []}, "skills": [], "experience": [], "projects": []}
    base.update(resume)
    return {"content": {"resume": base, "cover_letter": "Dear Hiring Manager"}}


def flags(pkg):
    return [f["message"] for f in pkg["checks"]["flags"]]


def test_starter_draft_uses_only_safe_verbatim_evidence(client):
    assert client.post("/api/profile", json=PROFILE).status_code == 200
    jid = job(client)
    assert client.get(f"/api/jobs/{jid}/package").json()["package"] is None
    pkg = client.post(f"/api/jobs/{jid}/package/draft").json()
    assert pkg["version"] == 1 and pkg["status"] == "draft" and pkg["source"] == "evidence-template"
    res = pkg["content"]["resume"]
    bullets = [b for kind in ("experience", "projects") for item in res[kind] for b in item["bullets"]]
    cited = {i for b in bullets for i in b["evidence_ids"]}
    texts = {e["evidence_id"]: e["raw_fact"] for e in PROFILE["evidence"]}
    assert cited and cited <= {"EV-1", "EV-2", "EV-3"}  # team and restricted evidence excluded
    assert all(b["text"] == texts[b["evidence_ids"][0]] for b in bullets)
    assert res["experience"][0]["dates"] == "Sep 2023 – Jun 2025"
    assert "Kubernetes" not in res["skills"][0]["value"]  # unsupported skill dropped
    assert pkg["checks"]["errors"] == 0, pkg["checks"]
    detail = client.get(f"/api/jobs/{jid}/package").json()
    assert detail["header"]["email"] == "alex@example.test"
    assert set(detail["evidence"]) == cited


def test_checks_flag_unsupported_claims(client):
    client.post("/api/profile", json=PROFILE)
    jid = job(client)
    item = {"parent_id": "EXP-A", "title": "Firmware Engineer", "org": "Example Racing", "bullets": [
        {"text": "Raised test coverage by 35% with Playwright.", "evidence_ids": ["EV-2"]},
        {"text": "Raised test coverage by 20% with Playwright.", "evidence_ids": ["EV-2"]},
        {"text": "Shipped firmware.", "evidence_ids": ["EV-MISSING"]},
        {"text": "Led everything.", "evidence_ids": []},
        {"text": "Reached 91.7% precision.", "evidence_ids": ["EV-TEAM"]},
        {"text": "Cut lap times.", "evidence_ids": ["EV-NO"]},
        {"text": "Built STM32 firmware for a driver display, cutting lap times by 2s.", "evidence_ids": ["EV-1"]},
        {"text": "Designed a low power KiCad PCB around an RP2040.", "evidence_ids": ["EV-3"]},
    ]}
    body = content(experience=[item], skills=[{"label": "Tools", "value": "C++; STM32; Kubernetes"}])
    pkg = client.post(f"/api/jobs/{jid}/package", json=body).json()
    msgs = flags(pkg)
    assert any("'35'" in m for m in msgs) and not any("'20'" in m for m in msgs)
    assert any("EV-MISSING" in m for m in msgs)
    assert any("No evidence cited" in m for m in msgs)
    assert any("team result" in m for m in msgs)
    assert any("EV-NO is restricted" in m for m in msgs)
    assert any("Kubernetes" in m for m in msgs) and not any("'STM32'" in m for m in msgs)
    assert any("bullet 7" in f["where"] and "restricted claim C-1" in f["message"] for f in pkg["checks"]["flags"])
    assert any("bullet 7" in f["where"] and "'2'" in f["message"] for f in pkg["checks"]["flags"])
    assert any("bullet 8" in f["where"] and "C-2" in f["message"] for f in pkg["checks"]["flags"])
    assert pkg["checks"]["errors"] >= 6


def test_versions_approve_list_and_isolation(client):
    client.post("/api/profile", json=PROFILE)
    jid = job(client)
    client.post(f"/api/jobs/{jid}/package/draft")
    v2 = client.post(f"/api/jobs/{jid}/package", json=content()).json()
    assert v2["version"] == 2
    assert client.post(f"/api/jobs/{jid}/package/1/approve").json()["status"] == "approved"
    assert client.post(f"/api/jobs/{jid}/package/2/approve").json()["status"] == "approved"
    detail = client.get(f"/api/jobs/{jid}/package?version=1").json()
    assert detail["package"]["status"] == "draft"
    assert [v["version"] for v in detail["versions"]] == [2, 1]
    listing = client.get("/api/packages").json()
    row = next(p for p in listing["packages"] if p["job_id"] == jid)
    assert row["version"] == 2 and row["status"] == "approved"
    assert client.post(f"/api/jobs/{jid}/package/9/approve").status_code == 404
    client.headers["Authorization"] = "Bearer bob"
    assert client.get(f"/api/jobs/{jid}/package").status_code == 404
    assert client.get("/api/packages").json()["packages"] == []
    assert client.post(f"/api/jobs/{jid}/package", json=content()).status_code == 404


def test_rejects_malformed_package(client):
    jid = job(client)
    bad = {"content": {"resume": {"experience": [{"bullets": [{"text": "x", "evidence_ids": "EV-1"}]}]}}}
    assert client.post(f"/api/jobs/{jid}/package", json=bad).status_code == 422
    assert client.post(f"/api/jobs/{jid}/package", json={"content": {}, "extra": 1}).status_code == 422
