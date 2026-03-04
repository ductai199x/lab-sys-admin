import psutil

SYSTEM_USERS = {
    "root", "daemon", "systemd-resolve", "syslog", "messagebus",
    "systemd-timesync", "systemd-network", "avahi", "colord",
    "gdm", "gnome-initial-setup", "nobody", "_apt",
}


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
                "ram_mib": round((info["memory_info"].rss if info["memory_info"] else 0) / 1048576, 1),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    by_cpu = sorted(procs, key=lambda p: p["cpu_percent"], reverse=True)[:top_n]
    by_mem = sorted(procs, key=lambda p: p["ram_mib"], reverse=True)[:top_n]
    return {"top_by_cpu": by_cpu, "top_by_memory": by_mem}
