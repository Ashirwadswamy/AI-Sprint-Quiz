"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { McqWithChoices } from "@/lib/services/mcq-service";

type ChoiceDraft = {
	key: string;
	text: string;
	isCorrect: boolean;
};

type FieldErrors = Partial<Record<"name" | "question" | "description" | "choices", string>>;

function newChoice(isCorrect = false): ChoiceDraft {
	return {
		key: crypto.randomUUID(),
		text: "",
		isCorrect,
	};
}

function choicesFromMcq(mcq: McqWithChoices): ChoiceDraft[] {
	return [...mcq.choices]
		.sort((a, b) => a.position - b.position)
		.map((choice) => ({
			key: choice.id,
			text: choice.text,
			isCorrect: choice.isCorrect,
		}));
}

const textareaClassName = cn(
	"min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
);

export function McqForm({ mcq }: { mcq?: McqWithChoices }) {
	const router = useRouter();
	const isEdit = Boolean(mcq);
	const [name, setName] = useState(mcq?.name ?? "");
	const [question, setQuestion] = useState(mcq?.question ?? "");
	const [description, setDescription] = useState(mcq?.description ?? "");
	const [choices, setChoices] = useState<ChoiceDraft[]>(
		mcq ? choicesFromMcq(mcq) : [newChoice(), newChoice()],
	);
	const [pending, setPending] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [formError, setFormError] = useState<string | null>(null);

	function updateChoice(index: number, patch: Partial<ChoiceDraft>) {
		setChoices((current) =>
			current.map((choice, choiceIndex) =>
				choiceIndex === index ? { ...choice, ...patch } : choice,
			),
		);
	}

	function markCorrect(index: number) {
		setChoices((current) =>
			current.map((choice, choiceIndex) => ({
				...choice,
				isCorrect: choiceIndex === index,
			})),
		);
	}

	function addChoice() {
		if (choices.length >= 6) {
			return;
		}
		setChoices((current) => [...current, newChoice()]);
	}

	function removeChoice(index: number) {
		if (choices.length <= 2) {
			return;
		}
		setChoices((current) => current.filter((_, choiceIndex) => choiceIndex !== index));
	}

	function validate(): boolean {
		const next: FieldErrors = {};
		const trimmedName = name.trim();
		const trimmedQuestion = question.trim();

		if (!trimmedName) {
			next.name = "Name is required";
		} else if (trimmedName.length > 200) {
			next.name = "Name must be at most 200 characters";
		}

		if (!trimmedQuestion) {
			next.question = "Question is required";
		} else if (trimmedQuestion.length > 2000) {
			next.question = "Question must be at most 2000 characters";
		}

		if (description.trim().length > 2000) {
			next.description = "Description must be at most 2000 characters";
		}

		if (choices.length < 2 || choices.length > 6) {
			next.choices = "A question needs between 2 and 6 choices";
		} else if (choices.some((choice) => !choice.text.trim())) {
			next.choices = "Each choice needs text";
		} else if (choices.filter((choice) => choice.isCorrect).length !== 1) {
			next.choices = "Exactly one choice must be marked correct";
		}

		setFieldErrors(next);
		return Object.keys(next).length === 0;
	}

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		if (!validate()) {
			return;
		}

		const payload = {
			name: name.trim(),
			question: question.trim(),
			description: description.trim() || undefined,
			choices: choices.map((choice) => ({
				text: choice.text.trim(),
				isCorrect: choice.isCorrect,
			})),
		};

		setPending(true);
		try {
			const response = await fetch(isEdit ? `/api/mcqs/${mcq!.id}` : "/api/mcqs", {
				method: isEdit ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (response.ok) {
				router.push("/questions");
				return;
			}

			if (response.status === 400) {
				const json = (await response.json().catch(() => null)) as
					| { error?: { fields?: FieldErrors; message?: string } }
					| null;
				if (json?.error?.fields) {
					setFieldErrors(json.error.fields);
				} else {
					setFormError(json?.error?.message ?? "Unable to save question");
				}
				return;
			}

			setFormError("Unable to save question");
		} finally {
			setPending(false);
		}
	}

	return (
		<form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
			<FieldGroup>
				<Field data-invalid={fieldErrors.name ? true : undefined}>
					<FieldLabel htmlFor="name">Name</FieldLabel>
					<FieldDescription>A short label for the question bank.</FieldDescription>
					<Input
						id="name"
						name="name"
						value={name}
						aria-invalid={Boolean(fieldErrors.name)}
						onChange={(event) => setName(event.target.value)}
					/>
					{fieldErrors.name ? <FieldError errors={[{ message: fieldErrors.name }]} /> : null}
				</Field>

				<Field data-invalid={fieldErrors.question ? true : undefined}>
					<FieldLabel htmlFor="question">Question</FieldLabel>
					<FieldDescription>What the student reads.</FieldDescription>
					<textarea
						id="question"
						name="question"
						value={question}
						aria-invalid={Boolean(fieldErrors.question)}
						className={textareaClassName}
						onChange={(event) => setQuestion(event.target.value)}
					/>
					{fieldErrors.question ? <FieldError errors={[{ message: fieldErrors.question }]} /> : null}
				</Field>

				<Field data-invalid={fieldErrors.description ? true : undefined}>
					<FieldLabel htmlFor="description">Description</FieldLabel>
					<textarea
						id="description"
						name="description"
						value={description}
						aria-invalid={Boolean(fieldErrors.description)}
						className={textareaClassName}
						onChange={(event) => setDescription(event.target.value)}
					/>
					{fieldErrors.description ? (
						<FieldError errors={[{ message: fieldErrors.description }]} />
					) : null}
				</Field>
			</FieldGroup>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-sm font-medium text-foreground">Choices</h2>
					<Button type="button" variant="outline" disabled={choices.length >= 6} onClick={addChoice}>
						Add choice
					</Button>
				</div>
				{fieldErrors.choices ? <FieldError errors={[{ message: fieldErrors.choices }]} /> : null}
				<RadioGroup
					value={
						choices.findIndex((choice) => choice.isCorrect) >= 0
							? String(choices.findIndex((choice) => choice.isCorrect))
							: ""
					}
					onValueChange={(value) => {
						if (value !== null && value !== undefined && value !== "") {
							markCorrect(Number(value));
						}
					}}
					className="flex flex-col gap-3"
				>
					{choices.map((choice, index) => (
						<div key={choice.key} className="flex items-start gap-3">
							<div className="mt-2">
								<RadioGroupItem
									value={String(index)}
									aria-label={`Mark choice ${index + 1} correct`}
								/>
							</div>
							<div className="flex-1">
								<label className="sr-only" htmlFor={`choice-${index}`}>
									Choice {index + 1} text
								</label>
								<Input
									id={`choice-${index}`}
									aria-label={`Choice ${index + 1} text`}
									value={choice.text}
									onChange={(event) => updateChoice(index, { text: event.target.value })}
								/>
							</div>
							<Button
								type="button"
								variant="ghost"
								disabled={choices.length <= 2}
								aria-label={`Remove choice ${index + 1}`}
								onClick={() => removeChoice(index)}
							>
								Remove
							</Button>
						</div>
					))}
				</RadioGroup>
			</div>

			{formError ? <FieldError errors={[{ message: formError }]} /> : null}

			<div className="flex items-center justify-end gap-2">
				<Button type="button" variant="outline" disabled={pending} onClick={() => router.push("/questions")}>
					Cancel
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? "Saving..." : "Save"}
				</Button>
			</div>
		</form>
	);
}
