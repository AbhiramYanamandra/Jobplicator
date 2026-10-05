"""API for the company job-board watchlist."""

from fastapi import APIRouter, Body, Depends, HTTPException
from auth import workspace
from db import repo
from services import boards

router = APIRouter(prefix="/api", dependencies=[Depends(workspace)])


def _clean(row):
    return {k: v for k, v in row.items() if k != "owner_id"}


@router.get("/boards")
def list_boards():
    watched = [_clean(w) for w in repo().all("board_watch", order=["id"])]
    have = {(w["adapter"], w["token"]) for w in watched}
    return {
        "boards": watched,
        "suggested": [s for s in boards.SUGGESTED if (s["adapter"], s["token"]) not in have],
        "last_sync": boards.last_sync(),
    }


@router.post("/boards")
def add_board(payload: dict = Body(...)):
    items = payload.get("boards") or [payload]
    try:
        for b in items[:20]:
            boards.add_watch(str(b.get("adapter", "")), str(b.get("token", "")), str(b.get("label", "")))
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    return list_boards()


@router.post("/boards/{board_id}/delete")
def delete_board(board_id: int):
    if not repo().delete("board_watch", id=board_id):
        raise HTTPException(404, "Record not found")
    return list_boards()


@router.post("/boards/sync")
def sync_boards(payload: dict = Body(default={})):
    if payload.get("stale_only") and not boards.is_stale():
        return {"skipped": True, "created": 0, "boards": []}
    return boards.sync()
