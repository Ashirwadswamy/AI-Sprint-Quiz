"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { hashPasswordForTransport } from "@/lib/client-password";

export function LoginForm() {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const identifier = String(form.get("identifier") ?? "").trim();
		const password = String(form.get("password") ?? "");

		if (!identifier || !password) {
			setFormError("Username or email and password are required");
			return;
		}

		setFormError(null);
		setPending(true);
		try {
			const passwordHash = await hashPasswordForTransport(password);
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ identifier, passwordHash }),
			});

			if (response.status === 200) {
				router.push("/questions");
				return;
			}

			if (response.status === 401) {
				setFormError("Invalid username or password");
				return;
			}

			setFormError("Unable to sign in");
		} finally {
			setPending(false);
		}
	}

	return (
		<form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="identifier">Username or email</FieldLabel>
					<Input id="identifier" name="identifier" autoComplete="username" />
				</Field>
				<Field>
					<FieldLabel htmlFor="password">Password</FieldLabel>
					<Input id="password" name="password" type="password" autoComplete="current-password" />
				</Field>
			</FieldGroup>
			{formError ? <FieldError errors={[{ message: formError }]} /> : null}
			<Button type="submit" disabled={pending}>
				{pending ? "Signing in..." : "Sign in"}
			</Button>
		</form>
	);
}
