# Push-Based System Monitoring Architecture

## Overview

Replace the current Ansible-driven pull model (`role_gpu`) with a push-based agent system that provides near-real-time monitoring of GPU, CPU, RAM, Disk, and Processes across all lab machines.

```
 lab3001..lab100                             lab3001
+---------------------------+        +----------------------+
| system_reporter (systemd) |        | Redis (port 6379)    |
| - pynvml (GPU)            | -----> | key: machine:<host>  |
| - psutil (CPU/RAM/Disk)   |  push  | TTL: 60s             |
| Every 30s                 |  JSON  +----------+-----------+
+---------------------------+                   |
                                                | read
                                     +----------v-----------+
                                     | SvelteKit (Node)     |
                                     | GET /api/machines    |
                                     | reads machine:* keys |
                                     +----------+-----------+
                                                |
                                     +----------v-----------+
                                     | Browser              |
                                     | /lab-status          |
                                     | Tabs: GPU|CPU|Disk|  |
                                     | Processes            |
                                     | Auto-poll 30s        |
                                     +----------------------+
```

---

## Data Schema

Each machine pushes to Redis key `machine:<hostname>` with 60s TTL:

```json
{
  "hostname": "lab3002",
  "timestamp": "2026-03-04T14:30:00.123456",
  "gpu": {
    "available": true,
    "driver_version": "550.54.15",
    "gpus": [
      {
        "index": 0,
        "name": "NVIDIA RTX A6000",
        "memory": {
          "total_mib": 49140,
          "used_mib": 12345,
          "free_mib": 36795
        },
        "utilization": {
          "gpu_percent": 85,
          "memory_percent": 25
        },
        "temperature_c": 72,
        "clocks": {
          "graphics_mhz": 1410,
          "sm_mhz": 1410,
          "memory_mhz": 1215
        },
        "power": {
          "usage_watts": 150.5,
          "limit_watts": 300.0
        },
        "processes": [
          {
            "pid": 12345,
            "gpu_memory_mib": 8192,
            "type": "compute",
            "user": "tai",
            "command": "python train.py --model resnet50",
            "cpu_percent": 12.3,
            "ram_mib": 4096
          }
        ]
      }
    ]
  },
  "cpu": {
    "percent": 45.2,
    "per_core": [80.1, 20.3, 55.0, 10.2],
    "load_average": { "1min": 2.1, "5min": 1.8, "15min": 1.5 },
    "count_logical": 32,
    "count_physical": 16
  },
  "ram": {
    "total_mib": 128849,
    "used_mib": 65432,
    "free_mib": 32000,
    "cached_mib": 31417
  },
  "disk": {
    "partitions": [
      {
        "mountpoint": "/",
        "device": "/dev/sda1",
        "fstype": "ext4",
        "total_gib": 500.0,
        "used_gib": 250.0,
        "free_gib": 250.0,
        "percent": 50.0
      }
    ]
  },
  "processes": {
    "top_by_cpu": [
      {
        "pid": 12345,
        "user": "tai",
        "name": "python",
        "command": "python train.py --model resnet50",
        "cpu_percent": 95.2,
        "ram_mib": 4096.0
      }
    ],
    "top_by_memory": [
      {
        "pid": 12346,
        "user": "shengbang",
        "name": "python",
        "command": "python eval.py",
        "cpu_percent": 5.1,
        "ram_mib": 16384.0
      }
    ]
  }
}
```

**Design decisions:**
- Numeric values (not strings like `"24576 MiB"`) with units in field names (`_mib`, `_gib`, `_watts`, `_percent`)
- GPU processes enriched at agent time using psutil (no separate `ps` step needed)
- `gpu.available` flag handles machines without GPUs gracefully

---

## Component 1: Python Agent (`system_reporter`)

### File Structure

```
system_reporter/
    __init__.py
    agent.py            # Main daemon loop
    config.py           # Environment-based configuration
    publisher.py        # Redis publishing logic
    requirements.txt    # psutil, nvidia-ml-py, redis
    collectors/
        __init__.py
        gpu.py          # GPU collection via pynvml
        cpu.py          # CPU collection via psutil
        ram.py          # RAM collection via psutil
        disk.py         # Disk collection via psutil
        processes.py    # Top N processes via psutil
```

### config.py

```python
import os

REDIS_HOST = os.environ.get("SYSTEM_REPORTER_REDIS_HOST", "10.0.0.3")
REDIS_PORT = int(os.environ.get("SYSTEM_REPORTER_REDIS_PORT", "6379"))
REDIS_DB = int(os.environ.get("SYSTEM_REPORTER_REDIS_DB", "0"))
COLLECTION_INTERVAL = int(os.environ.get("SYSTEM_REPORTER_INTERVAL", "30"))
REDIS_TTL = int(os.environ.get("SYSTEM_REPORTER_TTL", "60"))
TOP_N_PROCESSES = 10
```

### collectors/gpu.py

```python
from pynvml import *
import psutil

def collect_gpu():
    try:
        nvmlInit()
    except NVMLError:
        return {"available": False, "driver_version": None, "gpus": []}

    try:
        driver = nvmlSystemGetDriverVersion()
        count = nvmlDeviceGetCount()
        gpus = []
        for i in range(count):
            handle = nvmlDeviceGetHandleByIndex(i)
            name = nvmlDeviceGetName(handle)
            if isinstance(name, bytes):
                name = name.decode("utf-8")
            mem = nvmlDeviceGetMemoryInfo(handle)
            util = nvmlDeviceGetUtilizationRates(handle)
            temp = nvmlDeviceGetTemperature(handle, NVML_TEMPERATURE_GPU)
            clk_graphics = nvmlDeviceGetClockInfo(handle, NVML_CLOCK_GRAPHICS)
            clk_sm = nvmlDeviceGetClockInfo(handle, NVML_CLOCK_SM)
            clk_mem = nvmlDeviceGetClockInfo(handle, NVML_CLOCK_MEM)
            try:
                power = nvmlDeviceGetPowerUsage(handle) / 1000.0
                power_limit = nvmlDeviceGetEnforcedPowerLimit(handle) / 1000.0
            except NVMLError:
                power, power_limit = None, None

            # Merge compute + graphics processes
            procs = {}
            for p in nvmlDeviceGetComputeRunningProcesses(handle):
                procs[p.pid] = {"gpu_memory_mib": (p.usedGpuMemory or 0) / 1048576, "type": "compute"}
            for p in nvmlDeviceGetGraphicsRunningProcesses(handle):
                if p.pid in procs:
                    procs[p.pid]["type"] = "compute+graphics"
                else:
                    procs[p.pid] = {"gpu_memory_mib": (p.usedGpuMemory or 0) / 1048576, "type": "graphics"}

            # Enrich with psutil
            enriched = []
            for pid, info in procs.items():
                try:
                    ps = psutil.Process(pid)
                    info["pid"] = pid
                    info["user"] = ps.username()
                    info["command"] = " ".join(ps.cmdline()) or ps.name()
                    info["cpu_percent"] = ps.cpu_percent(interval=0)
                    info["ram_mib"] = ps.memory_info().rss / 1048576
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    info["pid"] = pid
                    info["user"] = "N/A"
                    info["command"] = "N/A"
                    info["cpu_percent"] = 0.0
                    info["ram_mib"] = 0.0
                enriched.append(info)

            gpus.append({
                "index": i, "name": name,
                "memory": {"total_mib": round(mem.total / 1048576), "used_mib": round(mem.used / 1048576), "free_mib": round(mem.free / 1048576)},
                "utilization": {"gpu_percent": util.gpu, "memory_percent": util.memory},
                "temperature_c": temp,
                "clocks": {"graphics_mhz": clk_graphics, "sm_mhz": clk_sm, "memory_mhz": clk_mem},
                "power": {"usage_watts": power, "limit_watts": power_limit},
                "processes": enriched
            })
        return {"available": True, "driver_version": driver if isinstance(driver, str) else driver.decode(), "gpus": gpus}
    finally:
        nvmlShutdown()
```

### collectors/cpu.py

```python
import psutil

def collect_cpu():
    return {
        "percent": psutil.cpu_percent(interval=1),
        "per_core": psutil.cpu_percent(interval=0, percpu=True),
        "load_average": dict(zip(["1min", "5min", "15min"], psutil.getloadavg())),
        "count_logical": psutil.cpu_count(logical=True),
        "count_physical": psutil.cpu_count(logical=False)
    }
```

### collectors/ram.py

```python
import psutil

def collect_ram():
    mem = psutil.virtual_memory()
    return {
        "total_mib": round(mem.total / 1048576),
        "used_mib": round(mem.used / 1048576),
        "free_mib": round(mem.free / 1048576),
        "cached_mib": round(mem.cached / 1048576)
    }
```

### collectors/disk.py

```python
import psutil

EXCLUDED_FSTYPES = {"tmpfs", "devtmpfs", "squashfs", "overlay", "devfs"}

def collect_disk():
    partitions = []
    for part in psutil.disk_partitions(all=False):
        if part.fstype in EXCLUDED_FSTYPES:
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
            partitions.append({
                "mountpoint": part.mountpoint, "device": part.device, "fstype": part.fstype,
                "total_gib": round(usage.total / (1024**3), 1),
                "used_gib": round(usage.used / (1024**3), 1),
                "free_gib": round(usage.free / (1024**3), 1),
                "percent": usage.percent
            })
        except PermissionError:
            continue
    return {"partitions": partitions}
```

### collectors/processes.py

```python
import psutil

SYSTEM_USERS = {"root", "daemon", "systemd-resolve", "syslog", "messagebus",
                "systemd-timesync", "systemd-network", "avahi", "colord",
                "gdm", "gnome-initial-setup", "nobody", "_apt"}

def collect_processes(top_n=10):
    procs = []
    for p in psutil.process_iter(["pid", "username", "name", "cmdline", "cpu_percent", "memory_info"]):
        try:
            info = p.info
            if info["username"] in SYSTEM_USERS:
                continue
            procs.append({
                "pid": info["pid"],
                "user": info["username"],
                "name": info["name"],
                "command": " ".join(info["cmdline"]) if info["cmdline"] else info["name"],
                "cpu_percent": info["cpu_percent"] or 0.0,
                "ram_mib": round((info["memory_info"].rss if info["memory_info"] else 0) / 1048576, 1)
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    by_cpu = sorted(procs, key=lambda p: p["cpu_percent"], reverse=True)[:top_n]
    by_mem = sorted(procs, key=lambda p: p["ram_mib"], reverse=True)[:top_n]
    return {"top_by_cpu": by_cpu, "top_by_memory": by_mem}
```

### publisher.py

```python
import json
import socket
import redis
import logging

logger = logging.getLogger(__name__)

class RedisPublisher:
    def __init__(self, host, port, db):
        self._host = host
        self._port = port
        self._db = db
        self._client = None

    def _connect(self):
        if self._client is None:
            self._client = redis.Redis(host=self._host, port=self._port, db=self._db,
                                        socket_timeout=5, socket_connect_timeout=5,
                                        retry_on_timeout=True)

    def publish(self, data, ttl):
        hostname = socket.gethostname()
        key = f"machine:{hostname}"
        try:
            self._connect()
            self._client.setex(key, ttl, json.dumps(data))
            logger.info(f"Published to {key} (TTL={ttl}s)")
        except redis.RedisError as e:
            logger.error(f"Failed to publish to Redis: {e}")
            self._client = None
            raise
```

### agent.py

```python
#!/usr/bin/env python3
import time
import socket
import logging
from datetime import datetime, timezone

from system_reporter.config import (
    REDIS_HOST, REDIS_PORT, REDIS_DB,
    COLLECTION_INTERVAL, REDIS_TTL, TOP_N_PROCESSES
)
from system_reporter.collectors.gpu import collect_gpu
from system_reporter.collectors.cpu import collect_cpu
from system_reporter.collectors.ram import collect_ram
from system_reporter.collectors.disk import collect_disk
from system_reporter.collectors.processes import collect_processes
from system_reporter.publisher import RedisPublisher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("system_reporter")

def collect_all():
    return {
        "hostname": socket.gethostname(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gpu": collect_gpu(),
        "cpu": collect_cpu(),
        "ram": collect_ram(),
        "disk": collect_disk(),
        "processes": collect_processes(TOP_N_PROCESSES)
    }

def main():
    publisher = RedisPublisher(REDIS_HOST, REDIS_PORT, REDIS_DB)
    logger.info(f"Starting system_reporter on {socket.gethostname()}")
    logger.info(f"Redis: {REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}, Interval: {COLLECTION_INTERVAL}s, TTL: {REDIS_TTL}s")

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
```

### requirements.txt

```
psutil>=5.9.0
nvidia-ml-py>=12.0.0
redis>=5.0.0
```

---

## Component 2: Redis on lab3001

### redis.conf.j2

```
bind 0.0.0.0
port 6379
protected-mode no
maxmemory 64mb
maxmemory-policy allkeys-lru
save ""
appendonly no
tcp-keepalive 60
timeout 0
```

- `bind 0.0.0.0` — accept LAN connections (trusted 10.0.0.x network)
- No persistence needed — data is ephemeral with 60s TTL
- No auth for simplicity (can add `requirepass` later via secrets.yml)

---

## Component 3: SvelteKit App Changes

### New API route: `src/routes/api/machines/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import { createClient } from 'redis';
import type { RequestHandler } from './$types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KNOWN_MACHINES = (process.env.KNOWN_MACHINES || '').split(',').filter(Boolean);

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
    if (!redisClient || !redisClient.isOpen) {
        redisClient = createClient({ url: REDIS_URL });
        redisClient.on('error', (err) => console.error('Redis error:', err));
        await redisClient.connect();
    }
    return redisClient;
}

export const GET: RequestHandler = async () => {
    try {
        const client = await getRedisClient();
        const keys = await client.keys('machine:*');
        const machines: Record<string, unknown> = {};
        for (const key of keys) {
            const raw = await client.get(key);
            if (raw) {
                try {
                    const data = JSON.parse(raw);
                    machines[data.hostname] = data;
                } catch { /* skip malformed */ }
            }
        }
        return json({ machines, known_machines: KNOWN_MACHINES, fetched_at: new Date().toISOString(), machine_count: Object.keys(machines).length });
    } catch (err) {
        console.error('Redis read failed:', err);
        return json({ error: 'Failed to fetch', machines: {}, known_machines: KNOWN_MACHINES, fetched_at: new Date().toISOString(), machine_count: 0 }, { status: 503 });
    }
};
```

### New TypeScript types (add to existing types.ts)

```typescript
// New push-based system types
export interface GpuMemory { total_mib: number; used_mib: number; free_mib: number; }
export interface GpuUtilization { gpu_percent: number; memory_percent: number; }
export interface GpuClocks { graphics_mhz: number; sm_mhz: number; memory_mhz: number; }
export interface GpuPower { usage_watts: number | null; limit_watts: number | null; }
export interface GpuProcess { pid: number; gpu_memory_mib: number; type: string; user: string; command: string; cpu_percent: number; ram_mib: number; }
export interface GpuDevice { index: number; name: string; memory: GpuMemory; utilization: GpuUtilization; temperature_c: number; clocks: GpuClocks; power: GpuPower; processes: GpuProcess[]; }
export interface GpuInfo { available: boolean; driver_version: string | null; gpus: GpuDevice[]; }
export interface CpuInfo { percent: number; per_core: number[]; load_average: { '1min': number; '5min': number; '15min': number }; count_logical: number; count_physical: number; }
export interface RamInfo { total_mib: number; used_mib: number; free_mib: number; cached_mib: number; }
export interface DiskPartition { mountpoint: string; device: string; fstype: string; total_gib: number; used_gib: number; free_gib: number; percent: number; }
export interface DiskInfo { partitions: DiskPartition[]; }
export interface ProcessEntry { pid: number; user: string; name: string; command: string; cpu_percent: number; ram_mib: number; }
export interface ProcessInfo { top_by_cpu: ProcessEntry[]; top_by_memory: ProcessEntry[]; }
export interface MachineData { hostname: string; timestamp: string; gpu: GpuInfo; cpu: CpuInfo; ram: RamInfo; disk: DiskInfo; processes: ProcessInfo; }
export interface MachinesResponse { machines: Record<string, MachineData>; known_machines: string[]; fetched_at: string; machine_count: number; error?: string; }
```

### Updated lab-status page

- Fetch from `/api/machines` instead of static YAML
- Auto-refresh every 30s
- Tabbed interface: **GPU** (default) | **CPU & RAM** | **Disk** | **Processes**
- GPU tab: same table layout but with numeric values + power column
- CPU & RAM tab: CPU%, load avg, cores, RAM total/used/free/cached
- Disk tab: per-partition usage grouped by machine
- Processes tab: collapsible per-machine accordion with top-by-CPU and top-by-memory
- Machines missing from Redis shown as "Offline"

---

## Component 4: Ansible Role (`role_system_reporter`)

### Structure

```
role_system_reporter/
    defaults/main.yml
    vars/main.yml
    handlers/main.yml
    meta/main.yml
    tasks/
        main.yml              # Entry point
        deploy_agent.yml      # Deploy Python agent + systemd
        deploy_redis.yml      # Install/configure Redis on lab3001
        deploy_webapp.yml     # Deploy updated SvelteKit app
    templates/
        system_reporter.service.j2
        redis.conf.j2
    files/
        system_reporter/      # Copy of the Python package
```

### tasks/main.yml

```yaml
---
- name: Deploy system_reporter agent
  ansible.builtin.include_tasks: deploy_agent.yml

- name: Deploy Redis on internal web host
  ansible.builtin.include_tasks: deploy_redis.yml
  when: inventory_hostname == groups['lab_internal_web_host'][0]

- name: Deploy updated SvelteKit webapp
  ansible.builtin.include_tasks: deploy_webapp.yml
  when: inventory_hostname == groups['lab_internal_web_host'][0]
```

### tasks/deploy_agent.yml

- Install python3, python3-pip, python3-venv via apt
- Create `/opt/system_reporter/` directory
- Copy Python package
- Create venv, install requirements
- Deploy systemd unit file from template
- Enable and start service

### tasks/deploy_redis.yml

- Install redis-server via apt
- Deploy redis.conf from template
- Enable and start redis-server

### tasks/deploy_webapp.yml

- Same pattern as current role_gpu webapp deployment
- Copy SvelteKit files, npm install, npm build, forever start
- Pass REDIS_URL and KNOWN_MACHINES as environment variables

### systemd unit template

```ini
[Unit]
Description=System Reporter Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Environment=SYSTEM_REPORTER_REDIS_HOST={{ system_reporter_redis_host }}
Environment=SYSTEM_REPORTER_REDIS_PORT={{ system_reporter_redis_port }}
Environment=SYSTEM_REPORTER_REDIS_DB={{ system_reporter_redis_db }}
Environment=SYSTEM_REPORTER_INTERVAL={{ system_reporter_interval }}
Environment=SYSTEM_REPORTER_TTL={{ system_reporter_ttl }}
ExecStart={{ system_reporter_venv_dir }}/bin/python -m system_reporter.agent
WorkingDirectory={{ system_reporter_install_dir }}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=system_reporter

[Install]
WantedBy=multi-user.target
```

---

## Integration with Existing Playbook

1. Add `is_deploy_system_reporter: false` to `vars/main.yml`
2. Add role inclusion to `main-playbook.yml`:
   ```yaml
   - name: Include the role_system_reporter
     ansible.builtin.include_role:
       name: role_system_reporter
     when: is_deploy_system_reporter | bool
   ```
3. Create `run_deploy_system_reporter.sh`
4. Mark `role_gpu` as deprecated (keep functional for rollback)

---

## Error Handling

| Scenario | Handling |
|---|---|
| No GPU / NVML fails | `gpu.available = false`, empty gpu list. Agent continues. |
| Redis unreachable | Log error, retry next cycle. Publisher resets client on failure. |
| psutil AccessDenied on process | Skip that process silently. |
| Machine goes offline | Redis key TTL expires (60s). Frontend shows "Offline". |
| Redis crashes | systemd restarts it. Agents reconnect next cycle. |
| SvelteKit can't reach Redis | API returns 503 with error. Frontend shows error banner, retries in 30s. |

---

## Implementation Sequence

1. **Python agent** — create `system_reporter/` package with all collectors
2. **Redis config** — template for redis.conf
3. **SvelteKit changes** — API route, new types, tabbed frontend
4. **Ansible role** — `role_system_reporter/` with all tasks/templates/handlers
5. **Playbook integration** — vars, main-playbook.yml, run script
6. **Deprecate role_gpu** — add notice, keep functional
