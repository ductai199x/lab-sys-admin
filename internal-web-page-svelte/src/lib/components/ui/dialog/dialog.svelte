<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		open = $bindable(false),
		onClose,
		children,
	}: {
		open?: boolean;
		onClose?: () => void;
		children?: Snippet;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === "Escape") {
			e.stopPropagation();
			open = false;
			onClose?.();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).dataset.slot === "dialog-overlay") {
			open = false;
			onClose?.();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		data-slot="dialog-overlay"
		class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in-0"
		onclick={handleBackdropClick}
	>
		{@render children?.()}
	</div>
{/if}
