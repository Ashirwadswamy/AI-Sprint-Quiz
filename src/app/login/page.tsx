import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-background p-6">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Sign in</CardTitle>
					<CardDescription>Use your QuizMaker username or email.</CardDescription>
				</CardHeader>
				<CardContent>
					<LoginForm />
					<p className="mt-4 text-sm text-muted-foreground">
						Need an account?{" "}
						<Link href="/register" className="text-primary underline-offset-4 hover:underline">
							Create account
						</Link>
					</p>
				</CardContent>
			</Card>
		</main>
	);
}
