from typing import Any

from fastapi import HTTPException


def ok(data: Any = None, message: str = "ok") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


def abort(status_code: int, message: str) -> None:
    raise HTTPException(status_code=status_code, detail=message)
