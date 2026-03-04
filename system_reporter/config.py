import os

REDIS_HOST = os.environ.get("SYSTEM_REPORTER_REDIS_HOST", "10.0.0.3")
REDIS_PORT = int(os.environ.get("SYSTEM_REPORTER_REDIS_PORT", "6379"))
REDIS_DB = int(os.environ.get("SYSTEM_REPORTER_REDIS_DB", "0"))
COLLECTION_INTERVAL = int(os.environ.get("SYSTEM_REPORTER_INTERVAL", "30"))
REDIS_TTL = int(os.environ.get("SYSTEM_REPORTER_TTL", "60"))
TOP_N_PROCESSES = 10
