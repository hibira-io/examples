"""
title: Hibira
author: Hibira
author_url: https://hibira.io
git_url: https://github.com/hibira-io/examples/tree/main/open-webui-tool
description: Hand Hibira Live Chat conversations to a person, send push notifications, and ask a person to approve before the model acts.
required_open_webui_version: 0.5.0
version: 0.1.0
license: MIT
"""

import asyncio
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Awaitable, Callable, Optional

from pydantic import BaseModel, Field

Emitter = Optional[Callable[[dict], Awaitable[None]]]

# get_approval waits at most this long per call; the tool calls it again
# until the person answers or approval_wait_seconds runs out.
_MAX_SERVER_WAIT = 25


class HibiraError(Exception):
    pass


def _split(value: str) -> list:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


def _request(method: str, url: str, token: str, body: Any = None, timeout: float = 40) -> Any:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "hibira-open-webui-tool/0.1.0")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        try:
            detail = json.loads(detail).get("error") or detail
        except (ValueError, AttributeError):
            pass
        raise HibiraError(f"HTTP {e.code}: {detail}") from None
    except urllib.error.URLError as e:
        raise HibiraError(f"Could not reach {url}: {e.reason}") from None
    return json.loads(raw) if raw else None


class Tools:
    class Valves(BaseModel):
        hibira_token: str = Field(
            default="",
            description="Hibira personal access token (hkb_pat_...) with read and write access, from hibira.io → API tokens. Used for push and approvals.",
        )
        app_id: str = Field(
            default="",
            description="The Hibira app to send push notifications and approvals through (app_...). Push must be turned on for the app.",
        )
        livechat_api_key: str = Field(
            default="",
            description="Hibira Live Chat workspace API key with write access (Team plan and up), from Live Chat → Settings → API keys. Used for handoff.",
        )
        approval_wait_seconds: int = Field(
            default=300,
            description="How long ask_for_approval waits for the answer before returning (the request stays open; check_approval reads it later).",
        )
        hibira_url: str = Field(default="https://hibira.io", description="Hibira base URL.")
        livechat_url: str = Field(default="https://chat.hibira.io", description="Hibira Live Chat base URL.")

    def __init__(self):
        self.valves = self.Valves()

    # Hibira MCP server (push, approvals): stateless JSON-RPC over HTTP.

    async def _tool(self, name: str, arguments: dict, timeout: float = 40) -> dict:
        if not self.valves.hibira_token:
            raise HibiraError("Set the hibira_token valve to a Hibira personal access token first.")
        body = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}}
        url = self.valves.hibira_url.rstrip("/") + "/mcp"
        res = await asyncio.to_thread(_request, "POST", url, self.valves.hibira_token, body, timeout)
        if res.get("error"):
            raise HibiraError(res["error"].get("message", "MCP error"))
        result = res.get("result") or {}
        text = "".join(c.get("text", "") for c in result.get("content", []))
        if result.get("isError"):
            raise HibiraError(text)
        try:
            return json.loads(text)
        except ValueError:
            return {"text": text}

    def _app(self) -> str:
        if not self.valves.app_id:
            raise HibiraError("Set the app_id valve to the Hibira app ID (app_...) first.")
        return self.valves.app_id

    # Live Chat REST API (handoff).

    async def _chat(self, method: str, path: str, body: Any = None) -> Any:
        if not self.valves.livechat_api_key:
            raise HibiraError("Set the livechat_api_key valve to a Live Chat workspace API key first.")
        url = self.valves.livechat_url.rstrip("/") + "/v1" + path
        return await asyncio.to_thread(_request, method, url, self.valves.livechat_api_key, body)

    @staticmethod
    async def _status(emit: Emitter, text: str, done: bool = False) -> None:
        if emit:
            await emit({"type": "status", "data": {"description": text, "done": done}})

    async def list_waiting_chats(self, limit: int = 10, __event_emitter__: Emitter = None) -> str:
        """
        List open Hibira Live Chat conversations that no person has picked up yet, newest first.
        :param limit: How many to list, 1 to 50.
        :return: The conversations as JSON: id, visitor, team, last message and when the visitor started waiting.
        """
        try:
            q = urllib.parse.urlencode({"status": "open", "assignee_id": "none", "limit": max(1, min(int(limit), 50))})
            res = await self._chat("GET", "/conversations?" + q)
        except HibiraError as e:
            return f"Error: {e}"
        keep = ("id", "visitor", "team_id", "last_preview", "last_from", "last_message_at", "waiting_since", "created_at")
        rows = [{k: c.get(k) for k in keep if c.get(k) not in (None, "")} for c in res.get("data", [])]
        await self._status(__event_emitter__, f"{len(rows)} waiting chat(s)", True)
        return json.dumps(rows, ensure_ascii=False, default=str)

    async def read_chat(self, conversation_id: str) -> str:
        """
        Read one Hibira Live Chat conversation and its latest messages (internal notes included).
        :param conversation_id: The conversation ID (c_...).
        :return: The conversation and its messages as JSON.
        """
        try:
            res = await self._chat("GET", "/conversations/" + urllib.parse.quote(conversation_id, safe=""))
        except HibiraError as e:
            return f"Error: {e}"
        msgs = [
            {k: m.get(k) for k in ("from", "name", "text", "internal", "created_at") if m.get(k) not in (None, "", False)}
            for m in res.get("messages", [])
        ]
        return json.dumps({"conversation": res.get("conversation"), "messages": msgs}, ensure_ascii=False, default=str)

    async def hand_off_chat(
        self,
        conversation_id: str,
        summary: str,
        agent: str = "",
        team_id: str = "",
        __event_emitter__: Emitter = None,
    ) -> str:
        """
        Hand a Hibira Live Chat conversation to a person: leave an internal note with your summary (the visitor does not see it), then assign it to an agent or move it to a team. With neither, it stays in the unassigned queue with the note.
        :param conversation_id: The conversation ID (c_...).
        :param summary: What the visitor needs and what has been tried, for the person who takes over.
        :param agent: Optional agent to assign, by email or name.
        :param team_id: Optional team ID to move the conversation to.
        :return: Who now has the conversation, or an error.
        """
        cid = urllib.parse.quote(conversation_id, safe="")
        try:
            agent_id = ""
            if agent:
                agents = (await self._chat("GET", "/agents")).get("data", [])
                want = agent.strip().lower()
                match = [a for a in agents if want in ((a.get("email") or "").lower(), (a.get("name") or "").lower())]
                if not match:
                    names = ", ".join(f"{a.get('name')} <{a.get('email')}>" for a in agents if not a.get("invited"))
                    return f"Error: no agent called {agent}. Agents: {names}"
                agent_id = match[0]["id"]
            await self._chat("POST", f"/conversations/{cid}/messages", {"text": "Handoff: " + summary.strip(), "internal": True})
            update = {}
            if team_id:
                update["team_id"] = team_id
            if agent_id:
                update["assignee_id"] = agent_id
            conv = await self._chat("POST", f"/conversations/{cid}", update) if update else None
        except HibiraError as e:
            return f"Error: {e}"
        if agent_id:
            who = f"assigned to {match[0].get('name') or match[0].get('email')}"
        elif team_id:
            who = f"moved to team {team_id}"
        else:
            who = "left in the unassigned queue"
        await self._status(__event_emitter__, f"Chat {conversation_id} {who}", True)
        out = {"conversation_id": conversation_id, "result": f"Note added and {who}."}
        if conv:
            out["assignee_id"] = conv.get("assignee_id")
            out["team_id"] = conv.get("team_id")
        return json.dumps(out, ensure_ascii=False)

    async def send_push(
        self,
        title: str,
        body: str,
        interests: str = "",
        users: str = "",
        url: str = "",
        __event_emitter__: Emitter = None,
    ) -> str:
        """
        Send a push notification through Hibira Push to devices subscribed to interests, or to signed-in user IDs.
        :param title: Notification title.
        :param body: Notification text.
        :param interests: Comma-separated interests, such as orders,user-42.
        :param users: Comma-separated user IDs, instead of interests.
        :param url: Optional https link opened when the notification is tapped.
        :return: The send result from Hibira, or an error.
        """
        args = {"title": title, "body": body}
        if _split(interests):
            args["interests"] = _split(interests)
        if _split(users):
            args["users"] = _split(users)
        if url:
            args["url"] = url
        if "interests" not in args and "users" not in args:
            return "Error: give interests or users to send to."
        try:
            args["app_id"] = self._app()
            res = await self._tool("send_push", args)
        except HibiraError as e:
            return f"Error: {e}"
        await self._status(__event_emitter__, "Push notification sent", True)
        return json.dumps(res, ensure_ascii=False)

    async def ask_for_approval(
        self,
        question: str,
        details: str = "",
        options: str = "",
        notify_interests: str = "",
        notify_users: str = "",
        __event_emitter__: Emitter = None,
    ) -> str:
        """
        Ask a person to approve or choose before you act, and wait for the answer. Call this before anything risky or irreversible (refunds, deletes, sending messages to customers). The person answers on a Hibira page; the link is shown in the chat, and can also go out as a push notification.
        :param question: The decision, as a short question, such as "Refund order #1042 for $89?"
        :param details: What you want to do and why.
        :param options: Optional comma-separated choices (2 to 4); the first one approves. Default: Approve, Reject.
        :param notify_interests: Optional comma-separated push interests to send the link to.
        :param notify_users: Optional comma-separated push user IDs to send the link to.
        :return: approved, rejected, expired or still pending, with the choice and any comment.
        """
        args = {"title": question[:200]}
        if details:
            args["details"] = details[:4000]
        if len(_split(options)) >= 2:
            args["options"] = _split(options)[:4]
        if _split(notify_interests):
            args["push_interests"] = _split(notify_interests)
        if _split(notify_users):
            args["push_users"] = _split(notify_users)
        try:
            args["app_id"] = self._app()
            req = await self._tool("request_approval", args)
        except HibiraError as e:
            return f"Error: {e}"
        approval_id, link = req.get("approval_id"), req.get("url")
        if __event_emitter__ and link:
            await __event_emitter__(
                {"type": "message", "data": {"content": f"\n\n**Waiting for approval:** [{question}]({link})\n\n"}}
            )
        await self._status(__event_emitter__, "Waiting for a person to answer…")
        deadline = time.monotonic() + max(0, self.valves.approval_wait_seconds)
        res = req
        try:
            while res.get("status") == "pending":
                left = int(deadline - time.monotonic())
                if left <= 0:
                    break
                wait = min(_MAX_SERVER_WAIT, left)
                res = await self._tool("get_approval", {"approval_id": approval_id, "wait_seconds": wait}, timeout=wait + 15)
        except HibiraError as e:
            await self._status(__event_emitter__, "Could not read the answer", True)
            return f"Error: {e}. The request is still open: call check_approval with {approval_id}."
        status = res.get("status")
        await self._status(__event_emitter__, f"Approval: {status}", True)
        out = {k: res.get(k) for k in ("approval_id", "status", "choice", "comment") if res.get(k)}
        if status == "pending":
            out["url"] = link
            out["next"] = f"No answer yet. Do not act. Call check_approval with {approval_id} later."
        elif status == "approved":
            out["next"] = "Approved: go ahead."
        else:
            out["next"] = "Not approved: do not act. Tell the user."
        return json.dumps(out, ensure_ascii=False, default=str)

    async def check_approval(self, approval_id: str) -> str:
        """
        Read the answer to an earlier ask_for_approval request.
        :param approval_id: The approval ID (apr_...).
        :return: pending, approved, rejected or expired, with the choice and any comment.
        """
        try:
            res = await self._tool("get_approval", {"approval_id": approval_id})
        except HibiraError as e:
            return f"Error: {e}"
        return json.dumps({k: res.get(k) for k in ("approval_id", "status", "choice", "comment", "expires_at") if res.get(k)}, ensure_ascii=False, default=str)
