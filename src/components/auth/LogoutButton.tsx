"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
	const router = useRouter();

	async function onClick() {
		try {
			await fetch("/api/auth/logout", { method: "POST" });
		} catch {
			// There is no server session to clean up; still leave the stub page.
		}
		router.replace("/login");
	}

	return (
		<Button type="button" variant="outline" onClick={onClick}>
			Log out
		</Button>
	);
}
