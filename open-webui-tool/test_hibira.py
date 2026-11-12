"""Tests hibira.py against a fake Hibira: python -m unittest (needs pydantic)."""

import asyncio
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from hibira import Tools

CALLS = []
APPROVAL = {"polls": 0}


class Fake(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, body):
        b = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n)) if n else None

    def do_GET(self):
        CALLS.append(("GET", self.path, self.headers["Authorization"], None))
        if self.path.startswith("/v1/conversations?"):
            return self.reply(200, {"data": [{"id": "c_1", "visitor": {"name": "Ann"}, "last_preview": "Where is my order?", "team_id": ""}]})
        if self.path == "/v1/conversations/c_1":
            return self.reply(200, {"conversation": {"id": "c_1"}, "messages": [{"from": "visitor", "text": "hi", "internal": False}]})
        if self.path == "/v1/agents":
            return self.reply(200, {"data": [{"id": "ag_1", "name": "Bo", "email": "bo@example.com"}]})
        self.reply(404, {"error": "no such endpoint", "code": "not_found"})

    def do_POST(self):
        body = self.body()
        CALLS.append(("POST", self.path, self.headers["Authorization"], body))
        if self.path == "/mcp":
            name, args = body["params"]["name"], body["params"]["arguments"]
            if name == "send_push":
                out = {"publish_id": "pub_1"}
            elif name == "request_approval":
                out = {"approval_id": "apr_1", "status": "pending", "url": "https://hibira.io/approve/apr_1/t"}
            elif name == "get_approval":
                APPROVAL["polls"] += 1
                out = {"approval_id": "apr_1", "status": "approved" if APPROVAL["polls"] >= 2 else "pending", "choice": "Approve"}
            else:
                return self.reply(200, {"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": "unknown"}], "isError": True}})
            return self.reply(200, {"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": json.dumps(out)}], "isError": False}})
        if self.path == "/v1/conversations/c_1/messages":
            return self.reply(201, {"id": "m_1"})
        if self.path == "/v1/conversations/c_1":
            return self.reply(200, {"id": "c_1", **body})
        if self.path == "/v1/conversations/c_404/messages":
            return self.reply(404, {"error": "conversation not found", "code": "not_found"})
        self.reply(404, {"error": "no such endpoint"})


class ToolTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), Fake)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{cls.srv.server_port}"
        t = Tools()
        t.valves = Tools.Valves(hibira_token="hkb_pat_x", app_id="app_1", livechat_api_key="lck_ws.k", hibira_url=base, livechat_url=base, approval_wait_seconds=60)
        cls.tools = t

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def setUp(self):
        CALLS.clear()
        self.events = []

    async def emit(self, e):
        self.events.append(e)

    def run_(self, coro):
        return asyncio.run(coro)

    def test_list_and_read(self):
        out = json.loads(self.run_(self.tools.list_waiting_chats(limit=500, __event_emitter__=self.emit)))
        self.assertEqual(out, [{"id": "c_1", "visitor": {"name": "Ann"}, "last_preview": "Where is my order?"}])
        self.assertIn("assignee_id=none", CALLS[0][1])
        self.assertIn("limit=50", CALLS[0][1])
        self.assertEqual(CALLS[0][2], "Bearer lck_ws.k")
        out = json.loads(self.run_(self.tools.read_chat("c_1")))
        self.assertEqual(out["messages"], [{"from": "visitor", "text": "hi"}])

    def test_hand_off_to_agent(self):
        out = json.loads(self.run_(self.tools.hand_off_chat("c_1", "Wants a refund", agent="BO@example.com", team_id="tm_1")))
        self.assertEqual(out["assignee_id"], "ag_1")
        note = [c for c in CALLS if c[1].endswith("/messages")][0]
        self.assertEqual(note[3], {"text": "Handoff: Wants a refund", "internal": True})
        upd = [c for c in CALLS if c[1] == "/v1/conversations/c_1" and c[0] == "POST"][0]
        self.assertEqual(upd[3], {"team_id": "tm_1", "assignee_id": "ag_1"})

    def test_hand_off_queue_and_errors(self):
        out = json.loads(self.run_(self.tools.hand_off_chat("c_1", "x")))
        self.assertIn("unassigned queue", out["result"])
        self.assertFalse([c for c in CALLS if c[1] == "/v1/conversations/c_1" and c[0] == "POST"])
        self.assertTrue(self.run_(self.tools.hand_off_chat("c_1", "x", agent="nobody")).startswith("Error: no agent called nobody"))
        self.assertEqual(self.run_(self.tools.hand_off_chat("c_404", "x")), "Error: HTTP 404: conversation not found")

    def test_push(self):
        self.assertTrue(self.run_(self.tools.send_push("Hi", "There")).startswith("Error"))
        out = json.loads(self.run_(self.tools.send_push("Hi", "There", interests="orders, user-1")))
        self.assertEqual(out, {"publish_id": "pub_1"})
        args = CALLS[-1][3]["params"]["arguments"]
        self.assertEqual(args, {"title": "Hi", "body": "There", "interests": ["orders", "user-1"], "app_id": "app_1"})
        self.assertEqual(CALLS[-1][2], "Bearer hkb_pat_x")

    def test_approval_waits(self):
        APPROVAL["polls"] = 0
        out = json.loads(self.run_(self.tools.ask_for_approval("Refund $89?", options="Refund, Keep", notify_users="u1", __event_emitter__=self.emit)))
        self.assertEqual(out["status"], "approved")
        self.assertEqual(out["choice"], "Approve")
        req = CALLS[0][3]["params"]["arguments"]
        self.assertEqual(req["options"], ["Refund", "Keep"])
        self.assertEqual(req["push_users"], ["u1"])
        self.assertTrue(any("https://hibira.io/approve/apr_1/t" in json.dumps(e) for e in self.events))

    def test_approval_timeout_and_missing_valves(self):
        t = Tools()
        t.valves = self.tools.valves.model_copy(update={"approval_wait_seconds": 0})
        APPROVAL["polls"] = 0
        out = json.loads(self.run_(t.ask_for_approval("Delete?")))
        self.assertEqual(out["status"], "pending")
        self.assertIn("check_approval", out["next"])
        self.assertIn("app_id", self.run_(Tools().send_push("a", "b", users="u")))
        self.assertIn("hibira_token", self.run_(Tools().check_approval("apr_1")))
        self.assertIn("livechat_api_key", self.run_(Tools().read_chat("c_1")))


if __name__ == "__main__":
    unittest.main()
