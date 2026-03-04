<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils";

	let {
		class: className,
		value = $bindable(""),
		onValueChange,
		children,
		...restProps
	}: {
		class?: string;
		value?: string;
		onValueChange?: (value: string) => void;
		children?: Snippet;
	} = $props();
</script>

<div
	data-slot="tabs"
	data-value={value}
	class={cn("flex flex-col gap-2", className)}
	{...restProps}
>
	{@render children?.()}
</div>
