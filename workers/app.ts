import { createRequestHandler } from "react-router";
import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono()
app.use(logger())

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

app.get("*", async (c) => {
  return requestHandler(c.req.raw, {
    cloudflare: { env: c.env as Env , ctx: c.executionCtx as ExecutionContext},
  });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // If it's an API route, let Hono handle it
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    
    // Otherwise, let React Router handle it
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
