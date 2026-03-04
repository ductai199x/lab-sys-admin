import json
import logging
import socket

import redis

logger = logging.getLogger(__name__)


class RedisPublisher:
    def __init__(self, host, port, db):
        self._host = host
        self._port = port
        self._db = db
        self._client = None

    def _connect(self):
        if self._client is None:
            self._client = redis.Redis(
                host=self._host,
                port=self._port,
                db=self._db,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
            )

    def publish(self, data, ttl):
        hostname = socket.gethostname()
        key = f"machine:{hostname}"
        try:
            self._connect()
            self._client.setex(key, ttl, json.dumps(data))
            logger.info("Published to %s (TTL=%ds)", key, ttl)
        except Exception as e:
            logger.error("Failed to publish to Redis: %s", e)
            self._client = None
            raise
