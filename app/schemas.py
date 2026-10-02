from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

Stage = Literal[
    "saved",
    "shortlisted",
    "tailoring",
    "ready",
    "applied",
    "oa",
    "phone screen",
    "technical",
    "final",
    "offer",
    "rejected",
    "withdrawn",
]
Source = Literal["General practice", "Company-tagged prep", "Real interview"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class JobIn(Input):
    source: str = Field(default="Manual", max_length=100)
    source_url: str | None = Field(default=None, max_length=2048)
    company: str = Field(min_length=1, max_length=300)
    title: str = Field(min_length=1, max_length=500)
    location: str = Field(default="", max_length=300)
    work_mode: str = Field(default="", max_length=100)
    description_raw: str = Field(min_length=1, max_length=50000)
    posted_at: str | None = None
    closing_date: str | None = None


class ApplicationIn(Input):
    status: Stage = "saved"
    applied_at: str | None = None
    next_action: str | None = Field(default=None, max_length=2000)
    follow_up_date: str | None = None
    notes: str | None = Field(default=None, max_length=10000)
    resume_version: str | None = None
    cover_letter_version: str | None = None


class CompanyTag(Input):
    company: str = Field(min_length=1, max_length=300)
    role: str | None = None
    interview_stage: str | None = None
    source_type: str | None = None
    confidence: str = "Reported"


class QuestionIn(Input):
    title: str = Field(min_length=1, max_length=500)
    platform: str = "LeetCode"
    leetcode_number: str | None = None
    url: str | None = None
    difficulty: Literal["Easy", "Medium", "Hard"]
    primary_topic: str = Field(min_length=1, max_length=200)
    secondary_topics: list[str] = Field(default_factory=list, max_length=30)
    source_type: Source = "General practice"
    asked_in_real_interview: bool = False
    notes: str | None = Field(default=None, max_length=10000)
    companies: list[CompanyTag] = Field(default_factory=list, max_length=30)


class AttemptIn(Input):
    solved: bool = False
    hint_used: bool = False
    solved_within_target: bool = False
    time_taken_minutes: int | None = Field(default=None, ge=0, le=10080)
    confidence: str | None = None
    notes: str | None = Field(default=None, max_length=10000)


class InterviewIn(Input):
    question_text: str = Field(min_length=1, max_length=10000)
    company: str | None = None
    role: str | None = None
    interview_stage: str | None = None
    question_category: str | None = None
    source_type: Source = "General practice"
    asked_in_real_interview: bool = False
    answer: str | None = Field(default=None, max_length=20000)
    notes: str | None = Field(default=None, max_length=10000)


class ResumeVersionIn(Input):
    name: str = Field(default="Tailored resume", min_length=1, max_length=200)
    content: dict
    fit_score: float | None = Field(default=None, ge=0, le=100)


class CoverIn(Input):
    content: str = Field(min_length=1, max_length=30000)


class OutcomeIn(Input):
    rejection_stage: Stage | None = None
    reason_category: str | None = None
    reason_known: bool = False
    notes: str | None = Field(default=None, max_length=10000)


class WeightsIn(Input):
    weights: dict[str, float]
    reason: str = Field(min_length=1, max_length=2000)

    @field_validator("weights")
    @classmethod
    def weights_total(cls, w):
        if (
            not w
            or any(v < 0 or v > 100 for v in w.values())
            or abs(sum(w.values()) - 100) > 0.0001
        ):
            raise ValueError("Weights must be between 0 and 100 and total 100.")
        return w


class DraftIn(Input):
    content: dict
    revision: int = Field(ge=0)
