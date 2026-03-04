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
