import "server-only";

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
