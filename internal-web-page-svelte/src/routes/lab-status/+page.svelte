<script lang="ts">
	import YAML from 'yaml';
	import type { AllGpuStats, GpuProc, GpuStats } from '$lib/types';

	let data: AllGpuStats | null = $state(null);
	let loading = $state(true);
	let error = $state('');

	let selectedProcs: GpuProc[] = $state([]);
	let selectedGpuLabel = $state('');
	let showModal = $state(false);

	$effect(() => {
		fetch('/lab_machine_status.yml')
			.then((res) => {
				if (!res.ok) throw new Error('Failed to load status data');
				return res.text();
			})
			.then((text) => {
				data = YAML.parse(text);
				loading = false;
			})
			.catch((err) => {
				error = err.message;
				loading = false;
			});
	});

	function extractInt(strVal: string): number {
		return parseInt(strVal.split(' ')[0]);
	}

	function availabilityClass(gpuName: string, memUsed: string): string {
		if (gpuName === 'UNAVAILABLE') return 'unavailable';
		return extractInt(memUsed) > 500 ? 'inuse' : 'available';
	}

	function openProcesses(hostname: string, gpuIdx: number, gpuName: string) {
		if (!data) return;
		const gpu: GpuStats = data.server_gpu_info[hostname][gpuIdx][gpuName];

		if (gpu.gpu_processes === 'N/A' || gpu.gpu_processes === '{}') {
			selectedProcs = [];
			selectedGpuLabel = `${hostname} - ${gpuName} (GPU ${gpuIdx})`;
			showModal = true;
			return;
		}

		try {
			const parsed = JSON.parse(gpu.gpu_processes.replaceAll("'", '"'));
			const processes: Array<Record<string, string>> = [parsed.process_info].flat();
			const processInfo = JSON.parse(gpu.gpu_process_info.replaceAll("'", '"'));

			selectedProcs = processes.map((proc) => {
				const info: string[] = (processInfo[proc.pid] ?? ',,,,').split(',').map((s: string) => s.trim());
				return {
					pid: Number(proc.pid),
					name: proc.process_name,
					type: proc.type,
					used_memory: proc.used_memory,
					user: info[0] || 'N/A',
					start_time: info[1] || 'N/A',
					elapsed_time: info[2] || 'N/A',
					command: info[3] || 'N/A'
				};
			});
		} catch {
			selectedProcs = [];
		}

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
		if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
			closeModal();
		}
	}
</script>

<svelte:head>
	<title>Lab Machine Status - MISL Lab</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="page">
	<header>
		<a href="/" class="back-link">&larr; Home</a>
		<h1>Lab Machine Statuses {#if data}(Last Updated: {data.build_datetime}){/if}</h1>
		<div class="legend">
			<span class="legend-item available">Available</span>
			<span class="legend-item inuse">In Use</span>
			<span class="legend-item unavailable">Unavailable</span>
		</div>
	</header>

	{#if loading}
		<p class="status-msg">Loading...</p>
	{:else if error}
		<p class="status-msg error">{error}</p>
	{:else if !data}
		<p class="status-msg">No data available</p>
	{:else}
		<div class="table-wrapper">
			<table>
				<thead>
					<tr>
						<th rowspan="2">Machine</th>
						<th rowspan="2">GPU Type</th>
						<th colspan="3">Memory (MiB)</th>
						<th colspan="2">Clock (MHz)</th>
						<th rowspan="2">Temp</th>
						<th colspan="4">Utilization</th>
						<th rowspan="2">Driver</th>
						<th rowspan="2">CUDA</th>
						<th rowspan="2">cuDNN</th>
					</tr>
					<tr>
						<th>Total</th>
						<th>Used</th>
						<th>Free</th>
						<th>SM</th>
						<th>Mem</th>
						<th>GPU</th>
						<th>Mem</th>
						<th>Enc</th>
						<th>Dec</th>
					</tr>
				</thead>
				<tbody>
					{#each Object.keys(data.server_gpu_info) as hostname}
						{#each data.server_gpu_info[hostname] as hostObj, gpuIdx}
							{#each Object.keys(hostObj) as gpuName}
								{@const gpu = hostObj[gpuName]}
								{@const status = availabilityClass(gpuName, gpu.gpu_mem_usage.used)}
								<tr
									class={status}
									onclick={() => openProcesses(hostname, gpuIdx, gpuName)}
									title="Click to view running processes"
								>
									{#if gpuIdx === 0}
										<th rowspan={data.server_gpu_info[hostname].length} class="machine-name">
											{hostname}
										</th>
									{/if}
									<td class="gpu-name">{gpuName}</td>
									<td>{gpu.gpu_mem_usage.total}</td>
									<td>{gpu.gpu_mem_usage.used}</td>
									<td>{gpu.gpu_mem_usage.free}</td>
									<td>{gpu.gpu_freq.sm_clock}</td>
									<td>{gpu.gpu_freq.mem_clock}</td>
									<td>{gpu.gpu_temp}</td>
									<td>{gpu.gpu_util.gpu_util}</td>
									<td>{gpu.gpu_util.memory_util}</td>
									<td>{gpu.gpu_util.encoder_util}</td>
									<td>{gpu.gpu_util.decoder_util}</td>
									<td>{gpu.nvidia_driver}</td>
									<td>{gpu.cuda_versions}</td>
									<td>{gpu.cudnn_versions}</td>
								</tr>
							{/each}
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if showModal}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div class="modal-backdrop" onclick={handleBackdropClick}>
		<div class="modal" role="dialog" aria-label="GPU Process Details">
			<div class="modal-header">
				<h2>{selectedGpuLabel}</h2>
				<button class="close-btn" onclick={closeModal} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				{#if selectedProcs.length === 0}
					<p class="no-procs">No running processes on this GPU.</p>
				{:else}
					<table class="proc-table">
						<thead>
							<tr>
								<th>PID</th>
								<th>Name</th>
								<th>Memory</th>
								<th>User</th>
								<th>Start Time</th>
								<th>Elapsed</th>
								<th>Command</th>
							</tr>
						</thead>
						<tbody>
							{#each selectedProcs as proc}
								<tr>
									<td>{proc.pid}</td>
									<td>{proc.name}</td>
									<td>{proc.used_memory}</td>
									<td>{proc.user}</td>
									<td>{proc.start_time}</td>
									<td>{proc.elapsed_time}</td>
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
		margin: 0.5rem 0;
		font-size: 1.8rem;
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

	.status-msg {
		text-align: center;
		font-size: 1.1rem;
		color: var(--color-text-muted);
		margin-top: 4rem;
	}

	.status-msg.error {
		color: var(--color-unavailable-text);
	}

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

	tbody tr {
		cursor: pointer;
		transition: filter 0.15s ease;
	}

	tbody tr:hover td {
		filter: brightness(0.95);
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
</style>
