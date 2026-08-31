/**
 * Server-Sent Events splits records on `\r\n`, `\r` **or** `\n`, so any of the three arriving inside
 * a chunk of model output would end the record early and the client would render the remainder as a
 * second, unrelated event. Prefixing every line rather than the payload is what makes multi-line
 * output — which is most model output — survive the transport intact.
 */
const LINE_BREAK = /\r\n|\r|\n/;

export function streamEvent(text: string): string {
  return `${text
    .split(LINE_BREAK)
    .map((line) => `data: ${line}`)
    .join("\n")}\n\n`;
}
