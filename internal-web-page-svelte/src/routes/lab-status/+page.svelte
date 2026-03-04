<script lang="ts">
	import type { MachinesResponse, MachineData, GpuProcess } from '$lib/types';

	let data: MachinesResponse | null = $state(null);
	let loading = $state(true);
	let error = $state('');
	let activeTab: 'gpu' | 'cpu' | 'disk' | 'processes' = $state('gpu');

	let selectedGpuProcs: GpuProcess[] = $state([]);
	let selectedGpuLabel = $state('');
	let showModal = $state(false);

	async function fetchData() {
		try {
			const res = await fetch('/api/machines');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			data = await res.json();
			error = '';
		} catch (err) {
			error = (err as Error).message;
		}
		loading = false;
	}

	$effect(() => {
		fetchData();
		const timer = setInterval(fetchData, 30000);
		return () => clearInterval(timer);
	});

	function sortedHostnames(): string[] {
		if (!data) return [];
		const all =
			data.known_machines.length > 0 ? data.known_machines : Object.keys(data.machines);
		return [...new Set(all)].sort();
	}

	function getMachine(hostname: string): MachineData | null {
		return data?.machines[hostname] ?? null;
	}

	function timeSince(timestamp: string): string {
		const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
		if (seconds < 60) return `${seconds}s ago`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		return `${Math.floor(seconds / 3600)}h ago`;
	}

	function gpuStatusClass(usedMib: number): string {
		return usedMib > 500 ? 'inuse' : 'available';
	}

	function cpuStatusClass(percent: number): string {
		if (percent > 80) return 'unavailable';
		if (percent > 50) return 'inuse';
		return 'available';
	}

	function diskStatusClass(percent: number): string {
		if (percent > 90) return 'unavailable';
		if (percent > 70) return 'inuse';
		return 'available';
	}

	function ramStatusClass(machine: MachineData): string {
		const pct = (machine.ram.used_mib / machine.ram.total_mib) * 100;
		if (pct > 90) return 'unavailable';
		if (pct > 70) return 'inuse';
		return 'available';
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

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
	}

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('modal-backdrop')) closeModal();
	}
</script>

<svelte:head>
	<title>Lab Machine Status - MISL Lab</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="page">
	<header>
		<a href="/" class="back-link">&larr; Home</a>
		<h1>Lab Machine Statuses</h1>
		{#if data}
			<p class="last-updated">
				Last updated: {timeSince(data.fetched_at)} &middot; {data.machine_count} machine(s) online
			</p>
		{/if}
		<div class="legend">
			<span class="legend-item available">Available</span>
			<span class="legend-item inuse">In Use</span>
			<span class="legend-item unavailable">Critical</span>
			<span class="legend-item offline">Offline</span>
		</div>
	</header>

	<nav class="tabs">
		<button class:active={activeTab === 'gpu'} onclick={() => (activeTab = 'gpu')}>GPU</button>
		<button class:active={activeTab === 'cpu'} onclick={() => (activeTab = 'cpu')}
			>CPU & RAM</button
		>
		<button class:active={activeTab === 'disk'} onclick={() => (activeTab = 'disk')}>Disk</button>
		<button class:active={activeTab === 'processes'} onclick={() => (activeTab = 'processes')}
			>Processes</button
		>
	</nav>

	{#if loading}
		<p class="status-msg">Loading...</p>
	{:else if error}
		<p class="status-msg error">{error}</p>
	{:else if !data}
		<p class="status-msg">No data available</p>
	{:else}
		<!-- GPU Tab -->
		{#if activeTab === 'gpu'}
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th rowspan="2">Machine</th>
							<th rowspan="2">GPU</th>
							<th colspan="3">Memory (MiB)</th>
							<th colspan="2">Utilization</th>
							<th rowspan="2">Temp</th>
							<th colspan="2">Clock (MHz)</th>
							<th rowspan="2">Power</th>
							<th rowspan="2">Driver</th>
						</tr>
						<tr>
							<th>Total</th>
							<th>Used</th>
							<th>Free</th>
							<th>GPU</th>
							<th>Mem</th>
							<th>Graphics</th>
							<th>Mem</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedHostnames() as hostname}
							{@const machine = getMachine(hostname)}
							{#if !machine}
								<tr class="offline">
									<th class="machine-name">{hostname}</th>
									<td colspan="11" class="offline-cell">Offline</td>
								</tr>
							{:else if !machine.gpu.available || machine.gpu.gpus.length === 0}
								<tr class="available">
									<th class="machine-name">{hostname}</th>
									<td colspan="11" class="no-gpu-cell">No GPU</td>
								</tr>
							{:else}
								{#each machine.gpu.gpus as gpu, gpuIdx}
									{@const status = gpuStatusClass(gpu.memory.used_mib)}
									<tr
										class={status}
										onclick={() =>
											openGpuProcesses(hostname, gpuIdx, gpu.name, gpu.processes)}
										title="Click to view running processes"
									>
										{#if gpuIdx === 0}
											<th rowspan={machine.gpu.gpus.length} class="machine-name">
												{hostname}
											</th>
										{/if}
										<td class="gpu-name">{gpu.name}</td>
										<td>{gpu.memory.total_mib}</td>
										<td>{gpu.memory.used_mib}</td>
										<td>{gpu.memory.free_mib}</td>
										<td>{gpu.utilization.gpu_percent}%</td>
										<td>{gpu.utilization.memory_percent}%</td>
										<td>{gpu.temperature_c}&deg;C</td>
										<td>{gpu.clocks.graphics_mhz}</td>
										<td>{gpu.clocks.memory_mhz}</td>
										<td
											>{gpu.power.usage_watts != null
												? `${gpu.power.usage_watts}W`
												: 'N/A'}</td
										>
										<td>{machine.gpu.driver_version ?? 'N/A'}</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<!-- CPU & RAM Tab -->
		{#if activeTab === 'cpu'}
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th rowspan="2">Machine</th>
							<th colspan="4">CPU</th>
							<th colspan="4">RAM (MiB)</th>
						</tr>
						<tr>
							<th>Usage</th>
							<th>Load (1m)</th>
							<th>Load (5m)</th>
							<th>Cores</th>
							<th>Total</th>
							<th>Used</th>
							<th>Free</th>
							<th>Cached</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedHostnames() as hostname}
							{@const machine = getMachine(hostname)}
							{#if !machine}
								<tr class="offline">
									<th class="machine-name">{hostname}</th>
									<td colspan="8" class="offline-cell">Offline</td>
								</tr>
							{:else}
								<tr class={cpuStatusClass(machine.cpu.percent)}>
									<th class="machine-name">{hostname}</th>
									<td>{machine.cpu.percent}%</td>
									<td>{machine.cpu.load_average['1min'].toFixed(1)}</td>
									<td>{machine.cpu.load_average['5min'].toFixed(1)}</td>
									<td>{machine.cpu.count_physical}/{machine.cpu.count_logical}</td>
									<td>{machine.ram.total_mib.toLocaleString()}</td>
									<td class={ramStatusClass(machine)}
										>{machine.ram.used_mib.toLocaleString()}</td
									>
									<td>{machine.ram.free_mib.toLocaleString()}</td>
									<td>{machine.ram.cached_mib.toLocaleString()}</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<!-- Disk Tab -->
		{#if activeTab === 'disk'}
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>Machine</th>
							<th>Mount</th>
							<th>Device</th>
							<th>FS</th>
							<th>Total (GiB)</th>
							<th>Used (GiB)</th>
							<th>Free (GiB)</th>
							<th>Usage</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedHostnames() as hostname}
							{@const machine = getMachine(hostname)}
							{#if !machine}
								<tr class="offline">
									<th class="machine-name">{hostname}</th>
									<td colspan="7" class="offline-cell">Offline</td>
								</tr>
							{:else}
								{#each machine.disk.partitions as part, partIdx}
									<tr class={diskStatusClass(part.percent)}>
										{#if partIdx === 0}
											<th
												rowspan={machine.disk.partitions.length}
												class="machine-name"
											>
												{hostname}
											</th>
										{/if}
										<td>{part.mountpoint}</td>
										<td>{part.device}</td>
										<td>{part.fstype}</td>
										<td>{part.total_gib}</td>
										<td>{part.used_gib}</td>
										<td>{part.free_gib}</td>
										<td>{part.percent}%</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<!-- Processes Tab -->
		{#if activeTab === 'processes'}
			<div class="processes-container">
				{#each sortedHostnames() as hostname}
					{@const machine = getMachine(hostname)}
					<div class="machine-card">
						<h3>
							{hostname}
							{#if !machine}<span class="offline-badge">Offline</span>{/if}
						</h3>
						{#if machine}
							<div class="proc-sections">
								<div class="proc-section">
									<h4>Top by CPU</h4>
									<table class="proc-table">
										<thead>
											<tr>
												<th>PID</th>
												<th>User</th>
												<th>CPU%</th>
												<th>RAM (MiB)</th>
												<th>Command</th>
											</tr>
										</thead>
										<tbody>
											{#each machine.processes.top_by_cpu as proc}
												<tr>
													<td>{proc.pid}</td>
													<td>{proc.user}</td>
													<td>{proc.cpu_percent.toFixed(1)}</td>
													<td>{proc.ram_mib}</td>
													<td class="command-cell" title={proc.command}
														>{proc.command}</td
													>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
								<div class="proc-section">
									<h4>Top by Memory</h4>
									<table class="proc-table">
										<thead>
											<tr>
												<th>PID</th>
												<th>User</th>
												<th>CPU%</th>
												<th>RAM (MiB)</th>
												<th>Command</th>
											</tr>
										</thead>
										<tbody>
											{#each machine.processes.top_by_memory as proc}
												<tr>
													<td>{proc.pid}</td>
													<td>{proc.user}</td>
													<td>{proc.cpu_percent.toFixed(1)}</td>
													<td>{proc.ram_mib}</td>
													<td class="command-cell" title={proc.command}
														>{proc.command}</td
													>
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
		{/if}
	{/if}
</div>

<!-- GPU Process Modal -->
{#if showModal}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div class="modal-backdrop" onclick={handleBackdropClick}>
		<div class="modal" role="dialog" aria-label="GPU Process Details">
			<div class="modal-header">
				<h2>{selectedGpuLabel}</h2>
				<button class="close-btn" onclick={closeModal} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				{#if selectedGpuProcs.length === 0}
					<p class="no-procs">No running processes on this GPU.</p>
				{:else}
					<table class="proc-table">
						<thead>
							<tr>
								<th>PID</th>
								<th>User</th>
								<th>Type</th>
								<th>GPU Mem (MiB)</th>
								<th>CPU%</th>
								<th>RAM (MiB)</th>
								<th>Command</th>
							</tr>
						</thead>
						<tbody>
							{#each selectedGpuProcs as proc}
								<tr>
									<td>{proc.pid}</td>
									<td>{proc.user}</td>
									<td>{proc.type}</td>
									<td>{proc.gpu_memory_mib}</td>
									<td>{proc.cpu_percent.toFixed(1)}</td>
									<td>{proc.ram_mib}</td>
									<td class="command-cell" title={proc.command}>{proc.command}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		max-width: 100%;
		padding: 1.5rem 2rem;
	}

	header {
		margin-bottom: 1.5rem;
	}

	.back-link {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	h1 {
		margin: 0.5rem 0 0.25rem;
		font-size: 1.8rem;
	}

	.last-updated {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.legend {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
		font-size: 0.85rem;
	}

	.legend-item {
		padding: 0.2rem 0.75rem;
		border-radius: 4px;
		font-weight: 500;
	}

	.legend-item.available {
		background: var(--color-available);
		border: 1px solid var(--color-available-border);
	}

	.legend-item.inuse {
		background: var(--color-inuse);
		border: 1px solid var(--color-inuse-border);
	}

	.legend-item.unavailable {
		background: var(--color-unavailable);
		border: 1px solid var(--color-unavailable-border);
		color: var(--color-unavailable-text);
	}

	.legend-item.offline {
		background: #e0e0e0;
		border: 1px solid #bbb;
		color: #666;
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid var(--color-border);
	}

	.tabs button {
		padding: 0.6rem 1.5rem;
		border: none;
		background: none;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.tabs button:hover {
		color: var(--color-text);
	}

	.tabs button.active {
		color: var(--color-primary, #4361ee);
		border-bottom-color: var(--color-primary, #4361ee);
	}

	.status-msg {
		text-align: center;
		font-size: 1.1rem;
		color: var(--color-text-muted);
		margin-top: 4rem;
	}

	.status-msg.error {
		color: var(--color-unavailable-text);
	}

	/* Tables */
	.table-wrapper {
		overflow-x: auto;
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		border: 1px solid var(--color-border);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		white-space: nowrap;
	}

	thead th {
		background: #f1f3f5;
		font-weight: 600;
		text-align: center;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--color-border);
		position: sticky;
		top: 0;
		z-index: 1;
	}

	tbody td {
		text-align: center;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
	}

	tbody th.machine-name {
		text-align: left;
		font-weight: 600;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		background: #f8f9fa;
		vertical-align: middle;
	}

	.gpu-name {
		text-align: left !important;
		font-weight: 500;
	}

	tr.available td {
		background: var(--color-available);
	}

	tr.inuse td {
		background: var(--color-inuse);
	}

	tr.unavailable td {
		background: var(--color-unavailable);
		color: var(--color-unavailable-text);
	}

	tr.offline td {
		background: #e9ecef;
		color: #666;
	}

	.offline-cell,
	.no-gpu-cell {
		text-align: center !important;
		font-style: italic;
		color: #888;
	}

	tbody tr {
		cursor: pointer;
		transition: filter 0.15s ease;
	}

	tbody tr:hover td {
		filter: brightness(0.95);
	}

	/* Processes tab */
	.processes-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.machine-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1rem 1.25rem;
	}

	.machine-card h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.offline-badge {
		font-size: 0.75rem;
		background: #e0e0e0;
		color: #666;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		font-weight: 400;
	}

	.proc-sections {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	@media (max-width: 900px) {
		.proc-sections {
			grid-template-columns: 1fr;
		}
	}

	.proc-section h4 {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	/* Shared proc table styles */
	.proc-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}

	.proc-table th {
		background: #f1f3f5;
		font-weight: 600;
		text-align: left;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--color-border);
	}

	.proc-table td {
		text-align: left;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--color-border);
	}

	.command-cell {
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 2rem;
	}

	.modal {
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		max-width: 900px;
		width: 100%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-text-muted);
		padding: 0 0.25rem;
		line-height: 1;
	}

	.close-btn:hover {
		color: var(--color-text);
	}

	.modal-body {
		padding: 1rem 1.25rem;
		overflow: auto;
	}

	.no-procs {
		color: var(--color-text-muted);
		text-align: center;
		padding: 1rem 0;
	}
</style>
