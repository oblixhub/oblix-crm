import { createHash, timingSafeEqual } from "node:crypto";

function tokenDigest(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest();
}

function safeTokenEquals(received, configured) {
  if (!received || !configured) return false;
  return timingSafeEqual(tokenDigest(received), tokenDigest(configured));
}

export function resolveOperator(request, env = process.env) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const receivedToken = match?.[1]?.trim() ?? "";

  const operators = [
    {
      token: env.OBLIX_EXTENSION_TOKEN_HUGO,
      name: "Hugo",
      crmOwner: "Você",
    },
    {
      token: env.OBLIX_EXTENSION_TOKEN_SOCIA,
      name: "Sócia",
      crmOwner: "Sócia",
    },
  ];

  let resolved = null;
  for (const operator of operators) {
    if (safeTokenEquals(receivedToken, operator.token)) {
      resolved = { name: operator.name, crmOwner: operator.crmOwner };
    }
  }

  return resolved;
}
