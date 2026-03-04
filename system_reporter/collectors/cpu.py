import psutil


def collect_cpu():
    return {
        "percent": psutil.cpu_percent(interval=1),
        "per_core": psutil.cpu_percent(interval=0, percpu=True),
        "load_average": dict(zip(["1min", "5min", "15min"], psutil.getloadavg())),
        "count_logical": psutil.cpu_count(logical=True),
        "count_physical": psutil.cpu_count(logical=False),
    }
