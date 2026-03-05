<script lang="ts">
	import type { MachinesResponse, MachineData, GpuProcess } from '$lib/types';
	import { Badge } from '$lib/components/ui/badge';
	import { RefreshCw } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { untrack, tick } from 'svelte';
	import { getActivePage, setAlertCount } from '$lib/lab-state.svelte';

	type Status = 'available' | 'inuse' | 'critical' | 'offline';

	let data: MachinesResponse | null = $state(null);
	let loading = $state(true);
	let refreshing = $state(false);
	let error = $state('');

	// Modal state
	let showModal = $state(false);
	let modalTitle = $state('');
	let modalProcs: GpuProcess[] = $state([]);

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
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch data';
		}
		loading = false;
		refreshing = false;
	}

	$effect(() => {
		untrack(() => fetchData());
		const timer = setInterval(fetchData, 30000);
		return () => clearInterval(timer);
	});

	// Listen for refresh events from layout
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
					msg: `RAM usage critical — ${Math.round((m.ram.used_mib / m.ram.total_mib) * 100)}% used (${safeLocale(m.ram.free_mib)} MiB free)`
				});
			}
			if (m.disk?.partitions) {
				for (const p of m.disk.partitions) {
					if (p.percent > 90) {
						alerts.push({
							level: 'red',
							machine: name,
							msg: `Disk ${p.mountpoint} at ${p.percent}% — only ${p.free_gib} GiB free`
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

	// Update alert count in shared state
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
			<div class="text-[13px] text-muted-foreground">Click GPU rows in detail pages for process info</div>
		</div>

		<div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 mb-7 max-sm:grid-cols-1">
			{#each sortedHostnames() as hostname, idx}
				{@const machine = getMachine(hostname)}
				{@const st = machine ? overallStatus(machine) : 'offline'}
				<div
					class={cn(
						'bg-card border border-border rounded-2xl p-5 shadow-[0_1px_3px_rgba(26,29,35,0.04),0_4px_12px_rgba(26,29,35,0.03)] transition-all hover:shadow-[0_4px_24px_rgba(26,29,35,0.08)] hover:border-[#d5d0c8]',
						!machine && 'opacity-55'
					)}
					style="animation: cardIn 0.4s ease-out {idx * 0.04}s both"
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
								<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">CPU</div>
								<div class="text-[15px] font-bold tracking-tight">{cpuPct}%</div>
								<div class="h-1 rounded-sm bg-border mt-1.5 overflow-hidden">
									<div class={cn('h-full rounded-sm transition-[width] duration-500', barColor(cpuPct))} style="width:{cpuPct}%"></div>
								</div>
							</div>
							<div class="bg-background rounded-[10px] p-2.5 px-3">
								<div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">RAM</div>
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

	<!-- ═══════════ GPU ═══════════ -->
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
							<th rowspan="2" class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap sticky left-0 z-[1] border-r border-border-light">Machine</th>
							<th rowspan="2" class="text-left font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">GPU</th>
							<th colspan="3" class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b border-border-light bg-background border-r border-border-light">Memory (MiB)</th>
							<th colspan="2" class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b border-border-light bg-background border-r border-border-light">Utilization</th>
							<th rowspan="2" class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Temp</th>
							<th colspan="2" class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b border-border-light bg-background border-r border-border-light">Clock (MHz)</th>
							<th rowspan="2" class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Power</th>
							<th rowspan="2" class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap">Driver</th>
						</tr>
						<tr>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Total</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Used</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Free</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">GPU</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Mem</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">GFX</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Mem</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedHostnames() as hostname}
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
							{:else}
								{@const hostBg = statusRowBg(worstGpuStatus(machine))}
								{#each machine.gpu.gpus as gpu, gpuIdx}
									{@const status = gpuStatusClass(gpu.memory.used_mib)}
									<tr
										class={cn(statusRowBg(status), 'cursor-pointer hover:brightness-[0.97] border-b border-border-light last:border-b-0')}
										onclick={() => openModal(`${hostname} — ${gpu.name} (GPU ${gpuIdx})`, gpu.processes ?? [])}
										title="Click to view running processes"
									>
										{#if gpuIdx === 0}
											<td rowspan={machine.gpu.gpus.length} class={cn('px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] border-r border-border-light', hostBg)}>{hostname}</td>
										{/if}
										<td class="px-3.5 py-2.5 text-left font-medium border-r border-border-light" style="font-family: var(--font-sans)">{gpu.name}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(gpu.memory.total_mib)}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(gpu.memory.used_mib)}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(gpu.memory.free_mib)}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{gpu.utilization.gpu_percent}%</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{gpu.utilization.memory_percent}%</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{gpu.temperature_c}&deg;C</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(gpu.clocks.graphics_mhz)}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{safeLocale(gpu.clocks.memory_mhz)}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap border-r border-border-light">{gpu.power.usage_watts != null ? `${gpu.power.usage_watts}W` : 'N/A'}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs whitespace-nowrap">{machine.gpu.driver_version ?? 'N/A'}</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- ═══════════ CPU & RAM ═══════════ -->
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
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Usage</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Load 1m</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Load 5m</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Cores</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Total</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Used</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background border-r border-border-light">Free</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-1.5 border-b-2 border-border bg-background">Cached</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedHostnames() as hostname}
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
							{:else}
								{@const cpuSt = cpuStatusClass(machine.cpu.percent)}
								{@const ramSt = ramStatusClass(machine)}
								<tr class={cn(statusRowBg(cpuSt), 'border-b border-border-light last:border-b-0')}>
									<td class="px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] bg-inherit border-r border-border-light">{hostname}</td>
									<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{machine.cpu.percent}%</td>
									<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{safeFixed(machine.cpu.load_average?.['1min'])}</td>
									<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{safeFixed(machine.cpu.load_average?.['5min'])}</td>
									<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{machine.cpu.count_physical}/{machine.cpu.count_logical}</td>
									<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{safeLocale(machine.ram.total_mib)}</td>
									<td class={cn('px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light', statusRowBg(ramSt))}>{safeLocale(machine.ram.used_mib)}</td>
									<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{safeLocale(machine.ram.free_mib)}</td>
									<td class="px-3.5 py-2.5 text-center font-mono text-xs">{safeLocale(machine.ram.cached_mib)}</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- ═══════════ Disk ═══════════ -->
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
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Total GiB</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Used GiB</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap border-r border-border-light">Free GiB</th>
							<th class="text-center font-bold text-muted-foreground text-[10px] uppercase tracking-wider px-3.5 py-3 border-b-2 border-border bg-background whitespace-nowrap">Usage</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedHostnames() as hostname}
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
							{:else}
								{@const hostBg = statusRowBg(worstDiskStatus(machine))}
								{#each machine.disk.partitions as part, partIdx}
									{@const dStatus = diskStatusClass(part.percent)}
									<tr class={cn(statusRowBg(dStatus), 'border-b border-border-light last:border-b-0')}>
										{#if partIdx === 0}
											<td rowspan={machine.disk.partitions.length} class={cn('px-3.5 py-2.5 font-bold text-left sticky left-0 z-[1] border-r border-border-light', hostBg)}>{hostname}</td>
										{/if}
										<td class="px-3.5 py-2.5 text-left text-[11px] border-r border-border-light">{part.mountpoint}</td>
										<td class="px-3.5 py-2.5 text-left text-[11px] border-r border-border-light">{part.device}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{part.fstype}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{part.total_gib}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{part.used_gib}</td>
										<td class="px-3.5 py-2.5 text-center font-mono text-xs border-r border-border-light">{part.free_gib}</td>
										<td class="px-3.5 py-2.5 text-center">
											<span class={statusTextColor(dStatus)}>{part.percent}%</span>
										</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- ═══════════ Processes ═══════════ -->
	<div class={getActivePage() === 'processes' ? '' : 'hidden'}>
		{#each sortedHostnames() as hostname}
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
