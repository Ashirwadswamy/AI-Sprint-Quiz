import Link from "next/link";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-background p-6">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Create your account</CardTitle>
					<CardDescription>Register to start using QuizMaker.</CardDescription>
				</CardHeader>
				<CardContent>
					<RegisterForm />
					<p className="mt-4 text-sm text-muted-foreground">
						Already have an account?{" "}
						<Link href="/login" className="text-primary underline-offset-4 hover:underline">
							Sign in
						</Link>
					</p>
				</CardContent>
			</Card>
		</main>
	);
}
