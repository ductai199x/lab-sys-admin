import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { tv, type VariantProps } from "tailwind-variants";

export const badgeVariants = tv({
	base: "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors",
	variants: {
		variant: {
			default:
				"border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
			secondary:
				"border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
			destructive:
				"border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20",
			outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
	variant?: BadgeVariant;
	children?: Snippet;
	class?: string;
};

export { default as Badge } from "./badge.svelte";
