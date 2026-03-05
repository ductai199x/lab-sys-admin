<script lang="ts">
	import {
		LayoutGrid,
		Monitor,
		Cpu,
		HardDrive,
		Activity,
		Bell,
		RefreshCw,
		Sun,
		Moon
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { initTheme, toggleTheme, isDark } from '$lib/theme.svelte';
	import { type PageId, getActivePage, setActivePage, getAlertCount } from '$lib/lab-state.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	const pageTitles: Record<PageId, string> = {
		overview: 'Overview',
		gpu: 'GPU',
		cpu: 'CPU & RAM',
		disk: 'Disk',
		processes: 'Processes',
		alerts: 'Alerts'
	};

	const navItems: { id: PageId; label: string; section: 'monitor' | 'system' }[] = [
		{ id: 'overview', label: 'Overview', section: 'monitor' },
		{ id: 'gpu', label: 'GPU', section: 'monitor' },
		{ id: 'cpu', label: 'CPU & RAM', section: 'monitor' },
		{ id: 'disk', label: 'Disk', section: 'monitor' },
		{ id: 'processes', label: 'Processes', section: 'monitor' },
		{ id: 'alerts', label: 'Alerts', section: 'system' }
	];

	function handleRefresh() {
		window.dispatchEvent(new CustomEvent('lab-refresh'));
	}

	onMount(() => {
		initTheme();
	});
</script>

<svelte:head>
	<title>{pageTitles[getActivePage()]} - MISL Lab Dashboard</title>
</svelte:head>

<div class="flex min-h-screen">
	<!-- Sidebar -->
	<aside class="w-[220px] min-h-screen bg-sidebar-bg fixed left-0 top-0 bottom-0 z-50 flex flex-col py-6 px-4 max-md:hidden">
		<!-- Brand -->
		<div class="flex items-center gap-3 px-2 mb-8">
			<div class="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-[#3b7dd8] to-[#2d9d5e] flex items-center justify-center font-extrabold text-base text-white">
				M
			</div>
			<div class="text-white font-bold text-[17px] tracking-tight">MISL Lab</div>
		</div>

		<!-- Navigation -->
		<nav class="flex flex-col gap-1 flex-1">
			<div class="text-[10px] font-bold tracking-[1.2px] uppercase text-[#555860] px-3 pt-4 pb-1.5">
				Monitor
			</div>
			{#each navItems.filter((n) => n.section === 'monitor') as item}
				<button
					class={cn(
						'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left transition-all duration-150 cursor-pointer',
						getActivePage() === item.id
							? 'bg-sidebar-active text-sidebar-text-active'
							: 'text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da]'
					)}
					onclick={() => setActivePage(item.id)}
				>
					{#if item.id === 'overview'}
						<LayoutGrid class="size-[18px] shrink-0" />
					{:else if item.id === 'gpu'}
						<Monitor class="size-[18px] shrink-0" />
					{:else if item.id === 'cpu'}
						<Cpu class="size-[18px] shrink-0" />
					{:else if item.id === 'disk'}
						<HardDrive class="size-[18px] shrink-0" />
					{:else if item.id === 'processes'}
						<Activity class="size-[18px] shrink-0" />
					{/if}
					{item.label}
				</button>
			{/each}

			<div class="text-[10px] font-bold tracking-[1.2px] uppercase text-[#555860] px-3 pt-4 pb-1.5">
				System
			</div>
			{#each navItems.filter((n) => n.section === 'system') as item}
				<button
					class={cn(
						'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left transition-all duration-150 cursor-pointer',
						getActivePage() === item.id
							? 'bg-sidebar-active text-sidebar-text-active'
							: 'text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da]'
					)}
					onclick={() => setActivePage(item.id)}
				>
					<Bell class="size-[18px] shrink-0" />
					{item.label}
					{#if item.id === 'alerts' && getAlertCount() > 0}
						<span class="ml-auto bg-red-card text-white text-[10px] font-bold py-px px-[7px] rounded-full min-w-[20px] text-center">
							{getAlertCount()}
						</span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="border-t border-sidebar-border pt-4 mt-2 flex flex-col gap-1">
			<button
				class="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da] transition-all duration-150 cursor-pointer"
				onclick={toggleTheme}
			>
				{#if isDark()}
					<Sun class="size-[18px] shrink-0" />
					Light Mode
				{:else}
					<Moon class="size-[18px] shrink-0" />
					Dark Mode
				{/if}
			</button>
			<button
				class="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da] transition-all duration-150 cursor-pointer"
				onclick={handleRefresh}
			>
				<RefreshCw class="size-[18px] shrink-0" />
				Refresh Data
			</button>
		</div>
	</aside>

	<!-- Main Area -->
	<div class="flex-1 ml-[220px] min-h-screen max-md:ml-0">
		<!-- Top Bar -->
		<header class="flex items-center gap-4 px-8 py-4 bg-background border-b border-border-light sticky top-0 z-40">
			<div class="text-[22px] font-extrabold tracking-tight flex-1">{pageTitles[getActivePage()]}</div>
			<div class="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm text-muted-foreground min-w-[260px]">
				<svg class="size-4 opacity-40 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
				<input type="text" placeholder="Search machines, users, processes..." class="border-none bg-transparent outline-none font-sans text-sm text-foreground w-full placeholder:text-muted-foreground" />
			</div>
			<div class="size-9 rounded-full bg-gradient-to-br from-[#3b7dd8] to-[#2d9d5e] flex items-center justify-center text-white font-bold text-sm">
				T
			</div>
		</header>

		<!-- Page Content -->
		<div class="p-7 px-8">
			{@render children()}
		</div>
	</div>
</div>
