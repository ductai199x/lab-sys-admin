<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	let {
		class: className,
		value,
		active = false,
		children,
		...restProps
	}: HTMLButtonAttributes & {
		value?: string;
		active?: boolean;
		children?: Snippet;
		class?: string;
	} = $props();
</script>

<button
	data-slot="tabs-trigger"
	data-state={active ? "active" : "inactive"}
	role="tab"
	aria-selected={active}
	class={cn(
		"data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</button>
