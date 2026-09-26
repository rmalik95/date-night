import { readFileSync, writeFileSync } from "node:fs";

// Generate only the content safe to ship to the browser.
const { letter, futureDate, ...publicContent } = JSON.parse(
  readFileSync(new URL("../content/date-night.json", import.meta.url), "utf8"),
);
void letter;
void futureDate;
writeFileSync(new URL("../content/public-date-night.json", import.meta.url), JSON.stringify(publicContent, null, 2) + "\n");
