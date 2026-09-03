import { z } from "zod";

const choicesSchema = z
	.array(
		z.object({
			text: z.string().trim().min(1).max(500),
			isCorrect: z.boolean(),
		}),
	)
	.min(2, "A question needs at least 2 choices")
	.max(6, "A question can have at most 6 choices")
	.refine((choices) => choices.filter((choice) => choice.isCorrect).length === 1, {
		message: "Exactly one choice must be marked correct",
	});

export const createMcqSchema = z.object({
	name: z.string().trim().min(1).max(200),
	question: z.string().trim().min(1).max(2000),
	description: z.string().trim().max(2000).optional(),
	choices: choicesSchema,
});

export const updateMcqSchema = z.object({
	name: z.string().trim().min(1).max(200).optional(),
	question: z.string().trim().min(1).max(2000).optional(),
	description: z.string().trim().max(2000).optional(),
	choices: choicesSchema.optional(),
});

export type CreateMcqSchema = z.infer<typeof createMcqSchema>;
export type UpdateMcqSchema = z.infer<typeof updateMcqSchema>;
