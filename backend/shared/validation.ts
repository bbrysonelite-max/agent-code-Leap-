import { ValidationError } from "./errors";

export interface ValidationRule<T = any> {
  validate: (value: T, fieldName: string) => void;
  message?: string;
}

export class Validator {
  private errors: ValidationError[] = [];

  validate<T>(value: T, fieldName: string, rules: ValidationRule<any>[]): this {
    for (const rule of rules) {
      try {
        rule.validate(value, fieldName);
      } catch (error) {
        if (error instanceof ValidationError) {
          this.errors.push(error);
        } else {
          this.errors.push(new ValidationError(`Validation failed for ${fieldName}`, fieldName));
        }
      }
    }
    return this;
  }

  check(): void {
    if (this.errors.length > 0) {
      throw this.errors[0]; // Throw the first validation error
    }
  }

  getErrors(): ValidationError[] {
    return this.errors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}

export const Rules = {
  required: <T>(message?: string): ValidationRule<T> => ({
    validate: (value: T, fieldName: string) => {
      if (value === null || value === undefined || value === "") {
        throw new ValidationError(message || `${fieldName} is required`, fieldName);
      }
    },
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value: string, fieldName: string) => {
      if (value && value.length < min) {
        throw new ValidationError(
          message || `${fieldName} must be at least ${min} characters long`,
          fieldName,
          { minLength: min, actualLength: value.length }
        );
      }
    },
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value: string, fieldName: string) => {
      if (value && value.length > max) {
        throw new ValidationError(
          message || `${fieldName} must be no more than ${max} characters long`,
          fieldName,
          { maxLength: max, actualLength: value.length }
        );
      }
    },
  }),

  email: (message?: string): ValidationRule<string> => ({
    validate: (value: string, fieldName: string) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new ValidationError(message || `${fieldName} must be a valid email address`, fieldName);
      }
    },
  }),

  min: (min: number, message?: string): ValidationRule<number> => ({
    validate: (value: number, fieldName: string) => {
      if (value !== null && value !== undefined && value < min) {
        throw new ValidationError(
          message || `${fieldName} must be at least ${min}`,
          fieldName,
          { min, actual: value }
        );
      }
    },
  }),

  max: (max: number, message?: string): ValidationRule<number> => ({
    validate: (value: number, fieldName: string) => {
      if (value !== null && value !== undefined && value > max) {
        throw new ValidationError(
          message || `${fieldName} must be no more than ${max}`,
          fieldName,
          { max, actual: value }
        );
      }
    },
  }),

  oneOf: <T>(values: T[], message?: string): ValidationRule<T> => ({
    validate: (value: T, fieldName: string) => {
      if (value !== null && value !== undefined && !values.includes(value)) {
        throw new ValidationError(
          message || `${fieldName} must be one of: ${values.join(", ")}`,
          fieldName,
          { allowedValues: values, actual: value }
        );
      }
    },
  }),

  pattern: (regex: RegExp, message?: string): ValidationRule<string> => ({
    validate: (value: string, fieldName: string) => {
      if (value && !regex.test(value)) {
        throw new ValidationError(
          message || `${fieldName} has invalid format`,
          fieldName,
          { pattern: regex.source }
        );
      }
    },
  }),

  url: (message?: string): ValidationRule<string> => ({
    validate: (value: string, fieldName: string) => {
      if (value) {
        try {
          new URL(value);
        } catch {
          throw new ValidationError(message || `${fieldName} must be a valid URL`, fieldName);
        }
      }
    },
  }),

  positive: (message?: string): ValidationRule<number> => ({
    validate: (value: number, fieldName: string) => {
      if (value !== null && value !== undefined && value <= 0) {
        throw new ValidationError(
          message || `${fieldName} must be a positive number`,
          fieldName,
          { actual: value }
        );
      }
    },
  }),

  integer: (message?: string): ValidationRule<number> => ({
    validate: (value: number, fieldName: string) => {
      if (value !== null && value !== undefined && !Number.isInteger(value)) {
        throw new ValidationError(
          message || `${fieldName} must be an integer`,
          fieldName,
          { actual: value }
        );
      }
    },
  }),
};

export function validateObject<T extends Record<string, any>>(
  obj: T,
  schema: Partial<Record<keyof T, ValidationRule<any>[]>>
): void {
  const validator = new Validator();
  
  for (const [fieldName, rules] of Object.entries(schema)) {
    if (rules && Array.isArray(rules)) {
      validator.validate(obj[fieldName as keyof T], fieldName, rules);
    }
  }
  
  validator.check();
}

export function validateField<T>(
  value: T,
  fieldName: string,
  rules: ValidationRule<any>[]
): void {
  const validator = new Validator();
  validator.validate(value, fieldName, rules);
  validator.check();
}