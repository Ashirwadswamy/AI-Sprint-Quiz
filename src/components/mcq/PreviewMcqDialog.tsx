"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import type { McqWithChoices } from "@/lib/services/mcq-service";
import { cn } from "@/lib/utils";

type PreviewMcqDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mcqId: string | null;
};

export function PreviewMcqDialog({ open, onOpenChange, mcqId }: PreviewMcqDialogProps) {
	const [mcq, setMcq] = useState<McqWithChoices | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !mcqId) {
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				const response = await fetch(`/api/mcqs/${mcqId}`);
				const json = (await response.json().catch(() => null)) as
					| { mcq?: McqWithChoices; error?: { message?: string } }
					| null;

				if (cancelled) {
					return;
				}

				if (!response.ok || !json?.mcq) {
					setMcq(null);
					setError(json?.error?.message ?? "Unable to load question");
					return;
				}

				setError(null);
				setMcq(json.mcq);
			} catch {
				if (!cancelled) {
					setMcq(null);
					setError("Unable to load question");
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [open, mcqId]);

	const displayMcq = mcq && mcqId && mcq.id === mcqId ? mcq : null;
	const pending = open && Boolean(mcqId) && !displayMcq && !error;
	const choices = displayMcq
		? [...displayMcq.choices].sort((a, b) => a.position - b.position)
		: [];

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					setError(null);
					setMcq(null);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent className="sm:max-w-lg" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Preview</DialogTitle>
					<DialogDescription>
						{displayMcq ? (
							<>
								Admin preview of{" "}
								<span className="font-medium text-foreground">{displayMcq.name}</span>. The
								correct answer is marked for review.
							</>
						) : (
							"Loading the question as a student would see it."
						)}
					</DialogDescription>
				</DialogHeader>

				{pending ? <p className="text-sm text-muted-foreground">Loading preview...</p> : null}
				{error ? <FieldError errors={[{ message: error }]} /> : null}

				{displayMcq ? (
					<div className="flex flex-col gap-4">
						<p className="text-base font-medium text-foreground">{displayMcq.question}</p>
						<ul className="flex flex-col gap-2">
							{choices.map((choice) => (
								<li
									key={choice.id}
									className={cn(
										"flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm",
										choice.isCorrect && "border-primary/40 bg-primary/5",
									)}
								>
									<span>{choice.text}</span>
									{choice.isCorrect ? <Badge variant="secondary">Correct answer</Badge> : null}
								</li>
							))}
						</ul>
					</div>
				) : null}

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
