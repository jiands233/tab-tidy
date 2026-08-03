export class OrganizerError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'OrganizerError';
    this.code = code;
  }
}

export function toOrganizerError(error, code, message) {
  if (error instanceof OrganizerError) return error;
  return new OrganizerError(code, message, { cause: error });
}
