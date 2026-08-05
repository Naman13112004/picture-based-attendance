// src/schemas/profileSchema.ts
// Zod v4 uses `error` instead of `required_error` / `invalid_type_error`
import { z } from 'zod';

/** POST /api/profile/upload-faces */
export const uploadFacesSchema = z.object({
  images: z
    .array(
      z
        .string()
        .min(1, 'Each image must be a non-empty base64 data-URI.')
        .refine(
          (v) => v.startsWith('data:image/'),
          'Each image must be a base64 data-URI (data:image/...).',
        ),
    )
    .min(1, 'At least one image is required.')
    .max(3, 'At most 3 face images can be uploaded at once.'),
});

export type UploadFacesInput = z.infer<typeof uploadFacesSchema>;
