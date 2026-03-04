<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	let {
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div
	data-slot="dialog-content"
	role="dialog"
	class={cn(
		"bg-background rounded-xl border shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
