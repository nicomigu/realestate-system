import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

// Validates a request body against a zod schema and hands the parsed,
// typed value to the controller. Use it as `@Body(new ZodValidationPipe(Schema))`.
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: z.flattenError(result.error).fieldErrors,
      });
    }
    return result.data;
  }
}
