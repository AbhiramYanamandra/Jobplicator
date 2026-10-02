import sqlite3, json, pytest
from pathlib import Path
from db import use_repository
from conftest import OWNER_A, OWNER_B, ROOT
from legacy_import import import_legacy
from adapters.safe_http import validate_url, board_token


def test_import_is_transactional_idempotent_and_remaps_foreign_keys(engine, tmp_path):
    old = tmp_path / "legacy.db"
    with sqlite3.connect(old) as c:
        c.executescript(
            "CREATE TABLE jobs(id TEXT PRIMARY KEY,source TEXT,company TEXT,title TEXT,description_raw TEXT); CREATE TABLE applications(id INTEGER PRIMARY KEY,job_id TEXT,status TEXT); CREATE TABLE application_events(id INTEGER PRIMARY KEY,application_id INTEGER,event_type TEXT,detail TEXT); CREATE TABLE coding_questions(id INTEGER PRIMARY KEY,title TEXT); CREATE TABLE coding_question_attempts(id INTEGER PRIMARY KEY,question_id INTEGER,solved INTEGER);"
        )
        c.execute(
            "INSERT INTO jobs VALUES('OLD-1','Manual','Example','Engineer','Python')"
        )
        c.execute("INSERT INTO applications VALUES(7,'OLD-1','applied')")
        c.execute("INSERT INTO application_events VALUES(9,7,'status','applied')")
        c.execute("INSERT INTO coding_questions VALUES(8,'Example question')")
        c.execute("INSERT INTO coding_question_attempts VALUES(10,8,1)")
    source_before = old.read_bytes()
    for owner in (OWNER_A, OWNER_B):
        with engine.begin() as c:
            with use_repository(c, owner) as r:
                dry = import_legacy(old, ROOT / "examples/career_profile.json")
                assert dry["dry_run"] and not r.all("jobs")
                result = import_legacy(
                    old, ROOT / "examples/career_profile.json", apply=True
                )
                assert result["counts"]["jobs"] == 1
                assert (
                    r.all("application_events")[0]["application_id"]
                    == r.all("applications")[0]["id"]
                )
                assert (
                    r.all("coding_question_attempts")[0]["question_id"]
                    == r.all("coding_questions")[0]["id"]
                )
                assert import_legacy(
                    old, ROOT / "examples/career_profile.json", apply=True
                )["already_imported"]
    assert old.read_bytes() == source_before


def test_bad_import_rolls_back(engine, tmp_path):
    old = tmp_path / "orphan.db"
    with sqlite3.connect(old) as c:
        c.executescript(
            "CREATE TABLE jobs(id TEXT PRIMARY KEY,source TEXT,company TEXT,title TEXT); INSERT INTO jobs VALUES('ok','Manual','Example','Example'); CREATE TABLE applications(id INTEGER PRIMARY KEY,job_id TEXT,status TEXT); INSERT INTO applications VALUES(1,'missing','saved');"
        )
    with pytest.raises(ValueError, match="orphaned"):
        with engine.begin() as c:
            with use_repository(c, OWNER_A):
                import_legacy(old, apply=True)
    with engine.begin() as c:
        with use_repository(c, OWNER_A) as r:
            assert r.all("jobs") == []


@pytest.mark.parametrize(
    "url",
    ["file:///etc/passwd", "http://user:pass@example.com", "http://example.com:5432"],
)
def test_unsafe_url_scheme_credentials_and_port(url):
    with pytest.raises(ValueError):
        validate_url(url)


@pytest.mark.parametrize(
    "ip", ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fc00::1", "224.0.0.1"]
)
def test_private_addresses_rejected(monkeypatch, ip):
    monkeypatch.setattr(
        "socket.getaddrinfo", lambda *a, **kw: [(2, 1, 6, "", (ip, 443))]
    )
    with pytest.raises(ValueError, match="public"):
        validate_url("https://example.com/job")


def test_tokens_cannot_inject_url_paths():
    assert board_token("example-board") == "example-board"
    with pytest.raises(ValueError):
        board_token("../private?url=internal")
