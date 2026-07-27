export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function requestApi(configuration, path, init = {}) {
  if (!configuration.apiBaseUrl || !configuration.token) {
    throw new ApiError("Configure a URL da API e o token pessoal.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(
      `${configuration.apiBaseUrl.replace(/\/+$/, "")}${path}`,
      {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${configuration.token}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      },
    );

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new ApiError(
        data?.message || "Não foi possível acessar o CRM.",
        response.status,
        data,
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") {
      throw new ApiError("O CRM demorou para responder.");
    }
    throw new ApiError("Não foi possível acessar o CRM.");
  } finally {
    clearTimeout(timeout);
  }
}

export function testConnection(configuration) {
  return requestApi(configuration, "/api/extension/health", {
    method: "GET",
  });
}

export function saveLead(configuration, payload) {
  return requestApi(configuration, "/api/extension/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
