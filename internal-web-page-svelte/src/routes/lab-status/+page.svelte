<script lang="ts">
	import type { MachinesResponse, MachineData, GpuProcess } from '$lib/types';
	import { Badge } from '$lib/components/ui/badge';
	import { RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { untrack, tick } from 'svelte';
	import { getActivePage, setAlertCount, getSearchQuery, getSelectedMachine, setSelectedMachine, goBackFromDetail } from '$lib/lab-state.svelte';
	import { recordSnapshot, getMachineHistory, type HistoryPoint } from '$lib/history-store.svelte';

	type Status = 'available' | 'inuse' | 'critical' | 'offline';

	let data: MachinesResponse | null = $state(null);
	let loading = $state(true);
	let refreshing = $state(false);
	let error = $state('');

	// Modal state
	let showModal = $state(false);
	let modalTitle = $state('');
	let modalProcs: GpuProcess[] = $state([]);

	// Sort state
	type SortDir = 'asc' | 'desc' | null;
	interface SortState { column: string; dir: SortDir; }
	let gpuSort: SortState = $state({ column: '', dir: null });
	let cpuSort: SortState = $state({ column: '', dir: null });
	let diskSort: SortState = $state({ column: '', dir: null });

	function toggleSort(state: SortState, column: string): SortState {
		if (state.column === column) {
			if (state.dir === 'asc') return { column, dir: 'desc' };
			if (state.dir === 'desc') return { column: '', dir: null };
		}
		return { column, dir: 'asc' };
	}

	function sortIcon(state: SortState, column: string): typeof ArrowUpDown {
		if (state.column === column) {
			return state.dir === 'asc' ? ArrowUp : ArrowDown;
		}
		return ArrowUpDown;
	}

	// ─── Data Fetching ───
	async function fetchData() {
		if (!loading) refreshing = true;
		try {
			const res = await fetch('/api/machines');
			const body = await res.json();
			if (!res.ok) {
				error = body?.error ?? `HTTP ${res.status}`;
				if (body?.machines !== undefined) data = body as MachinesResponse;
			} else {
				data = body as MachinesResponse;
				error = '';
			}
			if (data) recordSnapshot(data);
		} catch (err_) {
			error = err_ instanceof Error ? err_.message : 'Failed to fetch data';
		}
		loading = false;
		refreshing = false;
	}

	$effect(() => {
		untrack(() => fetchData());
		const timer = setInterval(fetchData, 30000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		function onRefresh() { fetchData(); }
		window.addEventListener('lab-refresh', onRefresh);
		return () => window.removeEventListener('lab-refresh', onRefresh);
	});

	// ─── Helpers ───
	function sortedHostnames(): string[] {
		if (!data) return [];
		const all = data.known_machines?.length > 0 ? data.known_machines : Object.keys(data.machines ?? {});
		return [...new Set(all)].sort();
	}

	function filteredHostnames(): string[] {
		const q = getSearchQuery().toLowerCase().trim();
		if (!q) return sortedHostnames();
		return sortedHostnames().filter((hostname) => {
			if (hostname.toLowerCase().includes(q)) return true;
			const m = getMachine(hostname);
			if (!m) return false;
			const procs = [...(m.processes?.top_by_cpu ?? []), ...(m.processes?.top_by_memory ?? [])];
			if (procs.some(p => p.user.toLowerCase().includes(q) || p.command.toLowerCase().includes(q))) return true;
			if (m.gpu?.gpus) {
				for (const gpu of m.gpu.gpus) {
					if (gpu.name.toLowerCase().includes(q)) return true;
					if (gpu.processes?.some(p => p.user.toLowerCase().includes(q) || p.command.toLowerCase().includes(q))) return true;
				}
			}
			return false;
		});
	}

	function getMachine(hostname: string): MachineData | null {
		return data?.machines?.[hostname] ?? null;
	}

	function timeSince(timestamp: string): string {
		const time = new Date(timestamp).getTime();
		if (isNaN(time)) return 'unknown';
		const seconds = Math.floor((Date.now() - time) / 1000);
		if (seconds < 0) return 'just now';
		if (seconds < 60) return `${seconds}s ago`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}

	function safeFixed(value: number | null | undefined, digits: number = 1): string {
		if (value == null || isNaN(value)) return 'N/A';
		return value.toFixed(digits);
	}

	function safeLocale(value: number | null | undefined): string {
		if (value == null || isNaN(value)) return 'N/A';
		return value.toLocaleString();
	}

	// ─── Status Classifiers ───
	function gpuStatusClass(usedMib: number): Status {
		return usedMib > 500 ? 'inuse' : 'available';
	}

	function cpuStatusClass(percent: number): Status {
		if (percent > 80) return 'critical';
		if (percent > 50) return 'inuse';
		return 'available';
	}

	function diskStatusClass(percent: number): Status {
		if (percent > 90) return 'critical';
		if (percent > 70) return 'inuse';
		return 'available';
	}

	function ramStatusClass(machine: MachineData): Status {
		if (!machine.ram || machine.ram.total_mib === 0) return 'critical';
		const pct = (machine.ram.used_mib / machine.ram.total_mib) * 100;
		if (pct > 90) return 'critical';
		if (pct > 70) return 'inuse';
		return 'available';
	}

	function worstGpuStatus(machine: MachineData): Status {
		if (!machine.gpu?.available || !machine.gpu.gpus?.length) return 'available';
		return machine.gpu.gpus.some((g) => g.memory.used_mib > 500) ? 'inuse' : 'available';
	}

	function worstDiskStatus(machine: MachineData): Status {
		if (!machine.disk?.partitions?.length) return 'available';
		let worst: Status = 'available';
		for (const part of machine.disk.partitions) {
			const s = diskStatusClass(part.percent);
			if (s === 'critical') return 'critical';
			if (s === 'inuse') worst = 'inuse';
		}
		return worst;
	}

	function overallStatus(machine: MachineData): Status {
		const checks: Status[] = [
			cpuStatusClass(machine.cpu?.percent ?? 0),
			ramStatusClass(machine),
			worstDiskStatus(machine)
		];
		if (machine.gpu?.available) checks.push(worstGpuStatus(machine));
		if (checks.includes('critical')) return 'critical';
		if (checks.includes('inuse')) return 'inuse';
		return 'available';
	}

	function barColor(pct: number): string {
		if (pct > 90) return 'bg-status-critical';
		if (pct > 70) return 'bg-status-inuse';
		return 'bg-status-available';
	}

	function statusDotColor(status: Status): string {
		switch (status) {
			case 'available': return 'bg-status-available shadow-[0_0_0_3px_var(--status-available-bg)]';
			case 'inuse': return 'bg-status-inuse shadow-[0_0_0_3px_var(--status-inuse-bg)]';
			case 'critical': return 'bg-status-critical shadow-[0_0_0_3px_var(--status-critical-bg)]';
			case 'offline': return 'bg-gray shadow-[0_0_0_3px_var(--gray-light)]';
		}
	}

	function statusRowBg(status: Status): string {
		switch (status) {
			case 'available': return 'bg-status-available-bg';
			case 'inuse': return 'bg-status-inuse-bg';
			case 'critical': return 'bg-status-critical-bg';
			case 'offline': return 'bg-status-offline-bg';
		}
	}

	function statusTextColor(status: Status): string {
		switch (status) {
			case 'available': return 'text-status-available font-semibold';
			case 'inuse': return 'text-status-inuse font-semibold';
			case 'critical': return 'text-status-critical font-semibold';
			case 'offline': return 'text-status-offline-fg';
		}
	}

	// ─── Computed Stats ───
	function getOnlineMachines(): string[] {
		return sortedHostnames().filter((n) => getMachine(n) !== null);
	}

	function getTotalGpus(): number {
		return getOnlineMachines().reduce((s, n) => s + (getMachine(n)?.gpu?.gpus?.length ?? 0), 0);
	}

	function getFreeGpus(): number {
		return getOnlineMachines().reduce(
			(s, n) => s + (getMachine(n)?.gpu?.gpus?.filter((g) => g.memory.used_mib < 500).length ?? 0),
			0
		);
	}

	function getCriticalMachines(): string[] {
		return getOnlineMachines().filter((n) => {
			const m = getMachine(n);
			return m && overallStatus(m) === 'critical';
		});
	}

	// ─── Alerts ───
	interface Alert {
		level: 'red' | 'yellow';
		machine: string;
		msg: string;
	}

	function getAlerts(): Alert[] {
		const alerts: Alert[] = [];
		for (const name of sortedHostnames()) {
			const m = getMachine(name);
			if (!m) continue;
			if (m.ram && m.ram.total_mib > 0 && m.ram.used_mib / m.ram.total_mib > 0.9) {
				alerts.push({
					level: 'red',
					machine: name,
					msg: `RAM usage critical \u2014 ${Math.round((m.ram.used_mib / m.ram.total_mib) * 100)}% used (${safeLocale(m.ram.free_mib)} MiB free)`
				});
			}
			if (m.disk?.partitions) {
				for (const p of m.disk.partitions) {
					if (p.percent > 90) {
						alerts.push({
							level: 'red',
							machine: name,
							msg: `Disk ${p.mountpoint} at ${p.percent}% \u2014 only ${p.free_gib} GiB free`
						});
					}
				}
			}
			if (m.cpu && m.cpu.percent > 85) {
				alerts.push({
					level: 'yellow',
					machine: name,
					msg: `CPU load elevated at ${m.cpu.percent}%`
				});
			}
		}
		return alerts;
	}

	$effect(() => {
		if (data) {
			setAlertCount(getAlerts().length);
		}
	});

	// ─── Modal ───
	async function openModal(label: string, procs: GpuProcess[]) {
		modalTitle = label;
		modalProcs = procs;
		showModal = true;
		await tick();
		document.getElementById('gpu-modal-backdrop')?.focus();
	}

	function closeModal() {
		showModal = false;
	}

	// ─── Sparkline SVG ───
	function sparklinePath(points: number[], w: number, h: number): string {
		if (points.length < 2) return '';
		const max = Math.max(...points, 1);
		const step = w / (points.length - 1);
		return points.map((v, i) => {
			const x = i * step;
			const y = h - (v / max) * (h - 2) - 1;
			return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(' ');
	}

	// ─── Sorting helpers for GPU rows ───
	interface GpuRow {
		hostname: string;
		machine: MachineData;
		gpu: NonNullable<MachineData['gpu']>['gpus'][number];
		gpuIdx: number;
		isFirstOfHost: boolean;
		hostGpuCount: number;
	}

	function getGpuRows(): GpuRow[] {
		const rows: GpuRow[] = [];
		for (const hostname of filteredHostnames()) {
			const machine = getMachine(hostname);
			if (!machine || !machine.gpu?.available || !machine.gpu.gpus?.length) continue;
			machine.gpu.gpus.forEach((gpu, gpuIdx) => {
				rows.push({ hostname, machine, gpu, gpuIdx, isFirstOfHost: gpuIdx === 0, hostGpuCount: machine.gpu!.gpus.length });
			});
		}
		if (gpuSort.column && gpuSort.dir) {
			const dir = gpuSort.dir === 'asc' ? 1 : -1;
			rows.sort((a, b) => {
				let av: number, bv: number;
				switch (gpuSort.column) {
					case 'mem_used': av = a.gpu.memory.used_mib; bv = b.gpu.memory.used_mib; break;
					case 'mem_total': av = a.gpu.memory.total_mib; bv = b.gpu.memory.total_mib; break;
					case 'gpu_util': av = a.gpu.utilization.gpu_percent; bv = b.gpu.utilization.gpu_percent; break;
					case 'mem_util': av = a.gpu.utilization.memory_percent; bv = b.gpu.utilization.memory_percent; break;
					case 'temp': av = a.gpu.temperature_c; bv = b.gpu.temperature_c; break;
					case 'power': av = a.gpu.power.usage_watts ?? 0; bv = b.gpu.power.usage_watts ?? 0; break;
					default: av = 0; bv = 0;
				}
				return (av - bv) * dir;
			});
			rows.forEach((r) => { r.isFirstOfHost = true; r.hostGpuCount = 1; });
		}
		return rows;
	}

	// CPU sort helpers
	interface CpuRow { hostname: string; machine: MachineData; }

	function getCpuRows(): CpuRow[] {
		const rows: CpuRow[] = [];
		for (const hostname of filteredHostnames()) {
			const machine = getMachine(hostname);
			if (machine && machine.cpu && machine.ram) {
				rows.push({ hostname, machine });
			}
		}
		if (cpuSort.column && cpuSort.dir) {
			const dir = cpuSort.dir === 'asc' ? 1 : -1;
			rows.sort((a, b) => {
				let av: number, bv: number;
				switch (cpuSort.column) {
					case 'cpu_usage': av = a.machine.cpu!.percent; bv = b.machine.cpu!.percent; break;
					case 'load_1m': av = a.machine.cpu!.load_average['1min']; bv = b.machine.cpu!.load_average['1min']; break;
					case 'load_5m': av = a.machine.cpu!.load_average['5min']; bv = b.machine.cpu!.load_average['5min']; break;
					case 'ram_used': av = a.machine.ram!.used_mib; bv = b.machine.ram!.used_mib; break;
					case 'ram_total': av = a.machine.ram!.total_mib; bv = b.machine.ram!.total_mib; break;
					case 'ram_free': av = a.machine.ram!.free_mib; bv = b.machine.ram!.free_mib; break;
					default: av = 0; bv = 0;
				}
				return (av - bv) * dir;
			});
		}
		return rows;
	}

	// Disk sort helpers
	interface DiskRow {
		hostname: string;
		machine: MachineData;
		part: NonNullable<MachineData['disk']>['partitions'][number];
		partIdx: number;
		isFirstOfHost: boolean;
		hostPartCount: number;
	}

	function getDiskRows(): DiskRow[] {
		const rows: DiskRow[] = [];
		for (const hostname of filteredHostnames()) {
			const machine = getMachine(hostname);
			if (!machine || !machine.disk?.partitions?.length) continue;
			machine.disk.partitions.forEach((part, partIdx) => {
				rows.push({ hostname, machine, part, partIdx, isFirstOfHost: partIdx === 0, hostPartCount: machine.disk!.partitions.length });
			});
		}
		if (diskSort.column && diskSort.dir) {
			const dir = diskSort.dir === 'asc' ? 1 : -1;
			rows.sort((a, b) => {
				let av: number, bv: number;
				switch (diskSort.column) {
					case 'total': av = a.part.total_gib; bv = b.part.total_gib; break;
					case 'used': av = a.part.used_gib; bv = b.part.used_gib; break;
					case 'free': av = a.part.free_gib; bv = b.part.free_gib; break;
					case 'usage': av = a.part.percent; bv = b.part.percent; break;
					default: av = 0; bv = 0;
				}
				return (av - bv) * dir;
			});
			rows.forEach((r) => { r.isFirstOfHost = true; r.hostPartCount = 1; });
		}
		return rows;
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-20">
		<div class="flex items-center gap-3 text-muted-foreground">
			<RefreshCw class="size-5 animate-spin" />
			<span>Loading machine data...</span>
		</div>
	</div>
{:else if !data}
	<div class="text-center py-20">
		{#if error}
			<p class="text-destructive font-medium mb-4">{error}</p>
			<button class="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors" onclick={fetchData}>
				<RefreshCw class="size-3.5 inline mr-1.5" />
				Retry
			</button>
		{:else}
			<p class="text-muted-foreground">No data available</p>
		{/if}
	</div>
{:else}
	{#if error}
		<div class="mb-4 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
			{error} (showing last known data)
		</div>
	{/if}

	{#if getSearchQuery() && filteredHostnames().length === 0}
		<div class="text-center py-16">
			<p class="text-muted-foreground text-sm">No machines match "<span class="font-medium text-foreground">{getSearchQuery()}</span>"</p>
		</div>
	{/if}

	<!-- ═══════════ Overview ═══════════ -->
	<div class={getActivePage() === 'overview' ? '' : 'hidden'}>
		<!-- Stat Cards -->
		{#if data}
			{@const online = getOnlineMachines()}
			{@const totalGpus = getTotalGpus()}
			{@const freeGpus = getFreeGpus()}
			{@const critMachines = getCriticalMachines()}
			<div class="grid grid-cols-4 gap-4 mb-7 max-lg:grid-cols-2 max-sm:grid-cols-1">
				<div class="bg-green-card rounded-2xl p-5 text-white relative overflow-hidden animate-[cardIn_0.4s_ease-out_both]">
					<div class="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10"></div>
					<div class="text-[13px] font-semibold opacity-90 mb-1">Machines Online</div>
					<div class="text-[32px] font-extrabold tracking-tight leading-none">
						{online.length}<span class="text-lg opacity-70">/{sortedHostnames().length}</span>
					</div>
					<div class="text-[11px] opacity-75 mt-1">{sortedHostnames().length - online.length} offline</div>
				</div>

				<div class="bg-blue-card rounded-2xl p-5 text-white relative overflow-hidden animate-[cardIn_0.4s_ease-out_0.06s_both]">
					<div class="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10"></div>
					<div class="text-[13px] font-semibold opacity-90 mb-1">Total GPUs</div>
					<div class="text-[32px] font-extrabold tracking-tight leading-none">{totalGpus}</div>
					<div class="text-[11px] opacity-75 mt-1">{freeGpus} available</div>
				</div>

				<div class="bg-yellow-card rounded-2xl p-5 text-white relative overflow-hidden animate-[cardIn_0.4s_ease-out_0.12s_both]">
					<div class="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10"></div>
					<div class="text-[13px] font-semibold opacity-90 mb-1">GPUs In Use</div>
					<div class="text-[32px] font-extrabold tracking-tight leading-none">{totalGpus - freeGpus}</div>
					<div class="text-[11px] opacity-75 mt-1">{totalGpus > 0 ? Math.round(((totalGpus - freeGpus) / totalGpus) * 100) : 0}% utilization</div>
				</div>

				<div class="bg-red-card rounded-2xl p-5 text-white relative overflow-hidden animate-[cardIn_0.4s_ease-out_0.18s_both]">
					<div class="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10"></div>
					<div class="text-[13px] font-semibold opacity-90 mb-1">Critical Alerts</div>
					<div class="text-[32px] font-extrabold tracking-tight leading-none">{critMachines.length}</div>
					<div class="text-[11px] opacity-75 mt-1">{critMachines.length ? critMachines.join(', ') : 'All systems healthy'}</div>
				</div>
			</div>
		{/if}

		<!-- Machine Cards -->
		<div class="flex items-center justify-between mb-4">
			<div class="text-[17px] font-bold tracking-tight">All Machines</div>
			<div class="text-[13px] text-muted-foreground">Click a machine card for full details</div>
		</div>

		<div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 mb-7 max-sm:grid-cols-1">
			{#each filteredHostnames() as hostname, idx}
				{@const machine = getMachine(hostname)}
				{@const st = machine ? overallStatus(machine) : 'offline'}
				{@const hist = getMachineHistory(hostname)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class={cn(
						'bg-card border border-border rounded-2xl p-5 shadow-[0_1px_3px_rgba(26,29,35,0.04),0_4px_12px_rgba(26,29,35,0.03)] transition-all hover:shadow-[0_4px_24px_rgba(26,29,35,0.08)] hover:border-[#d5d0c8] cursor-pointer',
						!machine && 'opacity-55'
					)}
					style="animation: cardIn 0.4s ease-out {idx * 0.04}s both"
					onclick={() => { if (machine) setSelectedMachine(hostname); }}
					onkeydown={(e) => { if (e.key === 'Enter' && machine) setSelectedMachine(hostname); }}
					role="button"
					tabindex="0"
				>
					<!-- Card Header -->
					<div class="flex items-center gap-2.5 mb-4">
						<div class={cn('w-2.5 h-2.5 rounded-full shrink-0', statusDotColor(st))}></div>
						<div class="text-base font-bold tracking-tight">{hostname}</div>
						{#if machine}
							<div class="text-[11px] text-muted-foreground ml-auto">{timeSince(machine.timestamp)}</div>
						{:else}
							<Badge class="ml-auto bg-status-offline-bg text-status-offline-fg border-status-offline-fg/30 text-[10px] font-bold uppercase tracking-wide">Offline</Badge>
						{/if}
					</div>

					{#if machine}
						<!-- Metrics -->
						{@const cpuPct = machine.cpu?.percent ?? 0}
						{@const ramPct = machine.ram && machine.ram.total_mib > 0 ? Math.round((machine.ram.used_mib / machine.ram.total_mib) * 100) : 0}
						{@const worstDiskPct = machine.disk?.partitions?.length ? Math.max(...machine.disk.partitions.map((p) => p.percent)) : 0}
						<div class="grid grid-cols-2 gap-2.5">
							<div class="bg-background rounded-[10px] p-2.5 px-3">
								<div class="flex items-center justify-between">
									<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">CPU</div>
									{#if hist.length >= 2}
										<svg class="w-[40px] h-[16px] opacity-60" viewBox="0 0 40 16">
											<path d={sparklinePath(hist.map(h => h.cpu), 40, 16)} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
										</svg>
									{/if}
								</div>
								<div class="text-[15px] font-bold tracking-tight">{cpuPct}%</div>
								<div class="h-1 rounded-sm bg-border mt-1.5 overflow-hidden">
									<div class={cn('h-full rounded-sm transition-[width] duration-500', barColor(cpuPct))} style="width:{cpuPct}%"></div>
								</div>
							</div>
							<div class="bg-background rounded-[10px] p-2.5 px-3">
								<div class="flex items-center justify-between">
									<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">RAM</div>
									{#if hist.length >= 2}
										<svg class="w-[40px] h-[16px] opacity-60" viewBox="0 0 40 16">
											<path d={sparklinePath(hist.map(h => h.ramPct), 40, 16)} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
										</svg>
									{/if}
								</div>
								<div class="text-[15px] font-bold tracking-tight">{ramPct}%</div>
								<div class="h-1 rounded-sm bg-border mt-1.5 overflow-hidden">
									<div class={cn('h-full rounded-sm transition-[width] duration-500', barColor(ramPct))} style="width:{ramPct}%"></div>
								</div>
							</div>
							<div class="bg-background rounded-[10px] p-2.5 px-3">
								<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Disk (worst)</div>
								<div class="text-[15px] font-bold tracking-tight">{safeFixed(worstDiskPct, 0)}%</div>
								<div class="h-1 rounded-sm bg-border mt-1.5 overflow-hidden">
									<div class={cn('h-full rounded-sm transition-[width] duration-500', barColor(worstDiskPct))} style="width:{worstDiskPct}%"></div>
								</div>
							</div>
							<div class="bg-background rounded-[10px] p-2.5 px-3">
								<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Cores</div>
								<div class="text-[15px] font-bold tracking-tight">{machine.cpu?.count_physical ?? '?'}P / {machine.cpu?.count_logical ?? '?'}L</div>
							</div>
						</div>

						<!-- GPU List -->
						{#if machine.gpu?.available && machine.gpu.gpus?.length}
							<div class="mt-3">
								{#each machine.gpu.gpus as gpu}
									{@const busy = gpu.memory.used_mib > 500}
									<div class="flex items-center gap-2 py-1.5 border-t border-border-light first:border-t-0 text-xs">
										<div class="flex-1 font-medium text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">{gpu.name}</div>
										<div class="font-mono text-[11px] font-medium">{safeLocale(gpu.memory.used_mib)}/{safeLocale(gpu.memory.total_mib)}</div>
										<span class={cn(
											'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
											busy ? 'bg-status-inuse-bg text-status-inuse' : 'bg-status-available-bg text-status-available'
										)}>
											{busy ? 'In Use' : 'Free'}
										</span>
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- ═══════════ GPU (sortable) ═══════════ -->
	<div class={getActivePage() === 'gpu' ? '' : 'hidden'}>
		<div class="flex flex-wrap gap-2 mb-5">
			<Badge class="bg-status-available-bg text-status-available border-status-available/30">Available</Badge>
			<Badge class="bg-status-inuse-bg text-status-inuse border-status-inuse/30">In Use</Badge>
			<Badge class="bg-status-critical-bg text-status-critical border-status-critical/30">Critical</Badge>
			<Badge class="bg-status-offline-bg text-status-offline-fg border-status-offline-fg/30">Offline</Badge>
		</div>
		<div class="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(26,29,35,0.04),0_4px_12px_rgba(26,29,35,0.03)] overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-[13px] border-collapse">
					<thead>
						<tr>
							<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap sticky left-0 z-[1] border-r border-border-light">Machine</th>
							<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">GPU</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => gpuSort = toggleSort(gpuSort, 'mem_total')}>
								<span class="inline-flex items-center gap-1">Total <svelte:component this={sortIcon(gpuSort, 'mem_total')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => gpuSort = toggleSort(gpuSort, 'mem_used')}>
								<span class="inline-flex items-center gap-1">Used <svelte:component this={sortIcon(gpuSort, 'mem_used')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Free</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => gpuSort = toggleSort(gpuSort, 'gpu_util')}>
								<span class="inline-flex items-center gap-1">GPU% <svelte:component this={sortIcon(gpuSort, 'gpu_util')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => gpuSort = toggleSort(gpuSort, 'mem_util')}>
								<span class="inline-flex items-center gap-1">Mem% <svelte:component this={sortIcon(gpuSort, 'mem_util')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => gpuSort = toggleSort(gpuSort, 'temp')}>
								<span class="inline-flex items-center gap-1">Temp <svelte:component this={sortIcon(gpuSort, 'temp')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">GFX</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Mem MHz</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => gpuSort = toggleSort(gpuSort, 'power')}>
								<span class="inline-flex items-center gap-1">Power <svelte:component this={sortIcon(gpuSort, 'power')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap">Driver</th>
						</tr>
					</thead>
					<tbody>
						<!-- Offline / No GPU machines -->
						{#each filteredHostnames() as hostname}
							{@const machine = getMachine(hostname)}
							{#if !machine}
								<tr class="bg-status-offline-bg">
									<td class="px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
									<td colspan="11" class="px-3.5 py-2.5 text-center italic text-status-offline-fg">{hostname} is offline</td>
								</tr>
							{:else if !machine.gpu?.available || !machine.gpu.gpus?.length}
								<tr class="bg-status-available-bg">
									<td class="px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
									<td colspan="11" class="px-3.5 py-2.5 text-center italic text-muted-foreground">No GPU</td>
								</tr>
							{/if}
						{/each}
						<!-- GPU rows (sortable) -->
						{#each getGpuRows() as row}
							{@const status = gpuStatusClass(row.gpu.memory.used_mib)}
							{@const hostBg = statusRowBg(worstGpuStatus(row.machine))}
							<tr
								class={cn(statusRowBg(status), 'cursor-pointer hover:brightness-[0.97] border-b border-border-light last:border-b-0')}
								onclick={() => openModal(`${row.hostname} \u2014 ${row.gpu.name} (GPU ${row.gpuIdx})`, row.gpu.processes ?? [])}
								title="Click to view running processes"
							>
								{#if row.isFirstOfHost}
									<td rowspan={row.hostGpuCount} class={cn('px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] border-r border-border-light', hostBg)}>{row.hostname}</td>
								{/if}
								<td class="px-3.5 py-2.5 text-left font-medium border-r border-border-light" style="font-family: var(--font-sans)">{row.gpu.name}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(row.gpu.memory.total_mib)}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(row.gpu.memory.used_mib)}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(row.gpu.memory.free_mib)}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{row.gpu.utilization.gpu_percent}%</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{row.gpu.utilization.memory_percent}%</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{row.gpu.temperature_c}&deg;C</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(row.gpu.clocks.graphics_mhz)}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(row.gpu.clocks.memory_mhz)}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{row.gpu.power.usage_watts != null ? `${row.gpu.power.usage_watts}W` : 'N/A'}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap">{row.machine.gpu?.driver_version ?? 'N/A'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- ═══════════ CPU & RAM (sortable) ═══════════ -->
	<div class={getActivePage() === 'cpu' ? '' : 'hidden'}>
		<div class="flex flex-wrap gap-2 mb-5">
			<Badge class="bg-status-available-bg text-status-available border-status-available/30">Available</Badge>
			<Badge class="bg-status-inuse-bg text-status-inuse border-status-inuse/30">In Use</Badge>
			<Badge class="bg-status-critical-bg text-status-critical border-status-critical/30">Critical</Badge>
			<Badge class="bg-status-offline-bg text-status-offline-fg border-status-offline-fg/30">Offline</Badge>
		</div>
		<div class="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(26,29,35,0.04),0_4px_12px_rgba(26,29,35,0.03)] overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-[13px] border-collapse">
					<thead>
						<tr>
							<th rowspan="2" class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap sticky left-0 z-[1] border-r border-border-light">Machine</th>
							<th colspan="4" class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b border-border-light bg-background border-r border-border-light">CPU</th>
							<th colspan="4" class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b border-border-light bg-background">RAM (MiB)</th>
						</tr>
						<tr>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => cpuSort = toggleSort(cpuSort, 'cpu_usage')}>
								<span class="inline-flex items-center gap-1">Usage <svelte:component this={sortIcon(cpuSort, 'cpu_usage')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => cpuSort = toggleSort(cpuSort, 'load_1m')}>
								<span class="inline-flex items-center gap-1">Load 1m <svelte:component this={sortIcon(cpuSort, 'load_1m')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => cpuSort = toggleSort(cpuSort, 'load_5m')}>
								<span class="inline-flex items-center gap-1">Load 5m <svelte:component this={sortIcon(cpuSort, 'load_5m')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Cores</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => cpuSort = toggleSort(cpuSort, 'ram_total')}>
								<span class="inline-flex items-center gap-1">Total <svelte:component this={sortIcon(cpuSort, 'ram_total')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => cpuSort = toggleSort(cpuSort, 'ram_used')}>
								<span class="inline-flex items-center gap-1">Used <svelte:component this={sortIcon(cpuSort, 'ram_used')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => cpuSort = toggleSort(cpuSort, 'ram_free')}>
								<span class="inline-flex items-center gap-1">Free <svelte:component this={sortIcon(cpuSort, 'ram_free')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background">Cached</th>
						</tr>
					</thead>
					<tbody>
						<!-- Offline machines -->
						{#each filteredHostnames() as hostname}
							{@const machine = getMachine(hostname)}
							{#if !machine}
								<tr class="bg-status-offline-bg border-b border-border-light last:border-b-0">
									<td class="px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
									<td colspan="8" class="px-3.5 py-2.5 text-center italic text-status-offline-fg">Offline</td>
								</tr>
							{:else if !machine.cpu || !machine.ram}
								<tr class="bg-status-available-bg border-b border-border-light last:border-b-0">
									<td class="px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
									<td colspan="8" class="px-3.5 py-2.5 text-center italic text-muted-foreground">No data</td>
								</tr>
							{/if}
						{/each}
						<!-- Sortable rows -->
						{#each getCpuRows() as row}
							{@const cpuSt = cpuStatusClass(row.machine.cpu!.percent)}
							{@const ramSt = ramStatusClass(row.machine)}
							<tr class={cn(statusRowBg(cpuSt), 'border-b border-border-light last:border-b-0')}>
								<td class="px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] bg-inherit border-r border-border-light">{row.hostname}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{row.machine.cpu!.percent}%</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{safeFixed(row.machine.cpu!.load_average?.['1min'])}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{safeFixed(row.machine.cpu!.load_average?.['5min'])}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{row.machine.cpu!.count_physical}/{row.machine.cpu!.count_logical}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{safeLocale(row.machine.ram!.total_mib)}</td>
								<td class={cn('px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light', statusRowBg(ramSt))}>{safeLocale(row.machine.ram!.used_mib)}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{safeLocale(row.machine.ram!.free_mib)}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs">{safeLocale(row.machine.ram!.cached_mib)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- ═══════════ Disk (sortable) ═══════════ -->
	<div class={getActivePage() === 'disk' ? '' : 'hidden'}>
		<div class="flex flex-wrap gap-2 mb-5">
			<Badge class="bg-status-available-bg text-status-available border-status-available/30">Available</Badge>
			<Badge class="bg-status-inuse-bg text-status-inuse border-status-inuse/30">In Use</Badge>
			<Badge class="bg-status-critical-bg text-status-critical border-status-critical/30">Critical</Badge>
			<Badge class="bg-status-offline-bg text-status-offline-fg border-status-offline-fg/30">Offline</Badge>
		</div>
		<div class="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(26,29,35,0.04),0_4px_12px_rgba(26,29,35,0.03)] overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-[13px] border-collapse">
					<thead>
						<tr>
							<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap sticky left-0 z-[1] border-r border-border-light">Machine</th>
							<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Mount</th>
							<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Device</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">FS</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => diskSort = toggleSort(diskSort, 'total')}>
								<span class="inline-flex items-center gap-1">Total GiB <svelte:component this={sortIcon(diskSort, 'total')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => diskSort = toggleSort(diskSort, 'used')}>
								<span class="inline-flex items-center gap-1">Used GiB <svelte:component this={sortIcon(diskSort, 'used')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light cursor-pointer hover:text-foreground select-none" onclick={() => diskSort = toggleSort(diskSort, 'free')}>
								<span class="inline-flex items-center gap-1">Free GiB <svelte:component this={sortIcon(diskSort, 'free')} class="size-3" /></span>
							</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap cursor-pointer hover:text-foreground select-none" onclick={() => diskSort = toggleSort(diskSort, 'usage')}>
								<span class="inline-flex items-center gap-1">Usage <svelte:component this={sortIcon(diskSort, 'usage')} class="size-3" /></span>
							</th>
						</tr>
					</thead>
					<tbody>
						<!-- Offline machines -->
						{#each filteredHostnames() as hostname}
							{@const machine = getMachine(hostname)}
							{#if !machine}
								<tr class="bg-status-offline-bg border-b border-border-light last:border-b-0">
									<td class="px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
									<td colspan="7" class="px-3.5 py-2.5 text-center italic text-status-offline-fg">Offline</td>
								</tr>
							{:else if !machine.disk?.partitions?.length}
								<tr class="bg-status-available-bg border-b border-border-light last:border-b-0">
									<td class="px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
									<td colspan="7" class="px-3.5 py-2.5 text-center italic text-muted-foreground">No disk info</td>
								</tr>
							{/if}
						{/each}
						<!-- Sortable disk rows -->
						{#each getDiskRows() as row}
							{@const dStatus = diskStatusClass(row.part.percent)}
							{@const hostBg = statusRowBg(worstDiskStatus(row.machine))}
							<tr class={cn(statusRowBg(dStatus), 'border-b border-border-light last:border-b-0')}>
								{#if row.isFirstOfHost}
									<td rowspan={row.hostPartCount} class={cn('px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] border-r border-border-light', hostBg)}>{row.hostname}</td>
								{/if}
								<td class="px-3.5 py-2.5 text-left text-[11px] border-r border-border-light">{row.part.mountpoint}</td>
								<td class="px-3.5 py-2.5 text-left text-[11px] border-r border-border-light">{row.part.device}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{row.part.fstype}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{row.part.total_gib}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{row.part.used_gib}</td>
								<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{row.part.free_gib}</td>
								<td class="px-3.5 py-2.5 text-center">
									<span class={statusTextColor(dStatus)}>{row.part.percent}%</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- ═══════════ Processes ═══════════ -->
	<div class={getActivePage() === 'processes' ? '' : 'hidden'}>
		{#each filteredHostnames() as hostname}
			{@const machine = getMachine(hostname)}
			<div class="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(26,29,35,0.04),0_4px_12px_rgba(26,29,35,0.03)] mb-4 overflow-hidden">
				<div class="flex items-center gap-2.5 px-5 py-4 border-b border-border-light">
					<div class="text-[15px] font-bold">{hostname}</div>
					{#if !machine}
						<Badge class="bg-status-offline-bg text-status-offline-fg border-status-offline-fg/30">Offline</Badge>
					{/if}
				</div>
				{#if machine}
					<div class="p-5">
						<div class="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
							{#each [{ key: 'top_by_cpu', label: 'Top by CPU' }, { key: 'top_by_memory', label: 'Top by Memory' }] as { key, label }}
								{@const procs = key === 'top_by_cpu' ? machine.processes?.top_by_cpu : machine.processes?.top_by_memory}
								<div>
									<h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">{label}</h4>
									{#if procs?.length}
										<div class="border border-border-light rounded-[10px] overflow-hidden">
											<table class="w-full text-xs border-collapse">
												<thead>
													<tr>
														<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">PID</th>
														<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">User</th>
														<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">CPU%</th>
														<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">RAM</th>
														<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">Command</th>
													</tr>
												</thead>
												<tbody>
													{#each procs as proc}
														<tr class="border-b border-border-light last:border-b-0">
															<td class="px-3.5 py-2 text-left font-mono text-[11px]">{proc.pid}</td>
															<td class="px-3.5 py-2 text-left">{proc.user}</td>
															<td class="px-3.5 py-2 text-center font-mono text-[11px]">{safeFixed(proc.cpu_percent)}</td>
															<td class="px-3.5 py-2 text-center font-mono text-[11px]">{safeLocale(proc.ram_mib)}</td>
															<td class="px-3.5 py-2 text-left max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px]" title={proc.command}>{proc.command}</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									{:else}
										<p class="text-sm text-muted-foreground italic">No process data</p>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- ═══════════ Alerts ═══════════ -->
	<div class={getActivePage() === 'alerts' ? '' : 'hidden'}>
		{#if data}
		{@const alerts = getAlerts()}
		{#if alerts.length === 0}
			<div class="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(26,29,35,0.04),0_4px_12px_rgba(26,29,35,0.03)]">
				<div class="flex flex-col items-center justify-center py-20 px-5 text-center">
					<div class="w-16 h-16 rounded-[20px] bg-orange-light flex items-center justify-center mb-5">
						<svg class="size-7 text-orange" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
					</div>
					<h3 class="text-lg font-bold mb-1.5">All Clear</h3>
					<p class="text-sm text-muted-foreground max-w-[360px]">No active alerts. All machines are operating within normal parameters.</p>
				</div>
			</div>
		{:else}
			<div class="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(26,29,35,0.04),0_4px_12px_rgba(26,29,35,0.03)] overflow-hidden py-1">
				{#each alerts as alert, i}
					<div class="flex items-start gap-3 px-5 py-4 {i < alerts.length - 1 ? 'border-b border-border-light' : ''}">
						<div class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style="background: var(--status-{alert.level === 'red' ? 'critical' : 'inuse'})"></div>
						<div>
							<div class="font-bold text-sm mb-0.5">{alert.machine}</div>
							<div class="text-[13px] text-muted-foreground">{alert.msg}</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-6 p-6 bg-card border border-border rounded-2xl text-center">
			<p class="text-sm text-muted-foreground">Custom alert rules (thresholds, notifications, email/Slack integration) coming soon.</p>
		</div>
		{/if}
	</div>

	<!-- ═══════════ Machine Detail ═══════════ -->
	<div class={getActivePage() === 'machine-detail' ? '' : 'hidden'}>
		{#if getActivePage() === 'machine-detail'}
		{@const hostname = getSelectedMachine()}
		{@const machine = getMachine(hostname)}
		{@const hist = getMachineHistory(hostname)}
		{#if machine}
			{@const cpuPct = machine.cpu?.percent ?? 0}
			{@const ramPct = machine.ram && machine.ram.total_mib > 0 ? Math.round((machine.ram.used_mib / machine.ram.total_mib) * 100) : 0}
			{@const st = overallStatus(machine)}

			<!-- Status + Timestamp -->
			<div class="flex items-center gap-3 mb-6">
				<div class={cn('w-3 h-3 rounded-full', statusDotColor(st))}></div>
				<span class={cn('text-sm font-semibold uppercase', statusTextColor(st))}>{st}</span>
				<span class="text-sm text-muted-foreground ml-auto">Last updated {timeSince(machine.timestamp)}</span>
			</div>

			<!-- Sparkline Charts -->
			{#if hist.length >= 2}
				<div class="grid grid-cols-2 gap-4 mb-6 max-sm:grid-cols-1">
					{#each [
						{ label: 'CPU', data: hist.map(h => h.cpu), current: cpuPct, unit: '%', color: 'var(--status-inuse)' },
						{ label: 'RAM', data: hist.map(h => h.ramPct), current: ramPct, unit: '%', color: 'var(--status-available)' },
						{ label: 'GPU Util', data: hist.map(h => h.gpuAvgUtil), current: machine.gpu?.gpus?.length ? Math.round(machine.gpu.gpus.reduce((s, g) => s + g.utilization.gpu_percent, 0) / machine.gpu.gpus.length) : 0, unit: '%', color: '#3b7dd8' },
						{ label: 'GPU Mem', data: hist.map(h => h.gpuAvgMemPct), current: machine.gpu?.gpus?.length ? Math.round(machine.gpu.gpus.reduce((s, g) => s + g.utilization.memory_percent, 0) / machine.gpu.gpus.length) : 0, unit: '%', color: '#8b5cf6' }
					] as chart}
						<div class="bg-card border border-border rounded-xl p-4">
							<div class="flex items-center justify-between mb-2">
								<div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{chart.label}</div>
								<div class="text-sm font-bold">{chart.current}{chart.unit}</div>
							</div>
							<svg class="w-full h-[48px]" viewBox="0 0 200 48" preserveAspectRatio="none">
								<path d={sparklinePath(chart.data, 200, 48)} fill="none" stroke={chart.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />
							</svg>
							<div class="flex justify-between text-[10px] text-muted-foreground mt-1">
								<span>{Math.round((hist.length - 1) * 0.5)}m ago</span>
								<span>now</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Resource Summary Cards -->
			<div class="grid grid-cols-4 gap-3 mb-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
				<div class="bg-card border border-border rounded-xl p-4">
					<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">CPU</div>
					<div class="text-2xl font-extrabold">{cpuPct}%</div>
					<div class="h-1.5 rounded-sm bg-border mt-2 overflow-hidden">
						<div class={cn('h-full rounded-sm', barColor(cpuPct))} style="width:{cpuPct}%"></div>
					</div>
					<div class="text-[11px] text-muted-foreground mt-1.5">{machine.cpu?.count_physical ?? '?'}P / {machine.cpu?.count_logical ?? '?'}L cores</div>
					{#if machine.cpu?.load_average}
						<div class="text-[11px] text-muted-foreground">Load: {safeFixed(machine.cpu.load_average['1min'])} / {safeFixed(machine.cpu.load_average['5min'])} / {safeFixed(machine.cpu.load_average['15min'])}</div>
					{/if}
				</div>
				<div class="bg-card border border-border rounded-xl p-4">
					<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">RAM</div>
					<div class="text-2xl font-extrabold">{ramPct}%</div>
					<div class="h-1.5 rounded-sm bg-border mt-2 overflow-hidden">
						<div class={cn('h-full rounded-sm', barColor(ramPct))} style="width:{ramPct}%"></div>
					</div>
					<div class="text-[11px] text-muted-foreground mt-1.5">{safeLocale(machine.ram?.used_mib)} / {safeLocale(machine.ram?.total_mib)} MiB</div>
					<div class="text-[11px] text-muted-foreground">{safeLocale(machine.ram?.free_mib)} free, {safeLocale(machine.ram?.cached_mib)} cached</div>
				</div>
				{#if machine.disk?.partitions?.length}
					{@const worstPart = machine.disk.partitions.reduce((a, b) => a.percent > b.percent ? a : b)}
					<div class="bg-card border border-border rounded-xl p-4">
						<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Disk (worst)</div>
						<div class="text-2xl font-extrabold">{worstPart.percent}%</div>
						<div class="h-1.5 rounded-sm bg-border mt-2 overflow-hidden">
							<div class={cn('h-full rounded-sm', barColor(worstPart.percent))} style="width:{worstPart.percent}%"></div>
						</div>
						<div class="text-[11px] text-muted-foreground mt-1.5">{worstPart.mountpoint} ({worstPart.device})</div>
						<div class="text-[11px] text-muted-foreground">{worstPart.free_gib} GiB free of {worstPart.total_gib} GiB</div>
					</div>
				{/if}
				{#if machine.gpu?.available && machine.gpu.gpus?.length}
					<div class="bg-card border border-border rounded-xl p-4">
						<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">GPUs</div>
						<div class="text-2xl font-extrabold">{machine.gpu.gpus.length}</div>
						<div class="text-[11px] text-muted-foreground mt-1.5">{machine.gpu.gpus.filter(g => g.memory.used_mib < 500).length} free, {machine.gpu.gpus.filter(g => g.memory.used_mib >= 500).length} in use</div>
						<div class="text-[11px] text-muted-foreground">Driver: {machine.gpu.driver_version ?? 'N/A'}</div>
					</div>
				{/if}
			</div>

			<!-- GPU Details -->
			{#if machine.gpu?.available && machine.gpu.gpus?.length}
				<div class="mb-6">
					<h3 class="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mb-3">GPU Details</h3>
					<div class="grid gap-3">
						{#each machine.gpu.gpus as gpu, gpuIdx}
							{@const gpuBusy = gpu.memory.used_mib > 500}
							<div class="bg-card border border-border rounded-xl p-4">
								<div class="flex items-center gap-2 mb-3">
									<span class="font-bold text-sm">GPU {gpuIdx}: {gpu.name}</span>
									<span class={cn(
										'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ml-auto',
										gpuBusy ? 'bg-status-inuse-bg text-status-inuse' : 'bg-status-available-bg text-status-available'
									)}>
										{gpuBusy ? 'In Use' : 'Free'}
									</span>
								</div>
								<div class="grid grid-cols-4 gap-3 text-xs max-sm:grid-cols-2">
									<div><span class="text-muted-foreground">Memory:</span> <span class="font-mono">{safeLocale(gpu.memory.used_mib)}/{safeLocale(gpu.memory.total_mib)} MiB</span></div>
									<div><span class="text-muted-foreground">GPU Util:</span> <span class="font-mono">{gpu.utilization.gpu_percent}%</span></div>
									<div><span class="text-muted-foreground">Temp:</span> <span class="font-mono">{gpu.temperature_c}&deg;C</span></div>
									<div><span class="text-muted-foreground">Power:</span> <span class="font-mono">{gpu.power.usage_watts != null ? `${gpu.power.usage_watts}W` : 'N/A'}{gpu.power.limit_watts != null ? ` / ${gpu.power.limit_watts}W` : ''}</span></div>
								</div>
								{#if gpu.processes?.length}
									<div class="mt-3 border-t border-border-light pt-3">
										<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Running Processes</div>
										<div class="border border-border-light rounded-lg overflow-hidden">
											<table class="w-full text-xs border-collapse">
												<thead>
													<tr>
														<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3 py-1.5 border-b border-border bg-background">PID</th>
														<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3 py-1.5 border-b border-border bg-background">User</th>
														<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3 py-1.5 border-b border-border bg-background">GPU Mem</th>
														<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3 py-1.5 border-b border-border bg-background">CPU%</th>
														<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3 py-1.5 border-b border-border bg-background">Command</th>
													</tr>
												</thead>
												<tbody>
													{#each gpu.processes as proc}
														<tr class="border-b border-border-light last:border-b-0">
															<td class="px-3 py-1.5 font-mono text-[11px]">{proc.pid}</td>
															<td class="px-3 py-1.5">{proc.user}</td>
															<td class="px-3 py-1.5 text-center font-mono text-[11px]">{safeLocale(proc.gpu_memory_mib)} MiB</td>
															<td class="px-3 py-1.5 text-center font-mono text-[11px]">{safeFixed(proc.cpu_percent)}</td>
															<td class="px-3 py-1.5 max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px]" title={proc.command}>{proc.command}</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Disk Partitions -->
			{#if machine.disk?.partitions?.length}
				<div class="mb-6">
					<h3 class="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Disk Partitions</h3>
					<div class="bg-card border border-border rounded-xl overflow-hidden">
						<table class="w-full text-[13px] border-collapse">
							<thead>
								<tr>
									<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">Mount</th>
									<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">Device</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">FS</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">Total</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">Used</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">Free</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">Usage</th>
								</tr>
							</thead>
							<tbody>
								{#each machine.disk.partitions as part}
									{@const dSt = diskStatusClass(part.percent)}
									<tr class={cn(statusRowBg(dSt), 'border-b border-border-light last:border-b-0')}>
										<td class="px-3.5 py-2 text-left text-[12px]">{part.mountpoint}</td>
										<td class="px-3.5 py-2 text-left text-[12px]">{part.device}</td>
										<td class="px-3.5 py-2 text-center font-mono text-xs">{part.fstype}</td>
										<td class="px-3.5 py-2 text-center font-mono text-xs">{part.total_gib} GiB</td>
										<td class="px-3.5 py-2 text-center font-mono text-xs">{part.used_gib} GiB</td>
										<td class="px-3.5 py-2 text-center font-mono text-xs">{part.free_gib} GiB</td>
										<td class="px-3.5 py-2 text-center"><span class={statusTextColor(dSt)}>{part.percent}%</span></td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Top Processes -->
			{#if machine.processes}
				<div class="mb-6">
					<h3 class="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Top Processes</h3>
					<div class="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
						{#each [{ key: 'top_by_cpu', label: 'By CPU' }, { key: 'top_by_memory', label: 'By Memory' }] as { key, label }}
							{@const procs = key === 'top_by_cpu' ? machine.processes?.top_by_cpu : machine.processes?.top_by_memory}
							<div>
								<h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</h4>
								{#if procs?.length}
									<div class="bg-card border border-border rounded-xl overflow-hidden">
										<table class="w-full text-xs border-collapse">
											<thead>
												<tr>
													<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">PID</th>
													<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">User</th>
													<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">CPU%</th>
													<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">RAM</th>
													<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2 border-b border-border bg-background">Command</th>
												</tr>
											</thead>
											<tbody>
												{#each procs as proc}
													<tr class="border-b border-border-light last:border-b-0">
														<td class="px-3.5 py-2 font-mono text-[11px]">{proc.pid}</td>
														<td class="px-3.5 py-2">{proc.user}</td>
														<td class="px-3.5 py-2 text-center font-mono text-[11px]">{safeFixed(proc.cpu_percent)}</td>
														<td class="px-3.5 py-2 text-center font-mono text-[11px]">{safeLocale(proc.ram_mib)}</td>
														<td class="px-3.5 py-2 max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px]" title={proc.command}>{proc.command}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{:else}
									<p class="text-sm text-muted-foreground italic">No process data</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{:else}
			<div class="text-center py-20">
				<p class="text-muted-foreground">Machine "{hostname}" is offline or not found.</p>
				<button class="mt-4 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors" onclick={goBackFromDetail}>
					Go Back
				</button>
			</div>
		{/if}
		{/if}
	</div>
{/if}

<!-- ═══════════ GPU Process Modal ═══════════ -->
{#if showModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] bg-[rgba(26,29,35,0.4)] backdrop-blur-[6px] flex items-center justify-center p-5 max-sm:p-2"
		id="gpu-modal-backdrop"
		role="dialog"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeModal(); }}
	>
		<div class="bg-card border border-border rounded-2xl max-w-[820px] w-full max-h-[85vh] max-sm:max-h-[95vh] flex flex-col shadow-[0_4px_24px_rgba(26,29,35,0.08)] animate-[modalIn_0.25s_ease-out]">
			<div class="flex items-center justify-between px-6 py-5 border-b border-border-light">
				<div class="text-base font-bold">{modalTitle}</div>
				<button
					class="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-background text-muted-foreground hover:bg-border-light hover:text-foreground transition-all cursor-pointer"
					onclick={closeModal}
					aria-label="Close modal"
				>
					<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
				</button>
			</div>
			<div class="px-6 py-5 max-sm:px-3 max-sm:py-3 overflow-y-auto">
				{#if modalProcs.length === 0}
					<div class="text-center text-muted-foreground py-10">No running processes on this GPU.</div>
				{:else}
					<div class="border border-border-light rounded-[10px] overflow-x-auto">
						<table class="w-full text-xs border-collapse">
							<thead>
								<tr>
									<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">PID</th>
									<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">User</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">Type</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">GPU Mem</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">CPU%</th>
									<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">RAM</th>
									<th class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-2.5 border-b border-border bg-background">Command</th>
								</tr>
							</thead>
							<tbody>
								{#each modalProcs as proc}
									<tr class="border-b border-border-light last:border-b-0">
										<td class="px-3.5 py-2.5 text-left font-mono text-[11px]">{proc.pid}</td>
										<td class="px-3.5 py-2.5 text-left">{proc.user}</td>
										<td class="px-3.5 py-2.5 text-center">
											<span class="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-light text-blue">{proc.type}</span>
										</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-[11px]">{safeLocale(proc.gpu_memory_mib)}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-[11px]">{safeFixed(proc.cpu_percent)}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-[11px]">{safeLocale(proc.ram_mib)}</td>
										<td class="px-3.5 py-2.5 text-left max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px]" title={proc.command}>{proc.command}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
