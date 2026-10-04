import { z } from "zod";
export const lunchSearch = z.object({
  day: z.coerce.number().int().min(1).max(7).optional().catch(undefined),
});
