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
                "mountpoint": part.mountpoint,
                "device": part.device,
                "fstype": part.fstype,
                "total_gib": round(usage.total / (1024 ** 3), 1),
                "used_gib": round(usage.used / (1024 ** 3), 1),
                "free_gib": round(usage.free / (1024 ** 3), 1),
                "percent": usage.percent,
            })
        except OSError:
            continue
    return {"partitions": partitions}
