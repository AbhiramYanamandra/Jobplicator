from __future__ import annotations
from dataclasses import dataclass


@dataclass
class AdapterResult:
    source: str
    jobs: list[dict]
    detail: str = ""


class JobAdapter:
    name = "base"

    def fetch(self, **kwargs) -> AdapterResult:
        raise NotImplementedError
