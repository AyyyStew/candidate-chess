import tomllib
import os

from celery import Celery

_config_path = os.environ.get("PIPELINE_CONFIG", os.path.join(os.path.dirname(__file__), "..", "config.toml"))

with open(_config_path, "rb") as f:
    config = tomllib.load(f)

redis_host = os.environ.get("REDIS_HOST", config["redis"]["host"])
redis_url = f"redis://{redis_host}:{config['redis']['port']}/0"

app = Celery(
    "pipeline",
    broker=redis_url,
    backend=redis_url,
    include=["service.tasks"],
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
