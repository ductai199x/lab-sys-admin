#!/usr/bin/env python3
"""system_reporter agent -- collects system metrics and pushes to Redis."""

import logging
import socket
import time
from datetime import datetime, timezone

from system_reporter.collectors.cpu import collect_cpu
from system_reporter.collectors.disk import collect_disk
from system_reporter.collectors.gpu import collect_gpu
from system_reporter.collectors.processes import collect_processes
from system_reporter.collectors.ram import collect_ram
from system_reporter.config import (
    COLLECTION_INTERVAL,
    REDIS_DB,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_TTL,
    TOP_N_PROCESSES,
)
from system_reporter.publisher import RedisPublisher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("system_reporter")


def collect_all():
    return {
        "hostname": socket.gethostname(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gpu": collect_gpu(),
        "cpu": collect_cpu(),
        "ram": collect_ram(),
        "disk": collect_disk(),
        "processes": collect_processes(TOP_N_PROCESSES),
    }


def main():
    publisher = RedisPublisher(REDIS_HOST, REDIS_PORT, REDIS_DB)
    logger.info("Starting system_reporter on %s", socket.gethostname())
    logger.info(
        "Redis: %s:%s/%s, Interval: %ds, TTL: %ds",
        REDIS_HOST, REDIS_PORT, REDIS_DB, COLLECTION_INTERVAL, REDIS_TTL,
    )

    while True:
        start = time.monotonic()
        try:
            data = collect_all()
            publisher.publish(data, REDIS_TTL)
        except Exception:
            logger.exception("Collection/publish cycle failed")
        elapsed = time.monotonic() - start
        time.sleep(max(0, COLLECTION_INTERVAL - elapsed))


if __name__ == "__main__":
    main()
