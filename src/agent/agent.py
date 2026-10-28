"""Fleet assistant: a small tool-calling agent.

- LLM calls go through the Unity Gateway model service fleet_demo.ai.fleet_llm
  (routing + fallback, rate limits, guardrails, budgets, inference table).
- Tools are Unity Catalog SQL functions over gold, run on the SQL warehouse.
"""
import json
import os
import uuid

import mlflow
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementParameterListItem
from mlflow.pyfunc import ResponsesAgent
from mlflow.types.responses import ResponsesAgentRequest, ResponsesAgentResponse
from openai import OpenAI

MODEL_SERVICE = "fleet_demo.ai.fleet_llm"
WAREHOUSE_ID = "a48a93926450f95e"

SYSTEM_PROMPT = (
    "You are the fleet assistant for service engineers. "
    "Use the tools to look up excavator health; never invent data. "
    "Health rules: Critical = hydraulic temperature above 95 °C; Watch = above 80 °C or 2+ faults. "
    "Answer briefly and suggest a next step, e.g. raising a service ticket for Critical machines."
)

TOOLS = [
    {"type": "function", "function": {
        "name": "get_machine_health",
        "description": "Latest condition of one excavator.",
        "parameters": {"type": "object", "properties": {
            "machine_id": {"type": "string", "description": "Machine ID, e.g. EX-007"}},
            "required": ["machine_id"]}}},
    {"type": "function", "function": {
        "name": "list_machines_needing_attention",
        "description": "Machines in Critical or Watch condition, most urgent first.",
        "parameters": {"type": "object", "properties": {
            "region": {"type": "string", "description": "Optional region: North, South, East or West"}}}}},
]

# Tool name → (SQL calling the UC function, argument name in the tool call)
TOOL_SQL = {
    "get_machine_health": ("SELECT * FROM fleet_demo.ai.get_machine_health(:value)", "machine_id"),
    "list_machines_needing_attention": ("SELECT * FROM fleet_demo.ai.list_machines_needing_attention(:value)", "region"),
}


def _workspace_client() -> WorkspaceClient:
    """On the serving endpoint: the agent's own service principal (OAuth M2M).
    Elsewhere (e.g. the build job's test): whoever is running the code."""
    if os.environ.get("AGENT_CLIENT_ID"):
        return WorkspaceClient(
            host=os.environ["AGENT_HOST"],
            client_id=os.environ["AGENT_CLIENT_ID"],
            client_secret=os.environ["AGENT_CLIENT_SECRET"],
            auth_type="oauth-m2m",
        )
    return WorkspaceClient()


def _text(content):
    """Content can be a string or a list of parts (e.g. reasoning + text); keep only the text parts."""
    if isinstance(content, str):
        return content
    return "".join(p.get("text", "") for p in content or [] if p.get("type") in ("text", "input_text", "output_text"))


class FleetAgent(ResponsesAgent):
    def _run_tool(self, w: WorkspaceClient, name: str, args: dict) -> str:
        sql, arg = TOOL_SQL[name]
        result = w.statement_execution.execute_statement(
            warehouse_id=WAREHOUSE_ID, statement=sql, wait_timeout="30s",
            parameters=[StatementParameterListItem(name="value", value=args.get(arg))],
        )
        columns = [c.name for c in result.manifest.schema.columns]
        rows = (result.result.data_array if result.result else None) or []
        return json.dumps([dict(zip(columns, row)) for row in rows])

    def predict(self, request: ResponsesAgentRequest) -> ResponsesAgentResponse:
        w = _workspace_client()
        token = w.config.authenticate()["Authorization"].split(" ", 1)[1]
        llm = OpenAI(base_url=f"{w.config.host}/ai-gateway/mlflow/v1", api_key=token)

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages += [{"role": m.role, "content": _text(m.content)} for m in request.input]

        for _ in range(5):  # at most 5 tool rounds
            response = llm.chat.completions.create(model=MODEL_SERVICE, messages=messages, tools=TOOLS)
            message = response.choices[0].message
            if not message.tool_calls:
                break
            messages.append(message.model_dump(exclude_none=True))
            for call in message.tool_calls:
                output = self._run_tool(w, call.function.name, json.loads(call.function.arguments or "{}"))
                messages.append({"role": "tool", "tool_call_id": call.id, "content": output})

        # A guardrail block returns HTTP 200 with the policy's message as the answer,
        # plus a top-level `databricks_service_policy` object explaining why.
        answer = _text(message.content)
        policy = (response.model_extra or {}).get("databricks_service_policy")
        if policy:
            answer += f"\n\n(Blocked by Unity Gateway policy: {policy})"

        return ResponsesAgentResponse(output=[self.create_text_output_item(text=answer, id=str(uuid.uuid4()))])


mlflow.models.set_model(FleetAgent())
