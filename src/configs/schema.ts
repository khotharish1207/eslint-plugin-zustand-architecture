/**
 * JSON schema for the `zustand-architecture` ESLint settings object.
 *
 * Used to validate user-provided settings and produce helpful configuration
 * errors when the schema is violated.
 */

export interface OwnershipRule {
  owner: string;
  allowedWriters?: string[];
}

export interface ZustandArchitectureSettingsSchema {
  ownership?: Record<string, OwnershipRule>;
  allowedDependencies?: Record<string, string[]>;
  analysis?: {
    confidenceThreshold?: 'low' | 'medium' | 'high';
  };
}

/** JSON Schema (draft-07) for the zustand-architecture settings. */
export const zustandArchitectureSettingsSchema: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'zustand-architecture settings',
  type: 'object',
  properties: {
    ownership: {
      type: 'object',
      description: 'State ownership rules per field',
      additionalProperties: {
        type: 'object',
        required: ['owner'],
        properties: {
          owner: {
            type: 'string',
            description: 'The store that owns this state field',
          },
          allowedWriters: {
            type: 'array',
            description: 'Stores allowed to write to this field',
            items: {
              type: 'string',
            },
          },
        },
        additionalProperties: false,
      },
    },
    allowedDependencies: {
      type: 'object',
      description: 'Allowed cross-store dependencies per store',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
    analysis: {
      type: 'object',
      properties: {
        confidenceThreshold: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Minimum confidence level for reported issues',
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

/**
 * Validation error details for a single schema violation.
 */
export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validate the zustand-architecture settings object against the JSON schema.
 *
 * Returns an array of ValidationError objects. Empty array means valid.
 * Provides helpful, human-readable error messages.
 */
export function validateSettings(
  settings: unknown,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    errors.push({
      path: '',
      message: 'settings["zustand-architecture"] must be an object',
    });
    return errors;
  }

  const obj = settings as Record<string, unknown>;

  // Validate ownership
  if (obj.ownership !== undefined) {
    if (typeof obj.ownership !== 'object' || Array.isArray(obj.ownership)) {
      errors.push({
        path: 'ownership',
        message: 'ownership must be an object',
      });
    } else {
      const ownershipObj = obj.ownership as Record<string, unknown>;
      for (const [fieldName, rule] of Object.entries(ownershipObj)) {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
          errors.push({
            path: `ownership.${fieldName}`,
            message: `ownership.${fieldName} must be an object with an "owner" string`,
          });
          continue;
        }
        const ruleObj = rule as Record<string, unknown>;
        if (typeof ruleObj.owner !== 'string') {
          errors.push({
            path: `ownership.${fieldName}.owner`,
            message: `ownership.${fieldName}.owner must be a string`,
          });
        }
        if (ruleObj.allowedWriters !== undefined) {
          if (!Array.isArray(ruleObj.allowedWriters)) {
            errors.push({
              path: `ownership.${fieldName}.allowedWriters`,
              message: `ownership.${fieldName}.allowedWriters must be an array of strings`,
            });
          } else {
            for (const [i, w] of (ruleObj.allowedWriters as unknown[]).entries()) {
              if (typeof w !== 'string') {
                errors.push({
                  path: `ownership.${fieldName}.allowedWriters[${i}]`,
                  message: `ownership.${fieldName}.allowedWriters[${i}] must be a string`,
                });
              }
            }
          }
        }
      }
    }
  }

  // Validate allowedDependencies
  if (obj.allowedDependencies !== undefined) {
    if (typeof obj.allowedDependencies !== 'object' || Array.isArray(obj.allowedDependencies)) {
      errors.push({
        path: 'allowedDependencies',
        message: 'allowedDependencies must be an object',
      });
    } else {
      const depsObj = obj.allowedDependencies as Record<string, unknown>;
      for (const [storeName, deps] of Object.entries(depsObj)) {
        if (!Array.isArray(deps)) {
          errors.push({
            path: `allowedDependencies.${storeName}`,
            message: `allowedDependencies.${storeName} must be an array of strings`,
          });
          continue;
        }
        for (const [i, dep] of (deps as unknown[]).entries()) {
          if (typeof dep !== 'string') {
            errors.push({
              path: `allowedDependencies.${storeName}[${i}]`,
              message: `allowedDependencies.${storeName}[${i}] must be a string`,
            });
          }
        }
      }
    }
  }

  // Validate analysis
  if (obj.analysis !== undefined) {
    if (typeof obj.analysis !== 'object' || Array.isArray(obj.analysis)) {
      errors.push({
        path: 'analysis',
        message: 'analysis must be an object',
      });
    } else {
      const analysis = obj.analysis as Record<string, unknown>;
      if (analysis.confidenceThreshold !== undefined) {
        const threshold = analysis.confidenceThreshold;
        if (
          typeof threshold !== 'string' ||
          !['low', 'medium', 'high'].includes(threshold)
        ) {
          errors.push({
            path: 'analysis.confidenceThreshold',
            message: 'analysis.confidenceThreshold must be one of: "low", "medium", "high"',
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate settings and throw a helpful error if invalid.
 * Use this in plugin entrypoints or rules that consume settings.
 */
export function validateSettingsOrThrow(settings: unknown): void {
  const errors = validateSettings(settings);
  if (errors.length > 0) {
    const messages = errors.map((e) => `  - ${e.path || '<root>'}: ${e.message}`).join('\n');
    throw new Error(
      `Invalid eslint-plugin-zustand-architecture settings:\n${messages}`,
    );
  }
}