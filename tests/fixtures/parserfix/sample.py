"""Module docstring for the parser-fix equivalence fixture."""
import os
from typing import List, Optional


def top_level(a: int, b: int = 2) -> int:
    """Add two numbers."""
    return a + b


async def fetch(url: str) -> Optional[str]:
    """Fetch a url asynchronously."""
    return None


class Widget:
    """A widget."""

    count = 0

    def __init__(self, name: str):
        self.name = name

    @property
    def label(self) -> str:
        """The widget label."""
        return self.name.upper()

    @staticmethod
    def make(name):
        return Widget(name)

    @classmethod
    def default(cls):
        return cls("default")

    def render(self, items: List[str]) -> str:
        def inner(x):
            return f"<{x}>"
        return "".join(inner(i) for i in items)


def decorator(fn):
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)
    return wrapper


@decorator
def decorated(path):
    """Decorated function."""
    return os.path.basename(path)
