import { createMemoryConversationStore, createTheoremHandler } from "@theoremjs/web/server";
import { FALLBACK_KEY_SLOT, KEY_SLOT, synthProfile } from "../../../theorem/profile";

interface Env {
  GEMINI_API_KEY: string;
  GEMINI_API_KEY_B?: string;
}

type Handler = (request: Request) => Promise<Response>;

let handler: Handler | undefined;

export const onRequest: PagesFunction<Env> = ({ request, env }) => {
  handler ??= createTheoremHandler({
    profile: synthProfile,
    provider: { vault: { [KEY_SLOT]: env.GEMINI_API_KEY, [FALLBACK_KEY_SLOT]: env.GEMINI_API_KEY_B } },
    conversationStore: createMemoryConversationStore(),
  });
  return handler(request);
};
