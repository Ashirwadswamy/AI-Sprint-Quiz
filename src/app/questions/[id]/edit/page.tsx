import Link from "next/link";
import { notFound } from "next/navigation";

import { McqForm } from "@/components/mcq/McqForm";
import { buttonVariants } from "@/components/ui/button";
import { getMcqById } from "@/lib/services/mcq-service";
import { cn } from "@/lib/utils";

export default async function EditQuestionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const mcq = await getMcqById(id);
	if (!mcq) {
		notFound();
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold text-foreground">Edit multiple choice question</h1>
					<p className="text-sm text-muted-foreground">Update the question text, description, or choices.</p>
				</div>
				<Link href="/questions" className={cn(buttonVariants({ variant: "outline" }))}>
					Back
				</Link>
			</div>
			<McqForm mcq={mcq} />
		</main>
	);
}
