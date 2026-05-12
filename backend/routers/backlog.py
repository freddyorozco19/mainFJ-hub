# -*- coding: utf-8 -*-
"""Backlog / Task Management — CRUD con SQLite."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.db import get_conn
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/backlog", tags=["backlog"])

STATUSES = ["backlog", "in_progress", "review", "done"]
PRIORITIES = ["low", "medium", "high", "critical"]


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "backlog"
    priority: str = "medium"
    sprint: str = ""
    tags: str = ""
    due_date: str = ""


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    sprint: Optional[str] = None
    tags: Optional[str] = None
    due_date: Optional[str] = None


class SubtaskCreate(BaseModel):
    title: str


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None


# ── TASKS CRUD ────────────────────────────────────────────────────────────────

@router.get("/tasks")
def list_tasks(current_user = Depends(get_current_user),
               status: str = "", sprint: str = "", priority: str = "",
               search: str = "", limit: int = 200):
    q = "SELECT * FROM backlog_tasks WHERE 1=1"
    params = []
    if status:   q += " AND status=?";   params.append(status)
    if sprint:   q += " AND sprint=?";   params.append(sprint)
    if priority: q += " AND priority=?"; params.append(priority)
    if search:
        q += " AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)"
        params.extend([f"%{search}%"] * 3)
    q += " ORDER BY priority_order() DESC, updated_at DESC LIMIT ?"
    params.append(limit)

    with get_conn() as conn:
        conn.execute("""
            CREATE TEMP TABLE IF NOT EXISTS _priority_order AS
            SELECT 'critical' AS p, 4 AS o UNION ALL
            SELECT 'high', 3 UNION ALL SELECT 'medium', 2 UNION ALL SELECT 'low', 1
        """)
        conn.create_function("priority_order", 0, lambda: None)
        q = q.replace("priority_order()", "(SELECT o FROM _priority_order WHERE p = priority)")
        rows = conn.execute(q, params).fetchall()

    tasks = []
    for r in rows:
        task = dict(r)
        subtasks = []
        with get_conn() as conn:
            subs = conn.execute(
                "SELECT * FROM backlog_subtasks WHERE task_id=? ORDER BY id", (r["id"],)
            ).fetchall()
            subtasks = [dict(s) for s in subs]
        task["subtasks"] = subtasks
        tasks.append(task)

    return tasks


@router.get("/tasks/{task_id}")
def get_task(task_id: int, current_user = Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM backlog_tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Tarea no encontrada")
    task = dict(row)
    with get_conn() as conn:
        subs = conn.execute(
            "SELECT * FROM backlog_subtasks WHERE task_id=? ORDER BY id", (task_id,)
        ).fetchall()
        task["subtasks"] = [dict(s) for s in subs]
    return task


@router.post("/tasks")
def create_task(req: TaskCreate, current_user = Depends(get_current_user)):
    if req.status not in STATUSES:
        raise HTTPException(400, f"Status invalido: {req.status}")
    if req.priority not in PRIORITIES:
        raise HTTPException(400, f"Priority invalida: {req.priority}")
    now = datetime.now().isoformat()
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO backlog_tasks (title, description, status, priority, sprint, tags, due_date, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (req.title, req.description, req.status, req.priority,
             req.sprint, req.tags, req.due_date, now, now)
        )
        task_id = cur.lastrowid
    return get_task(task_id, current_user)


@router.put("/tasks/{task_id}")
def update_task(task_id: int, req: TaskUpdate, current_user = Depends(get_current_user)):
    updates = {}
    if req.title is not None:       updates["title"] = req.title
    if req.description is not None: updates["description"] = req.description
    if req.status is not None:
        if req.status not in STATUSES:
            raise HTTPException(400, f"Status invalido: {req.status}")
        updates["status"] = req.status
    if req.priority is not None:
        if req.priority not in PRIORITIES:
            raise HTTPException(400, f"Priority invalida: {req.priority}")
        updates["priority"] = req.priority
    if req.sprint is not None:      updates["sprint"] = req.sprint
    if req.tags is not None:        updates["tags"] = req.tags
    if req.due_date is not None:    updates["due_date"] = req.due_date

    if not updates:
        raise HTTPException(400, "Nada que actualizar")

    updates["updated_at"] = datetime.now().isoformat()
    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [task_id]

    with get_conn() as conn:
        conn.execute(f"UPDATE backlog_tasks SET {set_clause} WHERE id=?", values)
    return get_task(task_id, current_user)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, current_user = Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM backlog_tasks WHERE id=?", (task_id,))
    return {"deleted": True, "id": task_id}


# ── SUBTASKS CRUD ─────────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/subtasks")
def create_subtask(task_id: int, req: SubtaskCreate, current_user = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO backlog_subtasks (task_id, title) VALUES (?, ?)",
            (task_id, req.title)
        )
    return {"id": cur.lastrowid, "task_id": task_id, "title": req.title, "done": False}


@router.put("/subtasks/{subtask_id}")
def update_subtask(subtask_id: int, req: SubtaskUpdate, current_user = Depends(get_current_user)):
    updates = {}
    if req.title is not None: updates["title"] = req.title
    if req.done is not None:  updates["done"] = 1 if req.done else 0
    if not updates:
        raise HTTPException(400, "Nada que actualizar")
    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [subtask_id]
    with get_conn() as conn:
        conn.execute(f"UPDATE backlog_subtasks SET {set_clause} WHERE id=?", values)
    return {"updated": True, "id": subtask_id}


@router.delete("/subtasks/{subtask_id}")
def delete_subtask(subtask_id: int, current_user = Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM backlog_subtasks WHERE id=?", (subtask_id,))
    return {"deleted": True, "id": subtask_id}


# ── SPRINTS ───────────────────────────────────────────────────────────────────

@router.get("/sprints")
def list_sprints(current_user = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT sprint FROM backlog_tasks WHERE sprint != '' ORDER BY sprint DESC"
        ).fetchall()
    return [r["sprint"] for r in rows]