import Link from "next/link";

import { McqForm } from "@/components/mcq/McqForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NewQuestionPage() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold text-foreground">Create multiple choice question</h1>
					<p className="text-sm text-muted-foreground">
						Add a name, the question students will read, and two to six choices.
					</p>
				</div>
				<Link href="/questions" className={cn(buttonVariants({ variant: "outline" }))}>
					Back
				</Link>
			</div>
			<McqForm />
		</main>
	);
}
