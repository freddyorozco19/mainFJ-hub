# -*- coding: utf-8 -*-
"""Backlog / Task Management — CRUD con Supabase PostgreSQL."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.supabase_client import get_supabase
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/backlog", tags=["backlog"])

STATUSES = ["backlog", "in_progress", "review", "done"]
PRIORITIES = ["low", "medium", "high", "critical"]


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "backlog"
    priority: str = "medium"
    project: str = ""
    sprint: str = ""
    tags: str = ""
    due_date: str = ""


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    project: Optional[str] = None
    sprint: Optional[str] = None
    tags: Optional[str] = None
    due_date: Optional[str] = None


class SubtaskCreate(BaseModel):
    title: str


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None


def _task_with_subtasks(task: dict) -> dict:
    sb = get_supabase()
    subs = sb.table("backlog_subtasks").select("*").eq("task_id", task["id"]).order("id").execute()
    task["subtasks"] = subs.data or []
    return task


# ── TASKS ─────────────────────────────────────────────────────────────────────

@router.get("/tasks")
def list_tasks(current_user = Depends(get_current_user),
               status: str = "", project: str = "", sprint: str = "",
               priority: str = "", search: str = "", limit: int = 200):
    sb = get_supabase()
    q = sb.table("backlog_tasks").select("*")

    if status:   q = q.eq("status", status)
    if project:  q = q.eq("project", project)
    if sprint:   q = q.eq("sprint", sprint)
    if priority: q = q.eq("priority", priority)
    if search:
        q = q.or_(f"title.ilike.%{search}%,description.ilike.%{search}%,tags.ilike.%{search}%")

    q = q.order("updated_at", desc=True).limit(limit)
    resp = q.execute()

    tasks = []
    for t in (resp.data or []):
        tasks.append(_task_with_subtasks(t))
    return tasks


@router.get("/tasks/{task_id}")
def get_task(task_id: int, current_user = Depends(get_current_user)):
    sb = get_supabase()
    resp = sb.table("backlog_tasks").select("*").eq("id", task_id).execute()
    if not resp.data:
        raise HTTPException(404, "Tarea no encontrada")
    return _task_with_subtasks(resp.data[0])


@router.post("/tasks")
def create_task(req: TaskCreate, current_user = Depends(get_current_user)):
    if req.status not in STATUSES:
        raise HTTPException(400, f"Status invalido: {req.status}")
    if req.priority not in PRIORITIES:
        raise HTTPException(400, f"Priority invalida: {req.priority}")
    sb = get_supabase()
    resp = sb.table("backlog_tasks").insert({
        "title": req.title, "description": req.description,
        "status": req.status, "priority": req.priority,
        "project": req.project, "sprint": req.sprint,
        "tags": req.tags, "due_date": req.due_date,
    }).execute()
    task_id = resp.data[0]["id"]
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
    if req.project is not None:     updates["project"] = req.project
    if req.sprint is not None:      updates["sprint"] = req.sprint
    if req.tags is not None:        updates["tags"] = req.tags
    if req.due_date is not None:    updates["due_date"] = req.due_date
    if not updates:
        raise HTTPException(400, "Nada que actualizar")

    updates["updated_at"] = "now()"
    sb = get_supabase()
    sb.table("backlog_tasks").update(updates).eq("id", task_id).execute()
    return get_task(task_id, current_user)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, current_user = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("backlog_tasks").delete().eq("id", task_id).execute()
    return {"deleted": True, "id": task_id}


# ── SUBTASKS ──────────────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/subtasks")
def create_subtask(task_id: int, req: SubtaskCreate, current_user = Depends(get_current_user)):
    sb = get_supabase()
    resp = sb.table("backlog_subtasks").insert({"task_id": task_id, "title": req.title}).execute()
    sub = resp.data[0]
    return {"id": sub["id"], "task_id": task_id, "title": req.title, "done": False}


@router.put("/subtasks/{subtask_id}")
def update_subtask(subtask_id: int, req: SubtaskUpdate, current_user = Depends(get_current_user)):
    updates = {}
    if req.title is not None: updates["title"] = req.title
    if req.done is not None:  updates["done"] = req.done
    if not updates:
        raise HTTPException(400, "Nada que actualizar")
    sb = get_supabase()
    sb.table("backlog_subtasks").update(updates).eq("id", subtask_id).execute()
    return {"updated": True, "id": subtask_id}


@router.delete("/subtasks/{subtask_id}")
def delete_subtask(subtask_id: int, current_user = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("backlog_subtasks").delete().eq("id", subtask_id).execute()
    return {"deleted": True, "id": subtask_id}


# ── SPRINTS / PROJECTS ────────────────────────────────────────────────────────

@router.get("/projects")
def list_projects(current_user = Depends(get_current_user)):
    sb = get_supabase()
    resp = sb.table("backlog_tasks").select("project").neq("project", "").execute()
    projects = list(set(r["project"] for r in (resp.data or [])))
    projects.sort()
    return projects


@router.get("/sprints")
def list_sprints(current_user = Depends(get_current_user)):
    sb = get_supabase()
    resp = sb.table("backlog_tasks").select("sprint").neq("sprint", "").execute()
    sprints = list(set(r["sprint"] for r in (resp.data or [])))
    sprints.sort(reverse=True)
    return sprints