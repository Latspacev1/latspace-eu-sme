// Tool definitions for the dashboard chat. We expose a single tool
// (`render_chart`) — the model fills it out, the server validates and renders.

import type Anthropic from "@anthropic-ai/sdk";

export const RENDER_CHART_TOOL: Anthropic.Messages.Tool = {
  name: "render_chart",
  description:
    "Render a chart in the chat from the available reporting data. " +
    "Use this whenever the user asks to see, plot, chart, graph, visualise, " +
    "or compare metrics. Pick parameter codes from the provided catalogue " +
    "exactly — do not invent codes. If you cannot find a suitable mapping, " +
    "do NOT call this tool; respond in plain text explaining why instead.",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["trend", "bar", "kpi", "stacked", "pie"],
        description:
          "kpi = a headline-number card. STRONGLY PREFER this when the user " +
          "asks 'what is', 'what's our', 'how much', 'show me the value of', " +
          "or names a single metric without asking to plot/chart/graph it " +
          "(e.g. 'renewable share', 'total scope 1 emissions'). KPIs also " +
          "work for comparing 2-4 single values side-by-side ('scope 1 vs " +
          "scope 2 vs scope 3'). Pair with granularity='annual' for the " +
          "current value, or 'monthly' to sum across the year.\n" +
          "trend = line over time (use when the user asks 'through the year', " +
          "'monthly', 'over time', 'trend').\n" +
          "bar = vertical bars (one-off comparison of 2-6 related metrics).\n" +
          "stacked = stacked bars (break a total into components across months).\n" +
          "pie = share of total (use sparingly — only for 2-6 mutually exclusive parts).",
      },
      title: {
        type: "string",
        description: "Short chart title (under 80 chars). Plain English, no markdown.",
      },
      period_code: {
        type: "string",
        description: "The reporting period code from the catalogue (e.g. 'FY2025'). Defaults to the current period when the user doesn't specify.",
      },
      parameter_codes: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8,
        description: "1-8 parameter codes from the catalogue. The renderer plots one series per code.",
      },
      granularity: {
        type: "string",
        enum: ["monthly", "annual"],
        description:
          "monthly: 12 points across the period (use for trend/stacked unless the user asks for yearly). " +
          "annual: single value per series for the period (use for kpi/pie or when monthly data isn't meaningful).",
      },
      options: {
        type: "object",
        properties: {
          color: {
            type: "string",
            description: "Optional CSS colour for a single-series chart (e.g. '#22867C'). Ignored for multi-series.",
          },
        },
        additionalProperties: false,
      },
    },
    required: ["kind", "title", "period_code", "parameter_codes", "granularity"],
    additionalProperties: false,
  },
};
