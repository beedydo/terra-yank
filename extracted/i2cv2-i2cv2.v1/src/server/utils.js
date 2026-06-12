function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9_/-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "resource";
}

function parseArn(arn) {
  const parts = String(arn || "").split(":");
  const service = parts[2] || "unknown";
  const region = parts[3] || "";
  const accountId = parts[4] || "";
  const resourceRaw = parts.slice(5).join(":");
  const slashIndex = resourceRaw.indexOf("/");
  const colonIndex = resourceRaw.indexOf(":");

  let resourceType = "unknown";
  let resourceId = resourceRaw;
  if (slashIndex > -1 && (colonIndex === -1 || slashIndex < colonIndex)) {
    resourceType = resourceRaw.slice(0, slashIndex);
    resourceId = resourceRaw.slice(slashIndex + 1);
  } else if (colonIndex > -1) {
    resourceType = resourceRaw.slice(0, colonIndex);
    resourceId = resourceRaw.slice(colonIndex + 1);
  }

  return { service, region, accountId, resourceType, resourceId, resourceRaw };
}

module.exports = { slugify, parseArn };
