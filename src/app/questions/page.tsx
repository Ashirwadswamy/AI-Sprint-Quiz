import Link from "next/link";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { McqTable } from "@/components/mcq/McqTable";
import { buttonVariants } from "@/components/ui/button";
import { listMcqs, type Mcq } from "@/lib/services/mcq-service";
import { cn } from "@/lib/utils";

export default async function QuestionsPage() {
	let mcqs: Mcq[] = [];
	let loadError: string | null = null;

	try {
		mcqs = await listMcqs();
	} catch (error) {
		console.error("failed to load questions", error);
		loadError = "Unable to load questions right now.";
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 bg-background p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold text-foreground">Question bank</h1>
					<p className="text-sm text-muted-foreground">
						Create, edit, and delete multiple choice questions for the shared bank.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Link href="/questions/new" className={cn(buttonVariants())}>
						Create Multiple Choice Question
					</Link>
					<LogoutButton />
				</div>
			</div>
			{loadError ? <p className="text-sm text-destructive">{loadError}</p> : <McqTable mcqs={mcqs} />}
		</main>
	);
}
