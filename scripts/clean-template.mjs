import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";
const root = path.resolve(import.meta.dirname, "..");
const files = [
  ...new Set(
    Object.values(JSON.parse(fs.readFileSync(path.join(root, "routes.json"))))
      .filter((r) => !r.redirect)
      .map((r) => r.file),
  ),
];
const attr = (n, k) => n.attrs?.find((a) => a.name === k)?.value || "";
const cls = (n, c) => attr(n, "class").split(/\s+/).includes(c);
const text = (n) =>
  n.nodeName === "#text" ? n.value : (n.childNodes || []).map(text).join("");
let changed = 0,
  removed = 0;
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8"),
    doc = parse(source, { sourceCodeLocationInfo: true }),
    edits = [];
  const cut = (n) => {
    const l = n.sourceCodeLocation;
    if (l) {
      edits.push([l.startOffset, l.endOffset, ""]);
      removed++;
    }
  };
  const walk = (n) => {
    if (
      n.tagName === "footer" &&
      /Gantry Framework|Developed by RocketTheme/.test(text(n))
    ) {
      cut(n);
      return;
    }
    if (cls(n, "g-social-header")) {
      cut(n);
      return;
    }
    if (attr(n, "id") === "g-totop") {
      let p = n;
      while (p.parentNode && !cls(p, "g-block")) p = p.parentNode;
      cut(cls(p, "g-block") ? p : n);
      return;
    }
    if (
      cls(n, "g-logo-helium") &&
      n.childNodes?.some((c) => c.tagName === "svg")
    ) {
      const l = n.sourceCodeLocation;
      edits.push([
        l.startOffset,
        l.endOffset,
        '<a class="g-logo" href="/" aria-label="ПраймКом — главная"><img src="/templates/g5_helium/custom/images/logo.png" alt="ПраймКом"></a>',
      ]);
      return;
    }
    if (
      n.tagName === "a" &&
      /^tel:/i.test(attr(n, "href")) &&
      /(?:7|8)495704/.test(attr(n, "href").replace(/\D/g, ""))
    ) {
      cut(n);
      return;
    }
    if (n.nodeName === "#text" && /(?:\+7|8)[\s(]*495[\s)]*704/.test(n.value)) {
      const l = n.sourceCodeLocation;
      edits.push([
        l.startOffset,
        l.endOffset,
        n.value.replace(
          /(?:\+7|8)[\s(]*495[\s)]*704[\s-]*\d{2}[\s-]*\d{2}/g,
          "",
        ),
      ]);
    }
    for (const c of n.childNodes || []) walk(c);
  };
  walk(doc);
  if (!edits.length) continue;
  let output = source;
  for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0]))
    output = output.slice(0, start) + value + output.slice(end);
  fs.writeFileSync(path.join(root, file), output);
  changed++;
}
console.log(`Cleaned ${changed} pages; removed ${removed} template blocks.`);
