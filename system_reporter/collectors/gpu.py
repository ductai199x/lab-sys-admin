import logging

import psutil

logger = logging.getLogger(__name__)


def collect_gpu():
    try:
        from pynvml import (
            NVML_CLOCK_GRAPHICS,
            NVML_CLOCK_MEM,
            NVML_CLOCK_SM,
            NVML_TEMPERATURE_GPU,
            NVMLError,
            nvmlDeviceGetClockInfo,
            nvmlDeviceGetComputeRunningProcesses,
            nvmlDeviceGetCount,
            nvmlDeviceGetEnforcedPowerLimit,
            nvmlDeviceGetGraphicsRunningProcesses,
            nvmlDeviceGetHandleByIndex,
            nvmlDeviceGetMemoryInfo,
            nvmlDeviceGetName,
            nvmlDeviceGetPowerUsage,
            nvmlDeviceGetTemperature,
            nvmlDeviceGetUtilizationRates,
            nvmlInit,
            nvmlShutdown,
            nvmlSystemGetDriverVersion,
        )
    except ImportError:
        logger.warning("pynvml not available, skipping GPU collection")
        return {"available": False, "driver_version": None, "gpus": []}

    try:
        nvmlInit()
    except NVMLError as e:
        logger.warning("NVML init failed: %s", e)
        return {"available": False, "driver_version": None, "gpus": []}

    try:
        driver = nvmlSystemGetDriverVersion()
        if isinstance(driver, bytes):
            driver = driver.decode("utf-8")
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
                power = round(nvmlDeviceGetPowerUsage(handle) / 1000.0, 1)
                power_limit = round(nvmlDeviceGetEnforcedPowerLimit(handle) / 1000.0, 1)
            except NVMLError:
                power, power_limit = None, None

            # Merge compute + graphics processes by PID
            procs = {}
            try:
                for p in nvmlDeviceGetComputeRunningProcesses(handle):
                    procs[p.pid] = {
                        "gpu_memory_mib": round((p.usedGpuMemory or 0) / 1048576, 1),
                        "type": "compute",
                    }
            except NVMLError:
                pass
            try:
                for p in nvmlDeviceGetGraphicsRunningProcesses(handle):
                    if p.pid in procs:
                        procs[p.pid]["type"] = "compute+graphics"
                    else:
                        procs[p.pid] = {
                            "gpu_memory_mib": round((p.usedGpuMemory or 0) / 1048576, 1),
                            "type": "graphics",
                        }
            except NVMLError:
                pass

            # Enrich with psutil
            enriched = []
            for pid, info in procs.items():
                info["pid"] = pid
                try:
                    ps = psutil.Process(pid)
                    info["user"] = ps.username()
                    info["command"] = " ".join(ps.cmdline()) or ps.name()
                    info["cpu_percent"] = ps.cpu_percent(interval=0)
                    info["ram_mib"] = round(ps.memory_info().rss / 1048576, 1)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    info["user"] = "N/A"
                    info["command"] = "N/A"
                    info["cpu_percent"] = 0.0
                    info["ram_mib"] = 0.0
                enriched.append(info)

            gpus.append({
                "index": i,
                "name": name,
                "memory": {
                    "total_mib": round(mem.total / 1048576),
                    "used_mib": round(mem.used / 1048576),
                    "free_mib": round(mem.free / 1048576),
                },
                "utilization": {
                    "gpu_percent": util.gpu,
                    "memory_percent": util.memory,
                },
                "temperature_c": temp,
                "clocks": {
                    "graphics_mhz": clk_graphics,
                    "sm_mhz": clk_sm,
                    "memory_mhz": clk_mem,
                },
                "power": {
                    "usage_watts": power,
                    "limit_watts": power_limit,
                },
                "processes": enriched,
            })

        return {"available": True, "driver_version": driver, "gpus": gpus}
    finally:
        nvmlShutdown()
