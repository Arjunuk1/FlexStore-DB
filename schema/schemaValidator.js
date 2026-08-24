class SchemaValidator {
    constructor(schema) {
        this.schema = schema;
    }

    validate(document) {
        const errors = [];

        for (const [field, rules] of Object.entries(this.schema)) {
            const value = document[field];

            if (
                rules.required === true &&
                (value === undefined || value === null)
            ) {
                errors.push(`${field} is required`);
                continue;
            }

            if (value === undefined || value === null) {
                continue;
            }

            if (!this.isValidType(value, rules.type)) {
                errors.push(`${field} must be of type ${rules.type}`);
                continue;
            }

            if (rules.type === "string") {
                if (
                    rules.minLength !== undefined &&
                    value.length < rules.minLength
                ) {
                    errors.push(
                        `${field} must have at least ${rules.minLength} characters`
                    );
                }

                if (
                    rules.maxLength !== undefined &&
                    value.length > rules.maxLength
                ) {
                    errors.push(
                        `${field} must have at most ${rules.maxLength} characters`
                    );
                }
            }

            if (rules.type === "number" || rules.type === "integer") {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`${field} must be at least ${rules.min}`);
                }

                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`${field} must be at most ${rules.max}`);
                }
            }

            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(
                    `${field} must be one of: ${rules.enum.join(", ")}`
                );
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    isValidType(value, type) {
        switch (type) {
            case "string":
                return typeof value === "string";
            case "number":
                return typeof value === "number" && !Number.isNaN(value);
            case "integer":
                return Number.isInteger(value);
            case "boolean":
                return typeof value === "boolean";
            case "array":
                return Array.isArray(value);
            case "object":
                return (
                    typeof value === "object" &&
                    value !== null &&
                    !Array.isArray(value)
                );
            case "null":
                return value === null;
            default:
                return false;
        }
    }
}

module.exports = SchemaValidator;
