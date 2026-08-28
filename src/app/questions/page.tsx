import { LogoutButton } from "@/components/auth/LogoutButton";

export default function QuestionsPage() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 bg-background p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold text-foreground">Question bank</h1>
					<p className="text-sm text-muted-foreground">Question management arrives next sprint.</p>
				</div>
				<LogoutButton />
			</div>
		</main>
	);
}
