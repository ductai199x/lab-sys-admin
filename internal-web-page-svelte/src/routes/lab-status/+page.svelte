<script lang="ts">
	import type { MachinesResponse, MachineData, GpuProcess } from '$lib/types';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import Button from '$lib/components/ui/button/button.svelte';
	import { ArrowLeft, Cpu, HardDrive, Activity, Monitor, X, RefreshCw } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	type Status = 'available' | 'inuse' | 'critical' | 'offline';

	let data: MachinesResponse | null = $state(null);
	let loading = $state(true);
	let refreshing = $state(false);
	let error = $state('');
	let activeTab: string = $state('gpu');

	let selectedGpuProcs: GpuProcess[] = $state([]);
	let selectedGpuLabel = $state('');
	let showModal = $state(false);

	async function fetchData() {
		if (!loading) refreshing = true;
		try {
			const res = await fetch('/api/machines');
			const body = await res.json();
			if (!res.ok) {
				// Use the server's error message if available, fall back to HTTP status
				error = body?.error ?? `HTTP ${res.status}`;
				// Still use partial data from error responses (known_machines, etc.)
				if (body?.machines !== undefined) {
					data = body as MachinesResponse;
				}
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
		fetchData();
		const timer = setInterval(fetchData, 30000);
		return () => clearInterval(timer);
	});

	function sortedHostnames(): string[] {
		if (!data) return [];
		const all =
			data.known_machines?.length > 0 ? data.known_machines : Object.keys(data.machines ?? {});
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

	/** Get the worst (most severe) GPU status for a machine's hostname cell. */
	function worstGpuStatus(machine: MachineData): Status {
		if (!machine.gpu?.available || !machine.gpu.gpus?.length) return 'available';
		let worst: Status = 'available';
		for (const gpu of machine.gpu.gpus) {
			const s = gpuStatusClass(gpu.memory.used_mib);
			if (s === 'inuse') worst = 'inuse';
		}
		return worst;
	}

	/** Get the worst disk partition status for a machine's hostname cell. */
	function worstDiskStatus(machine: MachineData): Status {
		if (!machine.disk?.partitions?.length) return 'available';
		const priority: Record<Status, number> = { available: 0, inuse: 1, critical: 2, offline: 3 };
		let worst: Status = 'available';
		for (const part of machine.disk.partitions) {
			const s = diskStatusClass(part.percent);
			if (priority[s] > priority[worst]) worst = s;
		}
		return worst;
	}

	function statusRowBg(status: Status): string {
		switch (status) {
			case 'available':
				return 'bg-status-available-bg';
			case 'inuse':
				return 'bg-status-inuse-bg';
			case 'critical':
				return 'bg-status-critical-bg';
			case 'offline':
				return 'bg-status-offline-bg';
			default: {
				const _exhaustive: never = status;
				return 'bg-status-offline-bg';
			}
		}
	}

	function statusTextColor(status: Status): string {
		switch (status) {
			case 'available':
				return 'text-status-available';
			case 'inuse':
				return 'text-status-inuse';
			case 'critical':
				return 'text-status-critical';
			case 'offline':
				return 'text-status-offline-fg';
			default: {
				const _exhaustive: never = status;
				return 'text-status-offline-fg';
			}
		}
	}

	function openGpuProcesses(
		hostname: string,
		gpuIdx: number,
		gpuName: string,
		processes: GpuProcess[]
	) {
		selectedGpuProcs = processes;
		selectedGpuLabel = `${hostname} - ${gpuName} (GPU ${gpuIdx})`;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
	}

	function handleGpuRowKeydown(
		e: KeyboardEvent,
		hostname: string,
		gpuIdx: number,
		gpuName: string,
		processes: GpuProcess[]
	) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openGpuProcesses(hostname, gpuIdx, gpuName, processes);
		}
	}

	function safeFixed(value: number | null | undefined, digits: number = 1): string {
		if (value == null || isNaN(value)) return 'N/A';
		return value.toFixed(digits);
	}

	function safeLocale(value: number | null | undefined): string {
		if (value == null || isNaN(value)) return 'N/A';
		return value.toLocaleString();
	}
</script>

<svelte:head>
	<title>Lab Machine Status - MISL Lab</title>
</svelte:head>

<div class="min-h-screen">
	<!-- Header -->
	<header class="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
		<div class="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
			<div class="flex items-center gap-4">
				<a href="/" class="text-muted-foreground hover:text-foreground transition-colors no-underline">
					<ArrowLeft class="size-4" />
				</a>
				<div class="flex-1">
					<h1 class="text-xl font-semibold tracking-tight">Lab Machine Statuses</h1>
					{#if data}
						<p class="text-sm text-muted-foreground mt-0.5">
							Updated {timeSince(data.fetched_at)} &middot; {data.machine_count} machine{data.machine_count !== 1 ? 's' : ''} online
						</p>
					{/if}
				</div>
				<Button variant="outline" size="sm" onclick={fetchData} disabled={refreshing}>
					<RefreshCw class={cn("size-3.5", refreshing && "animate-spin")} />
					{refreshing ? 'Refreshing...' : 'Refresh'}
				</Button>
			</div>

			<!-- Status Legend -->
			<div class="flex flex-wrap gap-2 mt-3">
				<Badge class="bg-status-available-bg text-status-available border-status-available/30">Available</Badge>
				<Badge class="bg-status-inuse-bg text-status-inuse border-status-inuse/30">In Use</Badge>
				<Badge class="bg-status-critical-bg text-status-critical border-status-critical/30">Critical</Badge>
				<Badge class="bg-status-offline-bg text-status-offline-fg border-status-offline-fg/30">Offline</Badge>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
		<!-- Tabs -->
		<Tabs bind:value={activeTab}>
			<TabsList class="mb-4">
				<TabsTrigger active={activeTab === 'gpu'} onclick={() => (activeTab = 'gpu')}>
					<Monitor class="size-3.5" />
					GPU
				</TabsTrigger>
				<TabsTrigger active={activeTab === 'cpu'} onclick={() => (activeTab = 'cpu')}>
					<Cpu class="size-3.5" />
					CPU & RAM
				</TabsTrigger>
				<TabsTrigger active={activeTab === 'disk'} onclick={() => (activeTab = 'disk')}>
					<HardDrive class="size-3.5" />
					Disk
				</TabsTrigger>
				<TabsTrigger active={activeTab === 'processes'} onclick={() => (activeTab = 'processes')}>
					<Activity class="size-3.5" />
					Processes
				</TabsTrigger>
			</TabsList>

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
						<Button variant="outline" size="sm" onclick={fetchData}>
							<RefreshCw class="size-3.5" />
							Retry
						</Button>
					{:else}
						<p class="text-muted-foreground">No data available</p>
					{/if}
				</div>
			{:else}
				{#if error}
					<div class="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
						{error} (showing last known data)
					</div>
				{/if}

				<!-- GPU Tab -->
				<TabsContent value="gpu" active={activeTab === 'gpu'}>
					<Card class="py-0 gap-0 overflow-hidden">
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b bg-muted/50">
										<th rowspan="2" class="text-left font-medium text-muted-foreground px-3 py-2.5 border-r sticky left-0 bg-muted/50 z-[1]">Machine</th>
										<th rowspan="2" class="text-left font-medium text-muted-foreground px-3 py-2.5 border-r">GPU</th>
										<th colspan="3" class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r border-b">Memory (MiB)</th>
										<th colspan="2" class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r border-b">Utilization</th>
										<th rowspan="2" class="text-center font-medium text-muted-foreground px-3 py-2.5 border-r">Temp</th>
										<th colspan="2" class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r border-b">Clock (MHz)</th>
										<th rowspan="2" class="text-center font-medium text-muted-foreground px-3 py-2.5 border-r">Power</th>
										<th rowspan="2" class="text-center font-medium text-muted-foreground px-3 py-2.5">Driver</th>
									</tr>
									<tr class="border-b bg-muted/50">
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Total</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Used</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Free</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">GPU</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Mem</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Graphics</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Mem</th>
									</tr>
								</thead>
								<tbody>
									{#each sortedHostnames() as hostname}
										{@const machine = getMachine(hostname)}
										{#if !machine}
											<tr class={cn("border-b transition-colors", statusRowBg('offline'))}>
												<td class="px-3 py-2 font-semibold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
												<td colspan="11" class="px-3 py-2 text-center italic text-status-offline-fg">Offline</td>
											</tr>
										{:else if !machine.gpu?.available || !machine.gpu.gpus?.length}
											<tr class={cn("border-b transition-colors", statusRowBg('available'))}>
												<td class="px-3 py-2 font-semibold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
												<td colspan="11" class="px-3 py-2 text-center italic text-muted-foreground">No GPU</td>
											</tr>
										{:else}
											{@const hostnameBg = statusRowBg(worstGpuStatus(machine))}
											{#each machine.gpu.gpus as gpu, gpuIdx}
												{@const status = gpuStatusClass(gpu.memory.used_mib)}
												<tr
													class={cn(
														"border-b transition-colors cursor-pointer hover:brightness-95",
														statusRowBg(status)
													)}
													onclick={() => openGpuProcesses(hostname, gpuIdx, gpu.name, gpu.processes ?? [])}
													onkeydown={(e) => handleGpuRowKeydown(e, hostname, gpuIdx, gpu.name, gpu.processes ?? [])}
													tabindex="0"
													role="button"
													aria-label={`View processes for ${hostname} ${gpu.name} GPU ${gpuIdx}`}
													title="Click to view running processes"
												>
													{#if gpuIdx === 0}
														<td
															rowspan={machine.gpu.gpus.length}
															class={cn("px-3 py-2 font-semibold text-left sticky left-0 z-[1] border-r", hostnameBg)}
														>
															{hostname}
														</td>
													{/if}
													<td class="px-3 py-2 text-left font-medium border-r">{gpu.name}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{gpu.memory.total_mib}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{gpu.memory.used_mib}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{gpu.memory.free_mib}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{gpu.utilization.gpu_percent}%</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{gpu.utilization.memory_percent}%</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{gpu.temperature_c}&deg;C</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{gpu.clocks.graphics_mhz}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{gpu.clocks.memory_mhz}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">
														{gpu.power.usage_watts != null ? `${gpu.power.usage_watts}W` : 'N/A'}
													</td>
													<td class="px-3 py-2 text-center">{machine.gpu.driver_version ?? 'N/A'}</td>
												</tr>
											{/each}
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					</Card>
				</TabsContent>

				<!-- CPU & RAM Tab -->
				<TabsContent value="cpu" active={activeTab === 'cpu'}>
					<Card class="py-0 gap-0 overflow-hidden">
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b bg-muted/50">
										<th rowspan="2" class="text-left font-medium text-muted-foreground px-3 py-2.5 border-r sticky left-0 bg-muted/50 z-[1]">Machine</th>
										<th colspan="4" class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r border-b">CPU</th>
										<th colspan="4" class="text-center font-medium text-muted-foreground px-3 py-1.5 border-b">RAM (MiB)</th>
									</tr>
									<tr class="border-b bg-muted/50">
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Usage</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Load (1m)</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Load (5m)</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Cores</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Total</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Used</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5 border-r">Free</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-1.5">Cached</th>
									</tr>
								</thead>
								<tbody>
									{#each sortedHostnames() as hostname}
										{@const machine = getMachine(hostname)}
										{#if !machine}
											<tr class={cn("border-b transition-colors", statusRowBg('offline'))}>
												<td class="px-3 py-2 font-semibold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
												<td colspan="8" class="px-3 py-2 text-center italic text-status-offline-fg">Offline</td>
											</tr>
										{:else}
											{@const cpuStatus = cpuStatusClass(machine.cpu.percent)}
											<tr class={cn("border-b transition-colors", statusRowBg(cpuStatus))}>
												<td class="px-3 py-2 font-semibold text-left sticky left-0 z-[1] bg-inherit border-r">{hostname}</td>
												<td class="px-3 py-2 text-center tabular-nums border-r">{machine.cpu.percent}%</td>
												<td class="px-3 py-2 text-center tabular-nums border-r">{safeFixed(machine.cpu.load_average?.['1min'])}</td>
												<td class="px-3 py-2 text-center tabular-nums border-r">{safeFixed(machine.cpu.load_average?.['5min'])}</td>
												<td class="px-3 py-2 text-center tabular-nums border-r">{machine.cpu.count_physical}/{machine.cpu.count_logical}</td>
												<td class="px-3 py-2 text-center tabular-nums border-r">{safeLocale(machine.ram.total_mib)}</td>
												<td class={cn("px-3 py-2 text-center tabular-nums border-r", statusRowBg(ramStatusClass(machine)))}>
													{safeLocale(machine.ram.used_mib)}
												</td>
												<td class="px-3 py-2 text-center tabular-nums border-r">{safeLocale(machine.ram.free_mib)}</td>
												<td class="px-3 py-2 text-center tabular-nums">{safeLocale(machine.ram.cached_mib)}</td>
											</tr>
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					</Card>
				</TabsContent>

				<!-- Disk Tab -->
				<TabsContent value="disk" active={activeTab === 'disk'}>
					<Card class="py-0 gap-0 overflow-hidden">
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b bg-muted/50">
										<th class="text-left font-medium text-muted-foreground px-3 py-2.5 border-r sticky left-0 bg-muted/50 z-[1]">Machine</th>
										<th class="text-left font-medium text-muted-foreground px-3 py-2.5 border-r">Mount</th>
										<th class="text-left font-medium text-muted-foreground px-3 py-2.5 border-r">Device</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-2.5 border-r">FS</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-2.5 border-r">Total (GiB)</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-2.5 border-r">Used (GiB)</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-2.5 border-r">Free (GiB)</th>
										<th class="text-center font-medium text-muted-foreground px-3 py-2.5">Usage</th>
									</tr>
								</thead>
								<tbody>
									{#each sortedHostnames() as hostname}
										{@const machine = getMachine(hostname)}
										{#if !machine}
											<tr class={cn("border-b transition-colors", statusRowBg('offline'))}>
												<td class="px-3 py-2 font-semibold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
												<td colspan="7" class="px-3 py-2 text-center italic text-status-offline-fg">Offline</td>
											</tr>
										{:else if !machine.disk?.partitions?.length}
											<tr class={cn("border-b transition-colors", statusRowBg('available'))}>
												<td class="px-3 py-2 font-semibold text-left sticky left-0 z-[1] bg-inherit">{hostname}</td>
												<td colspan="7" class="px-3 py-2 text-center italic text-muted-foreground">No disk info</td>
											</tr>
										{:else}
											{@const hostnameBg = statusRowBg(worstDiskStatus(machine))}
											{#each machine.disk.partitions as part, partIdx}
												{@const dStatus = diskStatusClass(part.percent)}
												<tr class={cn("border-b transition-colors", statusRowBg(dStatus))}>
													{#if partIdx === 0}
														<td
															rowspan={machine.disk.partitions.length}
															class={cn("px-3 py-2 font-semibold text-left sticky left-0 z-[1] border-r", hostnameBg)}
														>
															{hostname}
														</td>
													{/if}
													<td class="px-3 py-2 text-left font-mono text-xs border-r">{part.mountpoint}</td>
													<td class="px-3 py-2 text-left font-mono text-xs border-r">{part.device}</td>
													<td class="px-3 py-2 text-center border-r">{part.fstype}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{part.total_gib}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{part.used_gib}</td>
													<td class="px-3 py-2 text-center tabular-nums border-r">{part.free_gib}</td>
													<td class="px-3 py-2 text-center tabular-nums font-medium">
														<span class={statusTextColor(dStatus)}>{part.percent}%</span>
													</td>
												</tr>
											{/each}
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					</Card>
				</TabsContent>

				<!-- Processes Tab -->
				<TabsContent value="processes" active={activeTab === 'processes'}>
					<div class="flex flex-col gap-4">
						{#each sortedHostnames() as hostname}
							{@const machine = getMachine(hostname)}
							<Card>
								<CardHeader class="pb-0">
									<div class="flex items-center gap-2">
										<CardTitle class="text-base">{hostname}</CardTitle>
										{#if !machine}
											<Badge class="bg-status-offline-bg text-status-offline-fg border-status-offline-fg/30">Offline</Badge>
										{/if}
									</div>
								</CardHeader>
								{#if machine}
									<CardContent>
										<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
											<div>
												<h4 class="text-sm font-medium text-muted-foreground mb-2">Top by CPU</h4>
												{#if machine.processes?.top_by_cpu?.length}
													<div class="rounded-lg border overflow-hidden">
														<table class="w-full text-sm">
															<thead>
																<tr class="border-b bg-muted/50">
																	<th class="text-left font-medium text-muted-foreground px-3 py-2">PID</th>
																	<th class="text-left font-medium text-muted-foreground px-3 py-2">User</th>
																	<th class="text-center font-medium text-muted-foreground px-3 py-2">CPU%</th>
																	<th class="text-center font-medium text-muted-foreground px-3 py-2">RAM (MiB)</th>
																	<th class="text-left font-medium text-muted-foreground px-3 py-2">Command</th>
																</tr>
															</thead>
															<tbody>
																{#each machine.processes.top_by_cpu as proc}
																	<tr class="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
																		<td class="px-3 py-1.5 tabular-nums font-mono text-xs">{proc.pid}</td>
																		<td class="px-3 py-1.5">{proc.user}</td>
																		<td class="px-3 py-1.5 text-center tabular-nums">{safeFixed(proc.cpu_percent)}</td>
																		<td class="px-3 py-1.5 text-center tabular-nums">{proc.ram_mib}</td>
																		<td class="px-3 py-1.5 max-w-[300px] truncate font-mono text-xs" title={proc.command}>{proc.command}</td>
																	</tr>
																{/each}
															</tbody>
														</table>
													</div>
												{:else}
													<p class="text-sm text-muted-foreground italic">No process data</p>
												{/if}
											</div>
											<div>
												<h4 class="text-sm font-medium text-muted-foreground mb-2">Top by Memory</h4>
												{#if machine.processes?.top_by_memory?.length}
													<div class="rounded-lg border overflow-hidden">
														<table class="w-full text-sm">
															<thead>
																<tr class="border-b bg-muted/50">
																	<th class="text-left font-medium text-muted-foreground px-3 py-2">PID</th>
																	<th class="text-left font-medium text-muted-foreground px-3 py-2">User</th>
																	<th class="text-center font-medium text-muted-foreground px-3 py-2">CPU%</th>
																	<th class="text-center font-medium text-muted-foreground px-3 py-2">RAM (MiB)</th>
																	<th class="text-left font-medium text-muted-foreground px-3 py-2">Command</th>
																</tr>
															</thead>
															<tbody>
																{#each machine.processes.top_by_memory as proc}
																	<tr class="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
																		<td class="px-3 py-1.5 tabular-nums font-mono text-xs">{proc.pid}</td>
																		<td class="px-3 py-1.5">{proc.user}</td>
																		<td class="px-3 py-1.5 text-center tabular-nums">{safeFixed(proc.cpu_percent)}</td>
																		<td class="px-3 py-1.5 text-center tabular-nums">{proc.ram_mib}</td>
																		<td class="px-3 py-1.5 max-w-[300px] truncate font-mono text-xs" title={proc.command}>{proc.command}</td>
																	</tr>
																{/each}
															</tbody>
														</table>
													</div>
												{:else}
													<p class="text-sm text-muted-foreground italic">No process data</p>
												{/if}
											</div>
										</div>
									</CardContent>
								{/if}
							</Card>
						{/each}
					</div>
				</TabsContent>
			{/if}
		</Tabs>
	</main>
</div>

<!-- GPU Process Modal -->
<Dialog bind:open={showModal} onClose={closeModal}>
	<DialogContent class="max-w-3xl">
		<DialogHeader class="flex-row items-center justify-between">
			<DialogTitle>{selectedGpuLabel}</DialogTitle>
			<Button variant="ghost" size="icon" onclick={closeModal} class="size-8 shrink-0">
				<X class="size-4" />
			</Button>
		</DialogHeader>
		<div class="p-6 pt-4 overflow-auto">
			{#if selectedGpuProcs.length === 0}
				<p class="text-muted-foreground text-center py-6">No running processes on this GPU.</p>
			{:else}
				<div class="rounded-lg border overflow-hidden">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/50">
								<th class="text-left font-medium text-muted-foreground px-3 py-2">PID</th>
								<th class="text-left font-medium text-muted-foreground px-3 py-2">User</th>
								<th class="text-center font-medium text-muted-foreground px-3 py-2">Type</th>
								<th class="text-center font-medium text-muted-foreground px-3 py-2">GPU Mem (MiB)</th>
								<th class="text-center font-medium text-muted-foreground px-3 py-2">CPU%</th>
								<th class="text-center font-medium text-muted-foreground px-3 py-2">RAM (MiB)</th>
								<th class="text-left font-medium text-muted-foreground px-3 py-2">Command</th>
							</tr>
						</thead>
						<tbody>
							{#each selectedGpuProcs as proc}
								<tr class="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
									<td class="px-3 py-2 tabular-nums font-mono text-xs">{proc.pid}</td>
									<td class="px-3 py-2">{proc.user}</td>
									<td class="px-3 py-2 text-center">
										<Badge variant="outline">{proc.type}</Badge>
									</td>
									<td class="px-3 py-2 text-center tabular-nums">{proc.gpu_memory_mib}</td>
									<td class="px-3 py-2 text-center tabular-nums">{safeFixed(proc.cpu_percent)}</td>
									<td class="px-3 py-2 text-center tabular-nums">{proc.ram_mib}</td>
									<td class="px-3 py-2 max-w-[300px] truncate font-mono text-xs" title={proc.command}>{proc.command}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</DialogContent>
</Dialog>
