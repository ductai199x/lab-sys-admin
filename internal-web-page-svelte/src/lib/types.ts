// === Legacy types (kept for backward compatibility with role_gpu YAML) ===

export interface GpuMemUsage {
	total: string;
	used: string;
	free: string;
}

export interface GpuFreq {
	sm_clock: string;
	mem_clock: string;
}

export interface GpuUtil {
	gpu_util: string;
	memory_util: string;
	encoder_util: string;
	decoder_util: string;
}

export interface GpuStats {
	gpu_mem_usage: GpuMemUsage;
	gpu_freq: GpuFreq;
	gpu_temp: string;
	gpu_util: GpuUtil;
	gpu_processes: string;
	gpu_process_info: string;
	nvidia_driver: string;
	cuda_versions: string;
	cudnn_versions: string;
}

export interface ServerGpuInfo {
	[hostname: string]: Array<Record<string, GpuStats>>;
}

export interface AllGpuStats {
	build_datetime: string;
	server_gpu_info: ServerGpuInfo;
}

export interface GpuProc {
	pid: number;
	name: string;
	type: string;
	used_memory: string;
	user: string;
	start_time: string;
	elapsed_time: string;
	command: string;
}

// === New types for push-based system_reporter ===

export interface GpuMemory {
	total_mib: number;
	used_mib: number;
	free_mib: number;
}

export interface GpuUtilization {
	gpu_percent: number;
	memory_percent: number;
}

export interface GpuClocks {
	graphics_mhz: number;
	sm_mhz: number;
	memory_mhz: number;
}

export interface GpuPower {
	usage_watts: number | null;
	limit_watts: number | null;
}

export interface GpuProcess {
	pid: number;
	gpu_memory_mib: number;
	type: string;
	user: string;
	command: string;
	cpu_percent: number;
	ram_mib: number;
}

export interface GpuDevice {
	index: number;
	name: string;
	memory: GpuMemory;
	utilization: GpuUtilization;
	temperature_c: number;
	clocks: GpuClocks;
	power: GpuPower;
	processes: GpuProcess[];
}

export interface GpuInfo {
	available: boolean;
	driver_version: string | null;
	gpus: GpuDevice[];
}

export interface CpuInfo {
	percent: number;
	per_core: number[];
	load_average: { '1min': number; '5min': number; '15min': number };
	count_logical: number;
	count_physical: number;
}

export interface RamInfo {
	total_mib: number;
	used_mib: number;
	free_mib: number;
	cached_mib: number;
}

export interface DiskPartition {
	mountpoint: string;
	device: string;
	fstype: string;
	total_gib: number;
	used_gib: number;
	free_gib: number;
	percent: number;
}

export interface DiskInfo {
	partitions: DiskPartition[];
}

export interface ProcessEntry {
	pid: number;
	user: string;
	name: string;
	command: string;
	cpu_percent: number;
	ram_mib: number;
}

export interface ProcessInfo {
	top_by_cpu: ProcessEntry[];
	top_by_memory: ProcessEntry[];
}

export interface MachineData {
	hostname: string;
	timestamp: string;
	gpu: GpuInfo;
	cpu: CpuInfo;
	ram: RamInfo;
	disk: DiskInfo;
	processes: ProcessInfo;
}

export interface MachinesResponse {
	machines: Record<string, MachineData>;
	known_machines: string[];
	fetched_at: string;
	machine_count: number;
	error?: string;
}
