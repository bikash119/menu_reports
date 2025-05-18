import { z } from 'zod'; 
const MenuRowSchema = z.object({
    row_id : z.number(),
    date: z.string(),
    customer_name: z.string(),
    material_code: z.number(),
    material_description: z.string(),
    menu_type: z.string(),
    pick_qty : z.number(),
    pick_uom : z.string(),
  });
/**
 * Defines the type for a MenuRow based on the MenuRowSchema.
 */
export type MenuRow = z.infer<typeof MenuRowSchema>;

/**
 * Exports the MenuRowSchema for use in other parts of the application.
 */
export default  MenuRowSchema ;