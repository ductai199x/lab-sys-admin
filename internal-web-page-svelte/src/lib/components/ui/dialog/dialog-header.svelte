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
	data-slot="dialog-header"
	class={cn(
		"flex flex-col gap-1.5 p-6 pb-0",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
