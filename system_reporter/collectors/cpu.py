import psutil


def collect_cpu():
    per_core = psutil.cpu_percent(interval=1, percpu=True)
    overall = sum(per_core) / len(per_core) if per_core else 0.0
    return {
        "percent": round(overall, 1),
        "per_core": per_core,
        "load_average": dict(zip(["1min", "5min", "15min"], psutil.getloadavg())),
        "count_logical": psutil.cpu_count(logical=True),
        "count_physical": psutil.cpu_count(logical=False),
    }
