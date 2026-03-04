import psutil


def collect_ram():
    mem = psutil.virtual_memory()
    return {
        "total_mib": round(mem.total / 1048576),
        "used_mib": round(mem.used / 1048576),
        "free_mib": round(mem.free / 1048576),
        "cached_mib": round(mem.cached / 1048576),
    }
