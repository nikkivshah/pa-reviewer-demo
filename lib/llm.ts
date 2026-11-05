import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export type StructuredResult<T> = {
  data: T;
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
};

/**
 * Calls Claude with structured outputs: the API constrains the response to the
 * JSON schema generated from our zod schema, and the SDK parses it back with
 * that same schema. We then re-validate with zod so constraints the API can't
 * express (number ranges, array lengths) are still enforced on our side.
 */
export async function callStructured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<StructuredResult<z.infer<S>>> {
  const started = Date.now();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { format: zodOutputFormat(opts.schema) },
  });
  const latencyMs = Date.now() - started;

  if (response.stop_reason === "max_tokens") {
    throw new Error("Model output was cut off (max_tokens). Raise maxTokens.");
  }

  const parsed = opts.schema.safeParse(response.parsed_output);
  if (!parsed.success) {
    throw new Error(`Model output failed schema validation: ${z.prettifyError(parsed.error)}`);
  }

  return {
    data: parsed.data,
    model: response.model,
    latencyMs,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}
