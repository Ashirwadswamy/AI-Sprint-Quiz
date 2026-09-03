"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EllipsisVertical } from "lucide-react";

import { DeleteMcqDialog } from "@/components/mcq/DeleteMcqDialog";
import { PreviewMcqDialog } from "@/components/mcq/PreviewMcqDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Mcq } from "@/lib/services/mcq-service";
import { cn } from "@/lib/utils";

type NamedTarget = { id: string; name: string } | null;

export function McqTable({ mcqs }: { mcqs: Mcq[] }) {
	const router = useRouter();
	const [deleteTarget, setDeleteTarget] = useState<NamedTarget>(null);
	const [previewId, setPreviewId] = useState<string | null>(null);

	if (mcqs.length === 0) {
		return (
			<div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-8 text-center">
				<p className="text-sm text-muted-foreground">No questions yet. Create the first one for the bank.</p>
				<div>
					<Link href="/questions/new" className={cn(buttonVariants())}>
						Create Multiple Choice Question
					</Link>
				</div>
			</div>
		);
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Description</TableHead>
						<TableHead className="w-12">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{mcqs.map((mcq) => (
						<TableRow key={mcq.id}>
							<TableCell className="font-medium">{mcq.name}</TableCell>
							<TableCell className="max-w-md truncate text-muted-foreground">
								{mcq.description ?? "—"}
							</TableCell>
							<TableCell>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Actions for ${mcq.name}`}
											/>
										}
									>
										<EllipsisVertical />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => setPreviewId(mcq.id)}>Preview</DropdownMenuItem>
										<DropdownMenuItem onClick={() => router.push(`/questions/${mcq.id}/edit`)}>
											Edit
										</DropdownMenuItem>
										<DropdownMenuItem
											variant="destructive"
											onClick={() => setDeleteTarget({ id: mcq.id, name: mcq.name })}
										>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<PreviewMcqDialog
				open={previewId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPreviewId(null);
					}
				}}
				mcqId={previewId}
			/>
			<DeleteMcqDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
				mcq={deleteTarget}
			/>
		</>
	);
}
