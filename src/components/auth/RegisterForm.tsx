"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { hashPasswordForTransport } from "@/lib/client-password";

type FieldKey = "firstName" | "lastName" | "username" | "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldKey, string>>;

const USERNAME = /^[A-Za-z0-9._@-]+$/;
const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /\d/;

function fieldError(message?: string) {
	return message ? [{ message }] : undefined;
}

export function RegisterForm() {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [errors, setErrors] = useState<FieldErrors>({});

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const firstName = String(form.get("firstName") ?? "").trim();
		const lastName = String(form.get("lastName") ?? "").trim();
		const username = String(form.get("username") ?? "").trim();
		const email = String(form.get("email") ?? "").trim();
		const password = String(form.get("password") ?? "");
		const confirmPassword = String(form.get("confirmPassword") ?? "");

		const next: FieldErrors = {};
		if (firstName.length < 1 || firstName.length > 100) {
			next.firstName = "First name is required";
		}
		if (lastName.length < 1 || lastName.length > 100) {
			next.lastName = "Last name is required";
		}
		if (username.length < 3 || username.length > 50 || !USERNAME.test(username)) {
			next.username = "Enter a valid username";
		}
		if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			next.email = "Enter a valid email";
		}
		if (password.length < 8 || !HAS_LETTER.test(password) || !HAS_DIGIT.test(password)) {
			next.password = "Password must be at least 8 characters and include a letter and a digit";
		}
		if (password !== confirmPassword) {
			next.confirmPassword = "Passwords do not match";
		}

		if (Object.keys(next).length > 0) {
			setErrors(next);
			return;
		}

		setErrors({});
		setPending(true);
		try {
			const passwordHash = await hashPasswordForTransport(password);
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ firstName, lastName, username, email, passwordHash }),
			});

			if (response.status === 201) {
				router.push("/questions");
				return;
			}

			const payload = (await response.json().catch(() => null)) as {
				error?: { fields?: Record<string, string> };
			} | null;
			const fields = payload?.error?.fields ?? {};
			setErrors({
				firstName: fields.firstName,
				lastName: fields.lastName,
				username: fields.username,
				email: fields.email,
				password: fields.passwordHash ?? fields.password,
			});
		} finally {
			setPending(false);
		}
	}

	return (
		<form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
			<FieldGroup>
				<Field data-invalid={errors.firstName ? true : undefined}>
					<FieldLabel htmlFor="first-name">First name</FieldLabel>
					<Input id="first-name" name="firstName" autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} />
					<FieldError errors={fieldError(errors.firstName)} />
				</Field>
				<Field data-invalid={errors.lastName ? true : undefined}>
					<FieldLabel htmlFor="last-name">Last name</FieldLabel>
					<Input id="last-name" name="lastName" autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} />
					<FieldError errors={fieldError(errors.lastName)} />
				</Field>
				<Field data-invalid={errors.username ? true : undefined}>
					<FieldLabel htmlFor="username">Username</FieldLabel>
					<Input id="username" name="username" autoComplete="username" aria-invalid={Boolean(errors.username)} />
					<FieldError errors={fieldError(errors.username)} />
				</Field>
				<Field data-invalid={errors.email ? true : undefined}>
					<FieldLabel htmlFor="email">Email</FieldLabel>
					<Input id="email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} />
					<FieldError errors={fieldError(errors.email)} />
				</Field>
				<Field data-invalid={errors.password ? true : undefined}>
					<FieldLabel htmlFor="password">Password</FieldLabel>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						aria-invalid={Boolean(errors.password)}
					/>
					<FieldError errors={fieldError(errors.password)} />
				</Field>
				<Field data-invalid={errors.confirmPassword ? true : undefined}>
					<FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
					<Input
						id="confirm-password"
						name="confirmPassword"
						type="password"
						autoComplete="new-password"
						aria-invalid={Boolean(errors.confirmPassword)}
					/>
					<FieldError errors={fieldError(errors.confirmPassword)} />
				</Field>
			</FieldGroup>
			<Button type="submit" disabled={pending}>
				{pending ? "Creating account..." : "Create account"}
			</Button>
		</form>
	);
}
