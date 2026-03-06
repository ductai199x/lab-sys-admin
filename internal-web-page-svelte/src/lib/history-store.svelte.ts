import type { MachinesResponse } from './types';

export interface HistoryPoint {
	time: number;
	cpu: number;
	ramPct: number;
	gpuAvgUtil: number;
	gpuAvgMemPct: number;
}

const MAX_POINTS = 60; // 60 * 30s = 30 minutes of history

let history: Record<string, HistoryPoint[]> = $state({});

export function getHistory(): Record<string, HistoryPoint[]> {
	return history;
}

export function getMachineHistory(hostname: string): HistoryPoint[] {
	return history[hostname] ?? [];
}

export function recordSnapshot(data: MachinesResponse) {
	if (!data.machines) return;
	const now = Date.now();
	for (const [hostname, machine] of Object.entries(data.machines)) {
		if (!history[hostname]) {
			history[hostname] = [];
		}
		const cpuPct = machine.cpu?.percent ?? 0;
		const ramPct = machine.ram && machine.ram.total_mib > 0
			? (machine.ram.used_mib / machine.ram.total_mib) * 100
			: 0;

		let gpuAvgUtil = 0;
		let gpuAvgMemPct = 0;
		if (machine.gpu?.available && machine.gpu.gpus?.length) {
			const gpus = machine.gpu.gpus;
			gpuAvgUtil = gpus.reduce((s, g) => s + g.utilization.gpu_percent, 0) / gpus.length;
			gpuAvgMemPct = gpus.reduce((s, g) => s + g.utilization.memory_percent, 0) / gpus.length;
		}

		history[hostname].push({ time: now, cpu: cpuPct, ramPct, gpuAvgUtil, gpuAvgMemPct });

		if (history[hostname].length > MAX_POINTS) {
			history[hostname] = history[hostname].slice(-MAX_POINTS);
		}
	}
}
