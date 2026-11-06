export interface RegisterAgentOptions {
  baseUrl: string;
  registrationToken: string;
  name: string;
  description: string;
}

export interface RegisteredAgent {
  agentId: string;
  apiKey: string;
}

interface RegistrationProfile {
  connection_model: "always_on";
  message_exchange: true;
  pre_invocation_mediation: string[];
  post_invocation_mediation: string[];
  event_reporting: string[];
}

interface RegistrationBody {
  name: string;
  description: string;
  connector_type: "external";
  integration_profile: RegistrationProfile;
}

export async function registerAgent(
  options: RegisterAgentOptions,
): Promise<RegisteredAgent> {
  const body: RegistrationBody = {
    name: options.name,
    description: options.description,
    connector_type: "external",
    integration_profile: {
      connection_model: "always_on",
      message_exchange: true,
      pre_invocation_mediation: [],
      post_invocation_mediation: [],
      event_reporting: [],
    },
  };

  const response = await fetch(`${options.baseUrl}/agents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.registrationToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const parsed: unknown = text.length > 0 ? parseJson(text) : null;

  if (!response.ok) {
    const detail =
      isRecord(parsed) && "detail" in parsed
        ? parsed.detail
        : parsed ?? response.statusText;
    throw new Error(
      `Switch registration failed (${response.status}): ${describeDetail(detail)}`,
    );
  }

  if (!isRecord(parsed)) {
    throw new Error("Switch registration response was not a JSON object");
  }

  const id = parsed.id;
  const apiKey = parsed.api_key;
  if (typeof id !== "string" || typeof apiKey !== "string") {
    throw new Error("Switch registration response is missing id or api_key");
  }

  return { agentId: id, apiKey };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail === null || detail === undefined) return "no detail";
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
