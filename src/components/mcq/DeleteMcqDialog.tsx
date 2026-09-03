"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";

type DeleteMcqDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mcq: { id: string; name: string } | null;
};

export function DeleteMcqDialog({ open, onOpenChange, mcq }: DeleteMcqDialogProps) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onConfirm() {
		if (!mcq) {
			return;
		}

		setError(null);
		setPending(true);
		try {
			const response = await fetch(`/api/mcqs/${mcq.id}`, { method: "DELETE" });
			if (!response.ok) {
				const json = (await response.json().catch(() => null)) as
					| { error?: { message?: string } }
					| null;
				setError(json?.error?.message ?? "Unable to delete question");
				return;
			}

			onOpenChange(false);
			router.refresh();
		} catch {
			setError("Unable to delete question");
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					setError(null);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Delete multiple choice question</DialogTitle>
					<DialogDescription>
						This will permanently delete{" "}
						<span className="font-medium text-foreground">{mcq?.name}</span> and all of its
						associated choices. This cannot be undone.
					</DialogDescription>
				</DialogHeader>
				{error ? <FieldError errors={[{ message: error }]} /> : null}
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={pending}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
						{pending ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
