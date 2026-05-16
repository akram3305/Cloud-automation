from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session

from database import get_db
from models.request import Request
from models.request_comment import RequestComment
from routers.auth import get_current_user

router = APIRouter(tags=["comments"])


class CommentIn(BaseModel):
    text: constr(min_length=1, max_length=2000)


@router.get("/requests/{req_id}/comments")
def list_comments(
    req_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if not db.query(Request).filter(Request.id == req_id).first():
        raise HTTPException(404, "Request not found")
    rows = (
        db.query(RequestComment)
        .filter(RequestComment.request_id == req_id)
        .order_by(RequestComment.created_at)
        .all()
    )
    return [
        {
            "id":         c.id,
            "request_id": c.request_id,
            "author":     c.author,
            "text":       c.text,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in rows
    ]


@router.post("/requests/{req_id}/comments", status_code=201)
def add_comment(
    req_id: int,
    body: CommentIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not db.query(Request).filter(Request.id == req_id).first():
        raise HTTPException(404, "Request not found")
    comment = RequestComment(
        request_id=req_id,
        author=current_user.username,
        text=body.text.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id":         comment.id,
        "request_id": comment.request_id,
        "author":     comment.author,
        "text":       comment.text,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }
