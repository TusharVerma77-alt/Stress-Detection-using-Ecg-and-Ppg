"""
multi_agent.py — Biomedical Expert Agent (LLM-backed).

Replaces the former Router / Clinical / Technical sub-agents with a single
LLM-driven expert that answers any question about ECG, PPG, HRV,
physiological stress detection, and the WESAD ML pipeline in real time. When
live dashboard context (Predicted Class, SHAP biomarkers) is supplied, it is
injected into the prompt so the answer is personalized to the current patient.

Provider-agnostic: works with Groq (default, OpenAI-compatible) or OpenAI.
  • API key   → GROQ_API_KEY, else OPENAI_API_KEY
  • Endpoint  → LLM_BASE_URL, else Groq if a Groq key is set, else OpenAI
  • Model     → LLM_MODEL, else a per-provider default
"""
from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv
from openai import AsyncOpenAI

from ..schemas import ChatContext

logger = logging.getLogger(__name__)

# Load the API key (and friends) from backend/.env if present.
load_dotenv()

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
CHAT_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "25"))

# Exact system prompt for the Biomedical Expert Agent.
BIOMEDICAL_SYSTEM_PROMPT = (
    "You are an expert AI biomedical engineer and clinical analyst specializing in ECG "
    "(Electrocardiogram), PPG (Photoplethysmogram), Heart Rate Variability (HRV), and "
    "physiological stress detection. Answer the user's questions accurately and "
    "professionally. If the user provides live dashboard context (like Predicted Class or "
    "SHAP biomarkers), use it to personalize your answer. If the user asks about a topic "
    "completely unrelated to ECG, PPG, machine learning, or stress, politely decline and "
    "steer the conversation back to physiological monitoring."
)


class AgentUnavailableError(RuntimeError):
    """Raised when the LLM cannot be used (e.g., the API key is missing)."""


class BiomedicalExpertAgent:
    """One agent that replaces the old Router / Clinical / Technical trio."""

    def __init__(self) -> None:
        self._client: AsyncOpenAI | None = None

    # ── configuration ────────────────────────────────────────────────────

    @staticmethod
    def _resolve_key() -> str | None:
        """Prefer a Groq key; fall back to OpenAI."""
        return os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")

    @staticmethod
    def _using_groq() -> bool:
        return bool(os.getenv("GROQ_API_KEY"))

    def _resolve_base_url(self) -> str | None:
        """Explicit LLM_BASE_URL wins; else Groq when a Groq key is set; else OpenAI."""
        if os.getenv("LLM_BASE_URL"):
            return os.getenv("LLM_BASE_URL")
        if self._using_groq():
            return GROQ_BASE_URL
        return None  # AsyncOpenAI default → api.openai.com

    @property
    def model(self) -> str:
        """LLM_MODEL override, else a per-provider default."""
        if os.getenv("LLM_MODEL"):
            return os.getenv("LLM_MODEL")
        if self._using_groq():
            return "llama-3.3-70b-versatile"
        return "gpt-4o-mini"

    # ── availability ─────────────────────────────────────────────────────

    @property
    def available(self) -> bool:
        """True when an API key is present, so the client can be built."""
        return bool(self._resolve_key())

    def _get_client(self) -> AsyncOpenAI:
        """Lazily build the shared AsyncOpenAI client (no network on init)."""
        api_key = self._resolve_key()
        if not api_key:
            raise AgentUnavailableError(
                "The AI assistant is not configured: no LLM API key found. "
                "Set GROQ_API_KEY (or OPENAI_API_KEY) in backend/.env "
                "(see backend/.env.example) or in the environment."
            )
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=api_key,
                base_url=self._resolve_base_url(),
                timeout=CHAT_TIMEOUT_SECONDS,
                max_retries=1,
            )
            logger.info(
                "LLM client ready (provider=%s, model=%s)",
                "groq" if self._using_groq() else "openai",
                self.model,
            )
        return self._client

    # ── prompt building ──────────────────────────────────────────────────

    @staticmethod
    def _format_context(ctx: ChatContext | None) -> str:
        """Render the live dashboard snapshot as a readable context block."""
        if ctx is None:
            return ""
        parts = [
            f"- Predicted class: {ctx.prediction}",
            (
                f"- Confidence: {ctx.confidence * 100:.1f}%"
                if ctx.confidence is not None
                else "- Confidence: n/a"
            ),
            (
                f"- Top SHAP biomarker: {ctx.top_feature}"
                if ctx.top_feature
                else "- Top SHAP biomarker: n/a"
            ),
            (
                f"- SHAP value: {ctx.shap_value:.4f}"
                if ctx.shap_value is not None
                else ""
            ),
            (
                f"- SHAP importance: {ctx.importance * 100:.1f}%"
                if ctx.importance is not None
                else ""
            ),
        ]
        return "\n".join(p for p in parts if p.strip())

    def _build_user_prompt(self, message: str, ctx: ChatContext | None) -> str:
        lines = [f"User question: {message}"]
        context_block = self._format_context(ctx)
        if context_block:
            lines.extend(
                [
                    "\nLive dashboard context from the WESAD stress monitor:",
                    context_block,
                    "\nUse this context to personalize your answer.",
                ]
            )
        return "\n".join(lines)

    # ── inference ────────────────────────────────────────────────────────

    async def respond(self, message: str, context: ChatContext | None = None) -> str:
        """
        Send the user's message (plus optional dashboard context) to the LLM
        and return its reply. Raises AgentUnavailableError, asyncio.TimeoutError,
        or an openai API error — callers translate those into HTTP responses.
        """
        client = self._get_client()
        user_prompt = self._build_user_prompt(message, context)

        completion = await asyncio.wait_for(
            client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": BIOMEDICAL_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=512,
                temperature=0.3,
            ),
            timeout=CHAT_TIMEOUT_SECONDS,
        )

        text = (completion.choices[0].message.content or "").strip()
        if not text:
            raise RuntimeError("The model returned an empty response.")
        return text


# Singleton — built lazily so a missing API key never crashes startup.
_agent: BiomedicalExpertAgent | None = None


def get_agent() -> BiomedicalExpertAgent:
    """Return the shared BiomedicalExpertAgent (mirrors get_bundle())."""
    global _agent  # noqa: PLW0603
    if _agent is None:
        _agent = BiomedicalExpertAgent()
    return _agent
