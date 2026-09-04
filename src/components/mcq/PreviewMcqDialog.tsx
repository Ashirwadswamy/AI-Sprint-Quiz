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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
	const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !mcqId) {
			return;
		}

		let cancelled = false;
		setSelectedChoiceId(null);

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
	const selectedChoice = choices.find((choice) => choice.id === selectedChoiceId) ?? null;

	function resetAndClose(next: boolean) {
		if (!next) {
			setError(null);
			setMcq(null);
			setSelectedChoiceId(null);
		}
		onOpenChange(next);
	}

	return (
		<Dialog open={open} onOpenChange={resetAndClose}>
			<DialogContent className="sm:max-w-lg" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Preview</DialogTitle>
					<DialogDescription>
						{displayMcq ? (
							<>
								Try{" "}
								<span className="font-medium text-foreground">{displayMcq.name}</span> the way a
								student would. Select a choice to check yourself. Your selection is not saved.
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
						<RadioGroup
							value={selectedChoiceId ?? ""}
							onValueChange={(value) => {
								if (value) {
									setSelectedChoiceId(value);
								}
							}}
							className="flex flex-col gap-2"
						>
							{choices.map((choice) => {
								const isSelected = selectedChoiceId === choice.id;
								const showResult = isSelected && selectedChoice !== null;
								const isCorrectSelection = showResult && choice.isCorrect;
								const isIncorrectSelection = showResult && !choice.isCorrect;

								return (
									<label
										key={choice.id}
										className={cn(
											"flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2 text-sm",
											isCorrectSelection && "border-primary/40 bg-primary/5",
											isIncorrectSelection && "border-destructive/40 bg-destructive/5",
										)}
									>
										<RadioGroupItem value={choice.id} className="mt-0.5" />
										<span className="flex-1">{choice.text}</span>
										{isCorrectSelection ? <Badge variant="secondary">Correct</Badge> : null}
										{isIncorrectSelection ? (
											<Badge variant="destructive">Incorrect</Badge>
										) : null}
									</label>
								);
							})}
						</RadioGroup>
					</div>
				) : null}

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => resetAndClose(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
