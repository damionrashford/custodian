/**
 * What class of thing an action is, which decides how much human attention it needs before it
 * happens. Autonomy is a spectrum set per action class and per tenant, not a property of any one
 * request (interface-standards.txt:200).
 *
 * Shared vocabulary, so it lives here: `governance` maps a class onto a review lane and its SLA,
 * and every tool in `agent` declares the class it belongs to. Two domains needing the same type is
 * exactly what this component is for — the alternative was a domain file reaching into another
 * component's barrel, which the layering gate refuses, and rightly.
 */
export type ActionClass =
  "low-risk-reversible" | "sensitive-data-access" | "financial-or-irreversible";
