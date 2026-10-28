"""Tests the agent once, then logs and registers it to Unity Catalog.

On the serving endpoint the agent authenticates as fleet-agent-sp (see agent.py),
so no automatic-passthrough `resources` are declared.
"""
import sys

import mlflow

agent_file, experiment_name, catalog = sys.argv[1:4]
model_name = f"{catalog}.ai.fleet_agent"

mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment(experiment_name)

# 1. Quick test before registering
sys.path.insert(0, agent_file.rsplit("/", 1)[0])
from agent import FleetAgent  # noqa: E402
from mlflow.types.responses import ResponsesAgentRequest  # noqa: E402

test = {"input": [{"role": "user", "content": "Which machines in the East region need attention?"}]}
answer = FleetAgent().predict(ResponsesAgentRequest(**test)).model_dump()
print(answer["output"][0]["content"][0]["text"])

# 2. Log + register
with mlflow.start_run(run_name="fleet-agent"):
    info = mlflow.pyfunc.log_model(
        name="agent",
        python_model=agent_file,
        input_example=test,
        registered_model_name=model_name,
        pip_requirements=["mlflow>=3.17", "databricks-sdk", "openai"],
    )
print(f"Registered {model_name} version {info.registered_model_version}")
