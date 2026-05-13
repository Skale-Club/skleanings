import type { Response } from "express";

export const CRON_SCHEMA_NOT_READY = "SCHEMA_NOT_READY";

export function getBearerOrBodySecret(req: {
  headers: { authorization?: string };
  body?: unknown;
}): string | undefined {
  const authorization = req.headers.authorization ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) {
    return bearer;
  }

  const body = req.body as { secret?: unknown } | undefined;
  return typeof body?.secret === "string" ? body.secret : undefined;
}

export function isMissingDatabaseRelation(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate?.message === "string" ? candidate.message : "";

  return candidate?.code === "42P01" || /relation\s+"[^"]+"\s+does not exist/i.test(message);
}

export function getMissingDatabaseRelation(error: unknown): string | undefined {
  const candidate = error as { message?: unknown };
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  return message.match(/relation\s+"([^"]+)"\s+does not exist/i)?.[1];
}

export function sendCronSchemaNotReady(
  res: Response,
  feature: string,
  error: unknown,
) {
  const relation = getMissingDatabaseRelation(error);

  return res.status(503).json({
    success: false,
    code: CRON_SCHEMA_NOT_READY,
    feature,
    relation,
    message: relation
      ? `Database schema is missing relation "${relation}". Apply migrations before this cron can run.`
      : "Database schema is not ready. Apply migrations before this cron can run.",
  });
}
